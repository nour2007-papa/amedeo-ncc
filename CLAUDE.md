# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

`amedeo-ncc` — public marketing site + booking system for a Milan chauffeur (NCC) service, branded "Grifone NCC". Vue 3 + Vite, deployed on Vercel. It is one half of a two-project system; the other half is **`ncc-fleet`** (a separate app at `amedeo-fleet.vercel.app`, not in this repo) where the operator dispatches drivers. Most of the non-obvious complexity here is the sync bridge between the two.

## Commands

```bash
npm install
npm run dev        # Vite dev server on http://localhost:5173
npm run build      # → dist/
npm run preview    # serve the built dist/

# one-time: seed the Firestore config/settings doc that firestore.rules reads adminEmail from
SITE_SERVICE_ACCOUNT_KEY=<base64 service account> ADMIN_EMAIL=... node scripts/init-firestore-config.js

# pack the project for sharing, stripping .env/.git/node_modules/dist
bash safe-export.sh /path/to/vue-project-v2
```

There is **no test runner, no linter, and no formatter** configured — `dev`, `build`, `preview` are the only npm scripts. Verify changes by running the dev server. `SYNC_TESTING_CHECKLIST.md` is a manual test checklist for the sync system.

`/api/*` endpoints are Vercel serverless functions; `npm run dev` does **not** serve them (fetches to `/api/...` will 404 locally). Use `vercel dev`, or test them against a deployed preview.

## Two Firebase projects

This is the single most important thing to understand before touching Admin.vue or the sync code.

| | site project (`amedeo-ncc`) | fleet project (`amedeo-fleet`) |
|---|---|---|
| client SDK | `src/firebase.js` → `db`, `auth` | `src/firebase-fleet.js` → `fleetDb`, `fleetAuth` (named app `'fleet'`) |
| env prefix | `VITE_FIREBASE_*` | `VITE_FLEET_FIREBASE_*` |
| collections | `bookings`, `config/settings` | `prenotazioni`, `trips`, `employees` |
| admin SDK key (Vercel) | `SITE_SERVICE_ACCOUNT_KEY` (base64 JSON) | `FLEET_SERVICE_ACCOUNT_KEY` (base64 JSON) |

They are genuinely separate Firebase projects, so **two separate Auth sessions are required**. `login()` in `Admin.vue` signs in to *both* with the same admin credentials. Any write to `fleetDb` from the browser without a live `fleetAuth` session fails with `permission-denied` — that is why `SyncOrchestrator.performSync()` calls `waitForFleetAuth()` first rather than reading `fleetAuth.currentUser` directly.

Env vars live in `.env` / `.env.local` (gitignored; `.env.example` is the template). No keys are hardcoded — both firebase modules `console.warn` and degrade instead of throwing when vars are absent.

## Routing: three apps in one bundle, selected by URL hash

`src/main.js` inspects `window.location.hash` and dynamically imports exactly one root component, so a normal visitor never downloads the admin code:

- default → `App.vue` — the public marketing site (hero, services, fleet, trips, footer, cookie banner, privacy modal, embedded `BookingForm.vue`).
- `#gestione-9f3k2x7q` → `Admin.vue` — the operator panel. This "secret link" is the only access control at the routing level; real authorization is Firebase Auth + `firestore.rules`. When this route is active, `main.js` also injects `/admin.css`, `/manifest-gestione.json`, iOS meta tags, and registers `/sw-gestione.js`. The PWA exists **only** for this route — the public site deliberately has no manifest and no service worker.
- `#modifica-{bookingId}-{editToken}` → `Modifica.vue` — customer self-service edit/cancel page.

`Admin.vue` styles come from the static `public/admin.css`, *not* from a `<style>` block, because Vite chunk ordering could otherwise leak `App.vue`'s public-site CSS into the panel. Keep it that way.

## Booking lifecycle

1. **Visitor submits** `BookingForm.vue` → `addDoc` into site `bookings` with `confirmed: false`, a `serverTimestamp()` `createdAt`, and a client-generated 32-hex-char `editToken`. Both the "historic" field names (`serviceDate`, `flight`, `people`, `bags`, `hotel`) and the fleet-schema names (`dataOra`, `volo`, `passeggeri`, `bagagli`, `destinazione`, `zona`, `tipoServizio`, `lingua`) are written, so the fleet mirror needs no mapping. Then the browser is redirected to `wa.me/...` with a prefilled message.
2. **Draft mirror**: the form fire-and-forgets `POST /api/sync-pending` with just `{ bookingId }`. The endpoint re-reads the real document from `siteDb` via Admin SDK and builds the fleet record only from those verified fields — the request body is deliberately *not* trusted. It also rejects bookings older than 30 minutes and IDs not matching `/^[A-Za-z0-9]{10,40}$/`. Failures are non-blocking; the operation stays in a `localStorage` queue (`SyncQueueManager`).
3. **Admin confirms** in `Admin.vue`, optionally assigning a driver picked from fleet `employees`. This sets `confirmed`, creates/updates the fleet `prenotazioni` doc (storing `fleetDocId` back on the booking) and a `trips` doc (`fleetTripId`), then opens WhatsApp with a confirmation message for the client. The driver's message is *not* auto-opened — browsers silently block a second `window.open()` in one click handler, so it's parked in `pendingDriverWaLink` behind its own button.
4. **Customer edits** via the `#modifica-` link, which goes through `POST/GET /api/booking-edit`. Firestore rules block all direct client reads/writes on `bookings`, so all of it runs server-side with the Admin SDK: constant-time `editToken` compare, a 6-hour-before-pickup edit window, an allowlist of editable fields with per-field length caps, and a `publicView()` projection that never returns `editToken` / `fleetDocId`.
5. **Fleet → site**: `Admin.vue`'s `listenForFleetCompletions()` watches fleet `prenotazioni` where `stato == 'completato'` and mirrors completion back, marking `completionSynced` to avoid reprocessing.

Status strings differ between the systems; `STATUS_MAPPER` in `src/sync-orchestrator.js` is the single translation table (`pending`↔`nuovo_contatto`, `confirmed`↔`confermato`, `confirmed_with_driver`↔`autista_assegnato`, `cancelled`↔`annullato`).

## Sync system

`src/sync-orchestrator.js` (classes) + `src/sync-utils.js` (setup/queue/monitor/listener wrappers) + `src/performance-optimizer.js` (`CacheManager`, `QueryOptimizer`, `BatchProcessor`, `MemoryMonitor`, `PerformanceMetrics`, `debounce`/`throttle`). `Admin.vue` wires them up in `initializeEnhancedSync()`. Full design notes in `SYNC_SYSTEM_DOCUMENTATION.md`.

Two feedback-loop guards exist and are easy to break accidentally:

- `determineSyncAction()` returns `skip` when `syncedAt >= updatedAt`. Without it, every successful sync writes `bookings.syncedAt`, which is itself a `modified` event on the collection watched by the realtime listener → infinite loop.
- `lastFailedAttemptAt` / `failureCooldownMs` (60s) is deliberately **in-memory only**. Persisting it to Firestore would generate another `modified` event and re-feed the same loop.

Retries use `withExponentialBackoff` (5 attempts, 1s → 30s cap). `SyncErrorHandler` adds a circuit breaker that only trips on transient codes (`unavailable`, `deadline-exceeded`, `resource-exhausted`). `setupRealtimeSyncListener` debounces bursts by 1s and batches through `syncBatch` (5 at a time). `initializeEnhancedSync()` must stay idempotent — it previously registered a duplicate `onSnapshot` on every call.

`/api/sync-webhook` is the server-side counterpart for Cloud-Function-driven events. It requires an HMAC-SHA256 `x-webhook-signature` over the raw body using `SYNC_WEBHOOK_SECRET`; if that env var is missing it rejects **everything** rather than falling back to a default secret. Failed events go to a dead-letter queue in Firestore.

## Security invariants

These were established by audits (`SECURITY_AUDIT_2026-08-31.md`, `SYNC_SECURITY_PERFORMANCE_AUDIT.md`, `AUDIT_REPORT.md`) and several were regressions once already. Don't undo them:

- `firestore.rules`: anonymous visitors get `create` on `bookings` only, with an exact key allowlist, length caps, enum checks on `lingua`/`tipoServizio`, `createdAt == request.time`, and `confirmed == false`. Everything else is `isAdmin()`. `config/*` is admin-read-only — `isAdmin()`'s internal `get()` works regardless of the document's own read rule.
- API endpoints must start with `if (!(await applySecurityMiddleware(req, res))) return;` — it is async because rate limiting awaits Redis.
- Rate limiting (`api/security-middleware.js`) uses Upstash Redis REST (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`) because Vercel serverless cold starts reset an in-memory `Map` and each instance would count separately. The in-memory path is only a degraded fallback.
- Never return `error.message` or internal identifiers to callers — generic codes only (`sync_failed`, `invalid_payload`, `server_not_configured`). Diagnostic detail goes on `error.debugInfo` and `console.error` (admin's own browser console), never into `error.message`, which external log sinks could pick up.
- CSP is set in two places and they should stay coherent: `vercel.json` for pages, and `addSecurityHeaders()` in the middleware for API responses (`default-src 'none'`, since JSON endpoints render nothing).

## Conventions and gotchas

- **Comment language is mixed** — Arabic, Italian, and English all appear, often within one file. Match whatever language surrounds the code you're editing. Comments frequently document *why* a fix exists (`BUG FIX:`, `SICUREZZA (fix):`, `⚠️ CAVEAT`) — preserve them; they encode the loop guards and security decisions above.
- All UI strings live in `src/i18n.js` (`dict`) keyed by `it` / `en` / `ar`; every locale must be updated together. Arabic drives RTL layout. `App.vue` reads them only inside `computed()` so the dictionary is never touched at module-eval time. `BookingForm.vue` and `Modifica.vue` carry their own small inline `UI` objects instead of using `dict`.
- Static content (services, fleet cars, trip cards, rotating images) is data in `src/content.js`, referenced by i18n key. Photos are still Unsplash placeholders.
- `vite-version-plugin.js` writes `public/version.json` at `buildStart`; `useVersionCheck()` polls it every 60s and force-reloads the page when the version changes. `public/version.json` is a build artifact — expect it to be dirty in git.
- `vite.config.js` splits all `firebase`/`@firebase` modules into a single `firebase` chunk.
- `sw-gestione.js` intercepts **only** `mode === 'navigate'` requests. An earlier version cached everything and turned transient network blips into hard failures.
- Root-level `*.patch` files and `*_AUDIT*.md` / `SYNC_*.md` files are working artifacts, not build inputs.
- Commit messages follow conventional-commit prefixes (`fix:`, `feat:`, `security:`, `perf:`, `docs:`, `style:`, `chore:`), subject in English, Italian, or Arabic.

## Known gaps

- `Modifica.vue` + `/api/booking-edit` are fully implemented, but `Admin.vue`'s confirmation WhatsApp message (`WA_CONFIRM_TEXT`) does **not** yet include the `#modifica-{bookingId}-{editToken}` link, so customers currently have no way to reach that page.
- README TODOs still open: real P.IVA in the footer, real domain and real photos instead of Unsplash. The testimonials section was removed on purpose (the reviews were fabricated) — only restore it with genuine customer reviews.
