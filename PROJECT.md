# Grifone NCC — amedeo-ncc (Booking Site)

> Ultimo aggiornamento: 05/09/2026

## Panoramica
Sito pubblico di prenotazione per Grifone NCC (Noleggio con Conducente), Milano.
Stack: Vue 3 (SPA, no router) + Firebase (progetto `amedeo-ncc`) + Vercel.
Multilingua: IT / EN / AR (RTL).

Repo: `github.com/nour2007-papa/amedeo-ncc.git`
Percorso locale: `C:/Users/amede/OneDrive/Desktop/amedeo-ncc-vue-git/vue-project-v2`

## Architettura
- `src/App.vue` — componente principale, tutto il sito è una single-page (sezioni con anchor: hero, servizi, flotta, video, viaggi, contatti)
- `src/AeroportoPage.vue` — pagine dedicate `/aeroporti/malpensa`, `/aeroporti/linate`, `/aeroporti/bergamo` (mount separato in `main.js`, non condivide App.vue)
- `src/BookingForm.vue`, `src/Admin.vue`, `src/Modifica.vue` (self-service edit/cancel via link WhatsApp con token)
- `src/content.js` — dati servizi/flotta/viaggi; `src/i18n.js` — dizionario traduzioni
- `api/` — funzioni serverless Vercel: `booking-edit.js`, `sync-pending.js`, `sync-webhook.js`, `_validation.js`, `_rateLimit.js`
- Sync incrociato con `ncc-fleet` (dashboard interno) via Firebase Admin SDK + queue con retry

## SEO — sessione 05/09/2026
- **Problema root**: nessun routing reale per lingua — `currentLang` era solo uno state JS, stesso URL per IT/EN/AR → `hreflang` inutile, meta tag statici uguali per tutte le lingue
- **Fix applicati**:
  - Routing path-based senza Vue Router: `detectLangFromPath()` + `history.pushState` in `setLang()` (App.vue)
  - `vercel.json`: rewrites per `/en`, `/ar`, `/en|ar/aeroporti/:slug`
  - `hreflang` in `index.html` corretti con URL reali per lingua
  - `title`/`meta description` dinamici per lingua (oggetto `SEO_META` in App.vue, watch su `currentLang`)
  - Nuovo `scripts/prerender.js` (postbuild): usa `vite preview` + Puppeteer per generare snapshot HTML statici per ogni lingua/rotta in `dist/`, così i motori di ricerca vedono contenuto/meta corretti senza eseguire JS
  - `package.json`: script `postbuild`, dipendenza `puppeteer`
- **Da verificare**: build locale (`npm run build`) e controllo `dist/en/index.html`, `dist/ar/index.html` con View Source dopo il deploy

### Prossimi step SEO (non ancora iniziati)
- `sitemap.xml` completo con tutte le rotte/lingue
- `robots.txt`
- Google Search Console + Google Business Profile
- Contenuto SEO locale aggiuntivo (pagine città/tratte)

## Sicurezza — stato (da [[security-review]])
- Audit completo fine agosto 2026: fix debug info leak, errori generici, CSP unificata (commit b005b56)
- Barrion scan (27 ago): 85/100 — pendenti: Certificate Expiry, CSP score, CSP Bypass (`apis.google.com` in script-src da rimuovere), Trusted Types, `style-src 'unsafe-inline'` (richiede refactor componenti Vue)
- Snyk scan (2 set): fix CWE-1287 in `sync-webhook.js`; 2 falsi positivi SQL Injection confermati e chiusi
- API key Firebase ristrette su Google Cloud Console (amedeo-ncc + amedeo-fleet)
- Env vars verificate su Vercel Production: `UPSTASH_REDIS_REST_URL/TOKEN`, `SYNC_WEBHOOK_SECRET`, `SITE_SERVICE_ACCOUNT_KEY`, `FLEET_SERVICE_ACCOUNT_KEY`

## Sync amedeo-ncc ↔ ncc-fleet (da [[mirror-sync-rebuild]])
- Fix `waitForFleetAuth()` per race condition di permission-denied (commit d3d9a46)
- Fix `autistaUid` mancante nel mirror (Admin.vue ora recupera `authUid` da employees)
- **Limite noto**: sync solo IT → non esiste ancora sync inverso quando l'autista chiude una corsa su ncc-fleet
- **Non ancora fatto**: sync inverso ncc-fleet → amedeo-ncc per lo stato "completata"

## Pendenze generali
- Foto reali dei veicoli (al posto delle immagini stock)
- Fix P.IVA nel footer
- Sezione testimonianze (in attesa di recensioni reali)
- `style-src 'unsafe-inline'` da sistemare (CSP)
- Sync inverso ncc-fleet → amedeo-ncc

## Storico sessioni
- **Fine ago 2026**: Rebranding "Amedeo NCC" → "Grifone NCC" (logo, favicon, testi)
- **Fine ago 2026**: Audit sicurezza completo + fix sync-orchestrator
- **1 set 2026**: Basic Auth su ncc-fleet (middleware.js), confermato funzionante
- **2 set 2026**: Snyk scan + fix CWE-1287
- **05/09/2026**: Sessione SEO — routing per lingua, hreflang, meta dinamici, prerendering (vedi sopra)
