<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, watch } from 'vue';
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { firebaseConfig } from './firebase.js';
import BookingForm from './BookingForm.vue';
import griffinLogoSmall from './assets/griffin-logo.webp';
import grifoneHero from './assets/griffin-hero.webp';
import { dict } from './i18n.js';
import { services, fleet, trips, otherItalyImages, customTripImages } from './content.js';
import { useVersionCheck } from './composables/useVersionCheck.js';

/* Auto-reload الصفحة لما ديبلوي جديد يطلع، عشان نتجنب مشاكل الكاش القديم */
useVersionCheck();

/* =========================================================
   Firebase — saves each booking request to Firestore so it
   shows up in the admin dashboard (Admin.vue). This never
   blocks or breaks the booking form: if Firebase isn't
   configured yet, or the write fails, we just log it and the
   WhatsApp handoff continues normally.
   ========================================================= */
let db = null;
try {
  const fbApp = initializeApp(firebaseConfig);
  db = getFirestore(fbApp);
} catch (e) {
  console.warn('Firebase non configurato:', e);
}

/* Il salvataggio su Firestore ora avviene dentro BookingForm.vue
   (riceve `db` come prop) — questa funzione non serve più qui. */

/* =========================================================
   Structured content — services / fleet / trips driven by
   arrays + v-for instead of copy-pasted markup.
   ========================================================= */
const otherItalyIndex = ref(0);
const customTripIndex = ref(0);
const otherItalyPhoto = computed(() => otherItalyImages[otherItalyIndex.value]);
const customTripPhoto = computed(() => customTripImages[customTripIndex.value]);
function tripPhoto(trip) {
  if (trip.photoRotating === 'otherItaly') return otherItalyPhoto.value;
  if (trip.photoRotating === 'customTrip') return customTripPhoto.value;
  return trip.photo;
}
let rotateTimer = null;
onMounted(() => {
  rotateTimer = setInterval(() => {
    otherItalyIndex.value = (otherItalyIndex.value + 1) % otherItalyImages.length;
    customTripIndex.value = (customTripIndex.value + 1) % customTripImages.length;
  }, 3000);
});
onUnmounted(() => clearInterval(rotateTimer));

/* =========================================================
   Language state
   ========================================================= */
function detectLangFromPath() {
  const p = window.location.pathname;
  if (p === '/en' || p.startsWith('/en/')) return 'en';
  if (p === '/ar' || p.startsWith('/ar/')) return 'ar';
  return 'it';
}
const currentLang = ref(detectLangFromPath());
const t = computed(() => dict[currentLang.value]);

/* عناوين عمود "روابط المطارات" في الفوتر — نص محلي صغير هنا بدل
   إضافة مفاتيح جديدة لـ i18n.js (تقدر تنقلهم لملف الترجمة الرسمي
   لاحقًا لو حبيت تبقى متسقة مع باقي النصوص). */
const AIRPORT_LINK_LABELS = {
  it: { heading: 'Transfer Aeroporto', malpensa: 'Malpensa (MXP)', linate: 'Linate (LIN)', bergamo: 'Bergamo Orio al Serio (BGY)' },
  en: { heading: 'Airport Transfer', malpensa: 'Malpensa (MXP)', linate: 'Linate (LIN)', bergamo: 'Bergamo Orio al Serio (BGY)' },
  ar: { heading: 'نقل من وإلى المطار', malpensa: 'مالبينسا (MXP)', linate: 'ليناتي (LIN)', bergamo: 'بيرجامو أوريو آل سيريو (BGY)' },
};
const airportLinksLabel = computed(() => AIRPORT_LINK_LABELS[currentLang.value]);

/* SEO: title + meta description لازم يتغيروا فعليًا في الـ DOM مع كل
   لغة — ده أساسي عشان الـ prerender script يلتقط نسخة صح لكل لغة. */
const SEO_META = {
  it: {
    title: 'Autista Privato Milano | NCC Transfer Aeroporto Malpensa Linate Orio | Grifone NCC',
    description: 'Servizio NCC Milano e Lombardia. Autista privato professionale per transfer aeroporto Malpensa, Linate, Orio al Serio. Mercedes premium, rappresentanza business, eventi e tour in tutta Italia. Prenotazione 24/7, riservatezza e puntualità.',
  },
  en: {
    title: 'Private Chauffeur Milan | NCC Airport Transfer Malpensa Linate Orio | Grifone NCC',
    description: 'Premium NCC chauffeur service in Milan and Lombardy. Airport transfers to Malpensa, Linate, Orio al Serio. Mercedes fleet, business travel, events and tours across Italy. 24/7 booking, privacy and punctuality.',
  },
  ar: {
    title: 'سائق خاص ميلانو | نقل من وإلى مطارات مالبينسا وليناتي وأوريو | جريفوني NCC',
    description: 'خدمة سائق خاص احترافية في ميلانو ولومبارديا. نقل من وإلى مطارات مالبينسا وليناتي وأوريو آل سيريو. أسطول مرسيدس فاخر، تنقلات أعمال، فعاليات وجولات سياحية في إيطاليا. حجز على مدار الساعة، خصوصية ودقة في المواعيد.',
  },
};
watch(currentLang, (lang) => {
  const meta = SEO_META[lang];
  if (!meta) return;
  document.title = meta.title;
  document.querySelector('meta[name="description"]')?.setAttribute('content', meta.description);
}, { immediate: true });

watch(currentLang, (lang) => {
  document.documentElement.setAttribute('lang', lang);
  document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
}, { immediate: true });

onMounted(() => {
  window.addEventListener('popstate', onPopState);
});
onUnmounted(() => {
  window.removeEventListener('popstate', onPopState);
});

function setLang(lang) {
  currentLang.value = lang;
  const path = window.location.pathname.replace(/^\/(en|ar)(?=\/|$)/, '') || '/';
  const newPath = lang === 'it' ? path : `/${lang}${path === '/' ? '' : path}`;
  window.history.pushState({}, '', newPath);
}

function onPopState() {
  currentLang.value = detectLangFromPath();
}

/* Departure board translates automatically because it now reads
   from t.value.routes (a computed) instead of a static array. */
const boardRoutes = computed(() => [...t.value.routes, ...t.value.routes]);

/* =========================================================
   Broken-image fallback with better error handling
   ========================================================= */
/* =========================================================
   Responsive images: le foto vengono da Unsplash con `w=1200`
   fisso — su un telefono da 380px di larghezza scarichiamo comunque
   l'immagine intera da 1200px inutilmente. Generiamo uno srcset con
   3 larghezze (Unsplash le genera al volo, nessun servizio extra
   richiesto) così il browser sceglie da solo il file più piccolo
   adatto allo schermo.
   ========================================================= */
function imgSrcset(url) {
  if (!url || !url.includes('images.unsplash.com')) return undefined;
  const w = (n) => url.replace(/([?&])w=\d+/, `$1w=${n}`);
  return `${w(480)} 480w, ${w(768)} 768w, ${w(1200)} 1200w`;
}
const CARD_IMG_SIZES = '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 380px';

// Set reattivo delle URL fallite — invece di sostituire il nodo <img> nel
// DOM manualmente (che lo staccava dal Virtual DOM di Vue: se la stessa
// foto tornava buona in un secondo momento — es. dopo la rotazione delle
// foto viaggi ogni 3s — Vue non aveva più un nodo da aggiornare e la
// scheda restava bloccata su "IMAGE NOT AVAILABLE" per sempre).
const brokenImgUrls = reactive(new Set());
function isImgBroken(url) {
  return brokenImgUrls.has(url);
}
function imgFallback(event) {
  const src = event.target?.currentSrc || event.target?.src;
  console.warn('Image failed to load:', src);
  if (src) brokenImgUrls.add(src);
}

/* =========================================================
   Hero search box → prefills the booking form below
   ========================================================= */
/* Mappa i 5 servizi (stessi id di bookingConstants.js nel pannello
   fleet). L'array serve solo a generare le 5 <option> del select di
   ricerca nell'hero — le etichette restano quelle di t['sN_title']. */
const SERVICE_ID_BY_INDEX = ['aeroporto', 'business', 'milano', 'evento', 'intercity'];
const serviceFormValues = SERVICE_ID_BY_INDEX;
const WHATSAPP_NUMBER = import.meta.env.VITE_WHATSAPP_NUMBER || '393520003122';
const search = reactive({ from: '', to: '', date: '', serviceIndex: 0 });

/* Oggetto "prefill" passato a <BookingForm>: ogni volta che viene
   riassegnato (oggetto nuovo), BookingForm lo recepisce e aggiorna
   i suoi campi interni — anche se si sceglie due volte la stessa città. */
const bookingPrefill = ref(null);

function submitSearch() {
  bookingPrefill.value = {
    tipoServizio: SERVICE_ID_BY_INDEX[search.serviceIndex] || 'altro',
    destinazione: search.to || undefined,
    dataOra: search.date ? `${search.date}T00:00` : undefined, // il campo è datetime-local
    zona: search.from || undefined,
    note: search.from ? `${t.value.note_from_prefix}: ${search.from}` : undefined,
  };
  scrollToContact();
}

function scrollToContact() {
  document.getElementById('contatti')?.scrollIntoView({ behavior: 'smooth' });
}

function selectCar(carName) {
  bookingPrefill.value = { note: `${t.value.note_car_prefix}: ${carName}` };
  scrollToContact();
}

function selectService(index) {
  bookingPrefill.value = {
    tipoServizio: SERVICE_ID_BY_INDEX[index] || 'altro',
    note: `${t.value.note_service_prefix}: ${t.value[services[index].titleKey]}`,
  };
  scrollToContact();
}

function selectTrip(cityName) {
  bookingPrefill.value = { tipoServizio: 'intercity', destinazione: cityName, note: `${t.value.note_trip_prefix}: ${cityName}` };
  scrollToContact();
}

function selectOtherItalyTrip() {
  bookingPrefill.value = { tipoServizio: 'intercity', note: t.value.note_other_italy };
  scrollToContact();
}

function selectCustomTrip() {
  bookingPrefill.value = { tipoServizio: 'intercity', note: t.value.note_custom };
  scrollToContact();
}

function onCardAction(trip) {
  if (trip.kind === 'otherItaly') return selectOtherItalyTrip();
  if (trip.kind === 'custom') return selectCustomTrip();
  return selectTrip(trip.name);
}

const waDefaultLink = computed(() => `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(t.value.wa_message)}`);


/* =========================================================
   Privacy modal + cookie banner
   ========================================================= */
const privacyOpen = ref(false);
function openPrivacyModal() {
  privacyOpen.value = true;
  document.body.style.overflow = 'hidden';
}
function closePrivacyModal() {
  privacyOpen.value = false;
  document.body.style.overflow = '';
}
onMounted(() => {
  // f_gdpr / cookie_text in the dict contain a raw onclick="openPrivacyModal()"
  // (ported as-is from the static HTML and rendered via v-html), so the
  // functions need to exist on window for that inline handler to find them.
  window.openPrivacyModal = openPrivacyModal;
  window.closePrivacyModal = closePrivacyModal;
});

const cookieVisible = ref(false);
onMounted(() => {
  let stored = null;
  try { stored = localStorage.getItem('cookie_ok'); } catch (e) { /* storage bloccato */ }
  if (stored === null) {
    setTimeout(() => (cookieVisible.value = true), 1200);
  }
});
function persistCookieChoice(value) {
  try { localStorage.setItem('cookie_ok', value); } catch (e) { /* storage bloccato */ }
  cookieVisible.value = false;
}
// Accettare e rifiutare sono due scelte distinte — il rifiuto NON deve
// registrare un consenso pieno (obbligo GDPR: consenso esplicito).
function acceptCookies() { persistCookieChoice('accepted'); }
function declineCookies() { persistCookieChoice('declined'); }

/* =========================================================
   Scroll-reveal directive (v-reveal)
   ========================================================= */
const vReveal = {
  mounted(el) {
    el.__revealIO = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          el.classList.add('active');
          el.__revealIO.disconnect();
          delete el.__revealIO;
        }
      });
    }, { threshold: 0.15 });
    el.__revealIO.observe(el);
  },
  unmounted(el) {
    el.__revealIO?.disconnect();
    delete el.__revealIO;
  },
};

const navOpen = ref(false);

/* =========================================================
   Fix: on some Android browsers (notably MIUI's built-in browser
   and some Chrome builds), `position: fixed` is calculated against
   the full layout viewport rather than the currently visible visual
   viewport. That leaves fixed elements like the WhatsApp button
   sitting below the fold — invisible — until the address bar
   collapses on scroll. We measure the gap with the visualViewport
   API and shift the button up by exactly that amount via a CSS
   variable, so it's always inside the visible area.
   ========================================================= */
function syncFabToViewport() {
  const vv = window.visualViewport;
  if (!vv) return;
  const hiddenBottom = window.innerHeight - (vv.height + vv.offsetTop);
  document.documentElement.style.setProperty('--fab-shift', `${Math.max(0, hiddenBottom)}px`);
}
onMounted(() => {
  syncFabToViewport();
  window.visualViewport?.addEventListener('resize', syncFabToViewport);
  window.visualViewport?.addEventListener('scroll', syncFabToViewport);
  window.addEventListener('orientationchange', syncFabToViewport);
});
onUnmounted(() => {
  window.visualViewport?.removeEventListener('resize', syncFabToViewport);
  window.visualViewport?.removeEventListener('scroll', syncFabToViewport);
  window.removeEventListener('orientationchange', syncFabToViewport);
});

/* =========================================================
   Hero griffin — subtle float/parallax on scroll (desktop
   only visually, since it sits absolutely in the hero's empty
   right-hand space there; on mobile it flows inline under the
   headline so the transform is harmless either way). Tracked
   with a rAF-throttled scroll listener to avoid layout thrash.
   ========================================================= */
const griffinOffset = ref(0);
let griffinTicking = false;
function updateGriffinOffset() {
  // Small, capped drift (max ~24px) so it reads as a gentle float
  // rather than a jarring parallax jump.
  griffinOffset.value = Math.min(24, window.scrollY * 0.06);
  griffinTicking = false;
}
function onScrollGriffin() {
  if (!griffinTicking) {
    window.requestAnimationFrame(updateGriffinOffset);
    griffinTicking = true;
  }
}
onMounted(() => {
  window.addEventListener('scroll', onScrollGriffin, { passive: true });
});
onUnmounted(() => {
  window.removeEventListener('scroll', onScrollGriffin);
});

/* =========================================================
   World clocks — orologi con i fusi orari dei mercati chiave
   (Golfo, Egitto). Aggiornati ogni secondo con un solo
   setInterval condiviso; l'offset UTC viene ricalcolato allo
   stesso tick cosi da restare corretto anche con eventuali
   cambi di ora legale.
   ========================================================= */
const worldClocks = [
  { cc: 'it', city: 'Milano', country: 'Italia', tz: 'Europe/Rome', base: true },
  { cc: 'sa', city: 'Riyadh', country: 'Arabia Saudita', tz: 'Asia/Riyadh' },
  { cc: 'ae', city: 'Dubai', country: 'Emirati Arabi Uniti', tz: 'Asia/Dubai' },
  { cc: 'ae', city: 'Abu Dhabi', country: 'Emirati Arabi Uniti', tz: 'Asia/Dubai' },
  { cc: 'eg', city: 'Il Cairo', country: 'Egitto', tz: 'Africa/Cairo' },
  { cc: 'qa', city: 'Doha', country: 'Qatar', tz: 'Asia/Qatar' },
  { cc: 'bh', city: 'Manama', country: 'Bahrain', tz: 'Asia/Bahrain' },
  { cc: 'om', city: 'Muscat', country: 'Oman', tz: 'Asia/Muscat' },
  { cc: 'ma', city: 'Rabat', country: 'Marocco', tz: 'Africa/Casablanca' },
  { cc: 'tn', city: 'Tunisi', country: 'Tunisia', tz: 'Africa/Tunis' },
  { cc: 'ly', city: 'Tripoli', country: 'Libia', tz: 'Africa/Tripoli' },
  { cc: 'dz', city: 'Algeri', country: 'Algeria', tz: 'Africa/Algiers' },
  { cc: 'jo', city: 'Amman', country: 'Giordania', tz: 'Asia/Amman' },
  { cc: 'iq', city: 'Baghdad', country: 'Iraq', tz: 'Asia/Baghdad' },
  { cc: 'lb', city: 'Beirut', country: 'Libano', tz: 'Asia/Beirut' },
  { cc: 'sy', city: 'Damasco', country: 'Siria', tz: 'Asia/Damascus' },
  { cc: 'kw', city: 'Kuwait City', country: 'Kuwait', tz: 'Asia/Kuwait' },
  { cc: 'us', city: 'New York', country: 'Stati Uniti', tz: 'America/New_York' },
  { cc: 'ru', city: 'Mosca', country: 'Russia', tz: 'Europe/Moscow' },
  { cc: 'ca', city: 'Toronto', country: 'Canada', tz: 'America/Toronto' },
  { cc: 'tr', city: 'Istanbul', country: 'Turchia', tz: 'Europe/Istanbul' },
  { cc: 'gb', city: 'Londra', country: 'Regno Unito', tz: 'Europe/London' },
  { cc: 'fr', city: 'Parigi', country: 'Francia', tz: 'Europe/Paris' },
  { cc: 'de', city: 'Francoforte', country: 'Germania', tz: 'Europe/Berlin' },
  { cc: 'es', city: 'Madrid', country: 'Spagna', tz: 'Europe/Madrid' },
];
// Lista raddoppiata (per il loop infinito del ticker) creata UNA SOLA VOLTA:
// aggiorniamo solo la proprieta `time` di ogni oggetto ad ogni tick, invece
// di ricreare l'intero array ogni secondo — evita di far ripatchare a Vue
// tutti i nodi del ticker in un colpo solo, cosa che causava un piccolo
// scatto (jank) nell'animazione CSS di scorrimento.
const tickerClocks = reactive(
  [...worldClocks, ...worldClocks].map(c => ({ cc: c.cc, city: c.city, base: c.base, time: '--:--:--' }))
);
let clocksTimer = null;
function tickWorldClocks() {
  worldClocks.forEach((c, i) => {
    const time = new Intl.DateTimeFormat('it-IT', {
      timeZone: c.tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    }).format(new Date());
    tickerClocks[i].time = time;
    tickerClocks[i + worldClocks.length].time = time;
  });
}
onMounted(() => {
  tickWorldClocks();
  clocksTimer = setInterval(tickWorldClocks, 1000);
});
onUnmounted(() => {
  if (clocksTimer) clearInterval(clocksTimer);
});
</script>

<template>
<noscript><div style="background:#B08D57;color:#0C0F12;padding:12px 28px;text-align:center;font-size:0.88rem;font-weight:500;">Questo sito richiede JavaScript per funzionare correttamente. Abilita JavaScript nel tuo browser.</div></noscript>

<header role="banner">
  <nav class="wrap" role="navigation" aria-label="Navigazione principale">
    <div class="logo">
      <img :src="griffinLogoSmall" alt="Grifone NCC - Logo autista privato Milano" width="101" height="120" style="height:38px;width:auto;" />
      <span class="logo-text">GRIFONE <b>NCC</b></span>
    </div>
    <div class="nav-links" :class="{ active: navOpen }">
      <a href="#servizi" @click="navOpen=false" aria-label="Vai alla sezione Servizi">{{ t.nav_services }}</a>
      <a href="#flotta" @click="navOpen=false" aria-label="Vai alla sezione Flotta">{{ t.nav_fleet }}</a>
      <a href="#video" @click="navOpen=false" aria-label="Vai alla sezione Video">{{ t.nav_video }}</a>
      <a href="#viaggi" @click="navOpen=false" aria-label="Vai alla sezione Viaggi">{{ t.nav_trips }}</a>
      <a href="#contatti" @click="navOpen=false" aria-label="Vai alla sezione Contatti">{{ t.nav_contact }}</a>
    </div>
    <div style="display:flex;gap:10px;align-items:center;">
      <div class="lang-switch" role="group" aria-label="Selezione lingua / Language selection / اختيار اللغة">
        <button v-for="l in ['it','en','ar']" :key="l" :data-lang="l"
                :class="{ active: currentLang===l }" :aria-pressed="currentLang===l"
                @click="setLang(l)">{{ l.toUpperCase() }}</button>
      </div>
      <button class="menu-toggle" aria-label="Apri menu mobile" @click="navOpen = !navOpen">☰</button>
    </div>
  </nav>
</header>

<div class="board">
  <div class="board-inner">
    <span v-for="(r, i) in boardRoutes" :key="i" class="board-item">
      <span class="dot"></span><b>{{ r.code }}</b> {{ r.label }}
    </span>
  </div>
</div>

<main id="main-content">
<section class="hero wrap" aria-labelledby="hero-title">
  <div class="hero-content">
    <div class="hero-eyebrow reveal delay-1" v-reveal>{{ t.hero_eyebrow }}</div>
    <h1 id="hero-title" class="reveal delay-2" v-reveal v-html="t.hero_title"></h1>
    <p class="sub reveal delay-3" v-reveal>{{ t.hero_sub }}</p>

    <img
      :src="grifoneHero"
      alt="Grifone NCC"
      class="hero-griffin reveal delay-3"
      v-reveal
      loading="lazy"
      fetchpriority="low"
      width="400"
      height="261"
      :style="{ '--griffin-float': griffinOffset + 'px' }"
    >

    <div class="cta-row reveal delay-4" v-reveal>
      <a href="#contatti" class="btn btn-primary">{{ t.hero_cta1 }}</a>
      <a href="#servizi" class="btn btn-ghost">{{ t.hero_cta2 }}</a>
    </div>
  </div>

  <div class="search-box reveal delay-5" v-reveal>
    <div class="search-grid">
      <div class="search-field">
        <label>{{ t.search_from }}</label>
        <input type="text" v-model="search.from" placeholder="—">
      </div>
      <div class="search-field">
        <label>{{ t.search_to }}</label>
        <input type="text" v-model="search.to" placeholder="—">
      </div>
      <div class="search-field">
        <label>{{ t.search_date }}</label>
        <input type="date" v-model="search.date">
      </div>
      <div class="search-field">
        <label>{{ t.search_service }}</label>
        <select v-model="search.serviceIndex">
          <option v-for="(v,i) in serviceFormValues" :key="v" :value="i">{{ t['s'+(i+1)+'_title'] }}</option>
        </select>
      </div>
      <button class="btn btn-primary" @click="submitSearch">{{ t.search_submit }}</button>
    </div>
  </div>
</section>

<section class="stats wrap" aria-label="Statistiche servizio Grifone NCC">
  <div class="stat"><b>24/7</b><span>{{ t.stat1 }}</span></div>
  <div class="stat"><b>LOMBARDIA → ITA/EU</b><span>{{ t.stat2 }}</span></div>
  <div class="stat"><b>&lt;8 min</b><span>{{ t.stat3 }}</span></div>
  <div class="stat"><b>IT · EN · AR</b><span>{{ t.stat4 }}</span></div>
</section>

<section class="section wrap" id="servizi" aria-labelledby="services-title">
  <div class="section-head reveal" v-reveal>
    <h2 id="services-title">{{ t.services_title }}</h2>
    <div class="tag mono">{{ t.services_tag }}</div>
  </div>
  <div class="services" role="list" aria-label="Lista servizi NCC">
    <article class="stub reveal" v-reveal v-for="(s, i) in services" :key="s.code" role="listitem">
      <div class="stub-code">{{ s.code }}</div>
      <h3>{{ t[s.titleKey] }}</h3>
      <p>{{ t[s.descKey] }}</p>
      <div class="stub-foot">
        <span v-if="!s.airport">{{ s.tag1 }}</span>
        <nav v-else class="stub-airport-links" aria-label="Transfer aeroporti">
          <a href="/aeroporti/malpensa">{{ airportLinksLabel.malpensa }}</a>
          <a href="/aeroporti/linate">{{ airportLinksLabel.linate }}</a>
          <a href="/aeroporti/bergamo">{{ airportLinksLabel.bergamo }}</a>
        </nav>
        <b>{{ s.tag2 }}</b>
      </div>
      <button class="stub-btn" @click="selectService(i)" :aria-label="`${t.btn_book_service}: ${t[s.titleKey]}`">{{ t.btn_book_service }}</button>
    </article>
  </div>
</section>

<section class="section wrap" id="flotta" aria-labelledby="fleet-title">
  <div class="section-head reveal" v-reveal>
    <h2 id="fleet-title">{{ t.fleet_title }}</h2>
    <div class="tag mono">{{ t.fleet_tag }}</div>
  </div>
  <div class="fleet" role="list" aria-label="Flotta Mercedes premium">
    <article class="car reveal" v-reveal v-for="c in fleet" :key="c.code" role="listitem">
      <img v-if="!isImgBroken(c.photo)" class="car-photo" :src="c.photo" :srcset="imgSrcset(c.photo)" :sizes="CARD_IMG_SIZES" :alt="c.alt" width="380" height="200" loading="lazy" decoding="async" @error="imgFallback">
      <div v-else class="car-photo broken" role="img" :aria-label="t.img_unavailable || 'IMAGE NOT AVAILABLE'">{{ t.img_unavailable || 'IMAGE NOT AVAILABLE' }}</div>
      <div class="car-body">
        <div class="code">{{ c.code }}</div>
        <h4>{{ c.name }}</h4>
        <p>{{ t[c.descKey] }}</p>
        <button class="car-btn" @click="selectCar(c.name)" :aria-label="`Prenota ${c.name}`">{{ t.btn_book_car }}</button>
      </div>
    </article>
  </div>
</section>

<section class="section wrap" id="video" aria-labelledby="video-title">
  <div class="section-head reveal" v-reveal>
    <h2 id="video-title">{{ t.video_title }}</h2>
    <div class="tag mono">{{ t.video_tag }}</div>
  </div>
  <div class="video-gallery video-gallery--single">
    <video class="promo-video" controls muted playsinline preload="metadata" aria-label="Video promozionale Grifone NCC - Servizio autista privato Milano">
      <source src="https://res.cloudinary.com/nfurbx69/video/upload/v1786929691/video5769265625520152920.mp4" type="video/mp4">
    </video>
  </div>
</section>

<section class="section wrap" id="viaggi" aria-labelledby="trips-title">
  <div class="section-head reveal" v-reveal>
    <h2 id="trips-title">{{ t.trips_title }}</h2>
    <div class="tag mono">{{ t.trips_tag }}</div>
  </div>
  <div class="fleet" role="list" aria-label="Viaggi consigliati con autista privato">
    <article class="car reveal" v-reveal v-for="trip in trips" :key="trip.code" role="listitem">
      <img v-if="!isImgBroken(tripPhoto(trip))" class="car-photo" :src="tripPhoto(trip)" :srcset="imgSrcset(tripPhoto(trip))" :sizes="CARD_IMG_SIZES" :alt="trip.alt || t[trip.titleKey]" width="380" height="200" loading="lazy" decoding="async" @error="imgFallback">
      <div v-else class="car-photo broken" role="img" :aria-label="t.img_unavailable || 'IMAGE NOT AVAILABLE'">{{ t.img_unavailable || 'IMAGE NOT AVAILABLE' }}</div>
      <div class="car-body">
        <div class="code">{{ trip.code }}</div>
        <h4>{{ t[trip.titleKey] }}</h4>
        <p>{{ t[trip.descKey] }}</p>
        <button class="car-btn" @click="onCardAction(trip)" :aria-label="`Richiedi viaggio verso ${trip.name || t[trip.titleKey]}`">
          {{ trip.kind === 'otherItaly' ? t.btn_other_italy : (trip.kind === 'custom' ? t.btn_custom_trip : t.btn_book_trip) }}
        </button>
      </div>
    </article>
  </div>
</section>

<section class="section wrap" id="contatti" aria-labelledby="contact-title">
  <div class="section-head reveal" v-reveal>
    <h2 id="contact-title">{{ t.contact_title }}</h2>
    <div class="tag mono">{{ t.contact_tag }}</div>
  </div>
  <div class="contact-grid">
    <div class="booking-form-container">
      <BookingForm :db="db" :whatsapp-number="WHATSAPP_NUMBER" :lang="currentLang" brand-name="Grifone NCC" :prefill="bookingPrefill" />
    </div>
    <div class="contact-info">
      <div class="info-line">
        <span>{{ t.i_phone }}</span>
        <span><a :href="`tel:+${WHATSAPP_NUMBER}`" style="color:var(--brass-bright);text-decoration:none;" aria-label="Chiama il numero +39 352 000 3122">+39 352 000 3122</a></span>
      </div>
      <div class="info-line">
        <span>{{ t.i_whatsapp }}</span>
        <span><a :href="`https://wa.me/${WHATSAPP_NUMBER}`" target="_blank" rel="noopener" style="color:var(--brass-bright);text-decoration:none;" aria-label="Scrivi su WhatsApp al numero +39 352 000 3122">+39 352 000 3122</a></span>
      </div>
      <div class="info-line">
        <span>{{ t.i_mail }}</span>
        <span><a href="mailto:amedeo018@libero.it" style="color:var(--brass-bright);text-decoration:none;" aria-label="Invia email a amedeo018@libero.it">amedeo018@libero.it</a></span>
      </div>
      <div class="info-line">
        <span>{{ t.i_area }}</span>
        <span>LOMBARDIA → ITALIA / EUROPA</span>
      </div>
      <div class="info-line">
        <span>{{ t.i_hours }}</span>
        <span>24/7</span>
      </div>

      <div class="payments-box" role="region" aria-label="Metodi di pagamento accettati">
        <div class="payments-title">{{ t.pay_title }}</div>
        <div class="payment-badges" role="list">
          <div class="pay-card" role="listitem">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>
            <span>{{ t.pay_cash }}</span>
          </div>
          <div class="pay-card" role="listitem">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
            <span>{{ t.pay_card }}</span>
          </div>
          <div class="pay-card" role="listitem">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/><path d="M8 12l3 3 5-5"/></svg>
            <span>{{ t.pay_paypal }}</span>
          </div>
          <div class="pay-card" role="listitem">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9 21v-4h6v4"/></svg>
            <span>{{ t.pay_bank }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- ⚠️ Sezione recensioni rimossa: recensioni inventate = rischio legale (Codice
     del Consumo) e di reputazione. Rimettila quando avrai recensioni vere. -->

<footer class="wrap" role="contentinfo">
  <div class="footer-inner">
    <div class="footer-col">
      <h4>{{ t.foot_nav }}</h4>
      <nav aria-label="Navigazione footer">
        <a href="#servizi">{{ t.nav_services }}</a>
        <a href="#flotta">{{ t.nav_fleet }}</a>
        <a href="#video">{{ t.nav_video }}</a>
        <a href="#viaggi">{{ t.nav_trips }}</a>
        <a href="#contatti">{{ t.nav_contact }}</a>
      </nav>
    </div>
    <div class="footer-col">
      <h4>{{ t.foot_legal }}</h4>
      <nav aria-label="Link legali">
        <a href="#" @click.prevent="openPrivacyModal" aria-label="Apri informativa privacy">{{ t.foot_privacy }}</a>
        <a href="#" @click.prevent="openPrivacyModal" aria-label="Apri informativa cookie">{{ t.foot_cookies }}</a>
        <a href="#" @click.prevent="openPrivacyModal" aria-label="Apri termini e condizioni">{{ t.foot_terms }}</a>
      </nav>
    </div>
    <div class="footer-col">
      <h4>{{ t.foot_contact_title }}</h4>
      <nav aria-label="Contatti diretti">
        <a :href="`tel:+${WHATSAPP_NUMBER}`" aria-label="Chiama il numero +39 352 000 3122">+39 352 000 3122</a>
        <a href="mailto:amedeo018@libero.it" aria-label="Invia email a amedeo018@libero.it">amedeo018@libero.it</a>
        <a :href="`https://wa.me/${WHATSAPP_NUMBER}`" target="_blank" rel="noopener" aria-label="Scrivi su WhatsApp">WhatsApp</a>
      </nav>
    </div>
  </div>

  <div class="clocks-ticker" role="region" aria-label="Orari nel mondo">
    <div class="clocks-ticker-inner">
      <span v-for="(c, i) in tickerClocks" :key="i" class="clock-ticker-item" :class="{ 'is-base': c.base }">
        <span class="clock-ticker-dot" v-if="c.base"></span>
        <img class="clock-flag-img" :src="`https://flagcdn.com/20x15/${c.cc}.png`" :srcset="`https://flagcdn.com/40x30/${c.cc}.png 2x`" width="20" height="15" :alt="c.city" loading="lazy" />
        <b>{{ c.city }}</b> {{ c.time }}
      </span>
    </div>
  </div>

  <div class="footer-bottom">
    <!-- ⚠️ TODO: sostituire con la Partita IVA reale prima di pubblicare online -->
    <span>© 2026 Grifone NCC · P.IVA XXXXXXXXXXX</span>
    <span>{{ t.foot_note }}</span>
  </div>
</footer>
</main>

<a class="whatsapp-fab" :href="waDefaultLink" target="_blank" rel="noopener" aria-label="Scrivici su WhatsApp">
  <svg viewBox="0 0 32 32" fill="white" aria-hidden="true"><path d="M16.001 3C9.373 3 4 8.373 4 15c0 2.386.703 4.61 1.912 6.478L4 29l7.702-1.874A11.94 11.94 0 0016.001 27C22.629 27 28 21.627 28 15S22.629 3 16.001 3zm0 21.818a9.77 9.77 0 01-4.98-1.362l-.357-.212-4.573 1.112 1.135-4.457-.233-.366A9.78 9.78 0 016.182 15c0-5.42 4.4-9.818 9.819-9.818 5.418 0 9.818 4.398 9.818 9.818 0 5.419-4.4 9.818-9.818 9.818zm5.386-7.35c-.295-.148-1.746-.862-2.017-.96-.271-.099-.469-.148-.667.148-.197.295-.764.96-.937 1.157-.172.198-.345.222-.64.074-.295-.148-1.246-.459-2.373-1.463-.877-.782-1.47-1.748-1.642-2.043-.172-.295-.018-.454.13-.601.134-.133.296-.345.444-.518.148-.172.197-.295.296-.492.099-.198.05-.37-.025-.518-.074-.148-.667-1.606-.914-2.2-.24-.579-.485-.5-.667-.51-.172-.008-.37-.01-.568-.01a1.09 1.09 0 00-.79.37c-.271.296-1.036 1.013-1.036 2.47 0 1.457 1.06 2.865 1.208 3.063.148.198 2.086 3.186 5.053 4.468.706.305 1.256.487 1.685.623.708.225 1.352.193 1.861.117.568-.085 1.746-.714 1.993-1.403.246-.69.246-1.28.172-1.403-.074-.123-.271-.197-.567-.345z"/></svg>
</a>

<!-- PRIVACY MODAL -->
<div class="modal-overlay" :class="{ open: privacyOpen }" @click.self="closePrivacyModal" role="dialog" aria-modal="true" aria-labelledby="privacy-title">
  <div class="modal-box" role="document">
    <button class="modal-close" @click="closePrivacyModal" aria-label="Chiudi la finestra privacy">&#10005;</button>
    <h3 id="privacy-title">{{ t.privacy_title }}</h3>
    <p>{{ t.privacy_p1 }}</p>
    <p>{{ t.privacy_p2 }}</p>
    <p v-html="t.privacy_p3"></p>
    <p v-html="t.privacy_p4"></p>
    <ul>
      <li>{{ t.privacy_l1 }}</li>
      <li>{{ t.privacy_l2 }}</li>
    </ul>
    <p>{{ t.privacy_p5 }}</p>
  </div>
</div>

<!-- COOKIE BANNER -->
<div class="cookie-banner" :class="{ visible: cookieVisible }" role="alert" aria-live="polite">
  <span v-html="t.cookie_text"></span>
  <div class="cookie-btns">
    <button @click="acceptCookies" aria-label="Accetta i cookie">{{ t.cookie_accept }}</button>
    <button @click="declineCookies" aria-label="Rifiuta i cookie non necessari">{{ t.cookie_dismiss }}</button>
  </div>
</div>
</template>


<style>

  :root{
    --ink:#0C0F12;
    --surface:#14181D;
    --surface-2:#1B2027;
    --brass:#B08D57;
    --brass-bright:#D9B77F;
    --paper:#EDEAE3;
    --steel:#8B93AA;
    --line:#262B31;
  }
  *{margin:0;padding:0;box-sizing:border-box;}
  html{scroll-behavior:smooth;overflow-x:hidden;max-width:100vw;}
  body{
    background:var(--ink);
    color:var(--paper);
    font-family:'Work Sans',sans-serif;
    font-weight:300;
    line-height:1.5;
    -webkit-font-smoothing:antialiased;
    overflow-x:hidden;
    max-width:100vw;
    position:relative;
  }
  a{color:inherit;text-decoration:none;}
  .mono{font-family:'IBM Plex Mono',monospace;}
  html[dir="rtl"] body{font-family:'Tajawal','Work Sans',sans-serif;}
  html[dir="rtl"] .mono,html[dir="rtl"] .stub-code,html[dir="rtl"] .board-item,html[dir="rtl"] .info-line span:last-child{font-family:'IBM Plex Mono','Tajawal',monospace;}
  html[dir="rtl"] h1,html[dir="rtl"] h2,html[dir="rtl"] .car h4,html[dir="rtl"] .stub h3,html[dir="rtl"] .stat b{font-family:'Cairo','Fraunces',serif;}
  html[dir="rtl"] h1{line-height:1.25;}
  html[dir="rtl"] h1 em{font-style:normal;}
  html[dir="rtl"] .logo-text{font-family:'Cairo',serif;}
  html[dir="rtl"] input,html[dir="rtl"] select,html[dir="rtl"] textarea{font-family:'Tajawal',sans-serif;}
  .wrap{max-width:1180px;margin:0 auto;padding:0 28px;}

  /* NAV */
  header{
    position:sticky;top:0;z-index:50;
    background:rgba(12,15,18,0.88);
    -webkit-backdrop-filter:blur(10px);
    backdrop-filter:blur(10px);
    border-bottom:1px solid var(--line);
  }
  nav{display:flex;align-items:center;justify-content:space-between;padding:18px 28px;max-width:1180px;margin:0 auto;}
  .logo{display:flex;align-items:center;gap:10px;}
  .logo-mark{width:34px;height:auto;flex-shrink:0;}
  .logo-text{font-family:'Fraunces',serif;font-size:1.3rem;font-weight:600;letter-spacing:0.02em;}
  .logo-text b{color:var(--brass);font-weight:600;}
  .nav-links{display:flex;gap:32px;font-size:0.85rem;letter-spacing:0.04em;text-transform:uppercase;}
  .nav-links a{color:var(--steel);transition:color .2s;}
  .nav-links a:hover{color:var(--paper);}
  .lang-switch{display:flex;gap:6px;font-size:0.72rem;}
  .lang-switch button{
    background:none;border:1px solid var(--line);color:var(--steel);
    padding:5px 10px;cursor:pointer;font-family:'IBM Plex Mono',monospace;
    letter-spacing:0.05em;transition:all .2s;
  }
  .lang-switch button.active,.lang-switch button:hover{border-color:var(--brass);color:var(--brass-bright);}
  .menu-toggle{display:none;background:none;border:none;color:var(--paper);font-size:1.4rem;cursor:pointer;}

  /* DEPARTURE BOARD TICKER */
  .board{
    background:var(--surface);
    border-bottom:1px solid var(--line);
    overflow:hidden;
    padding:10px 0;
  }
  .board-inner{display:flex;gap:0;animation:scroll 28s linear infinite;white-space:nowrap;}
  .board-item{
    display:inline-flex;align-items:center;gap:14px;
    padding:0 28px;border-right:1px solid var(--line);
    font-family:'IBM Plex Mono',monospace;font-size:0.78rem;color:var(--steel);
  }
  .board-item b{color:var(--brass-bright);font-weight:500;}
  .dot{width:5px;height:5px;border-radius:50%;background:var(--brass);animation:pulse 1.6s ease-in-out infinite;}
  @keyframes pulse{0%,100%{opacity:0.3;}50%{opacity:1;}}
  @keyframes scroll{0%{transform:translateX(0);}100%{transform:translateX(-50%);}}
  html[dir="rtl"] .board-inner{animation-name:scrollrtl;}
  @keyframes scrollrtl{0%{transform:translateX(0);}100%{transform:translateX(50%);}}

  /* REVEAL ON SCROLL */
  .reveal{opacity:0;transform:translateY(28px);transition:opacity .7s cubic-bezier(.2,1,.3,1),transform .7s cubic-bezier(.2,1,.3,1);will-change:transform,opacity;}
  .reveal.active{opacity:1;transform:translateY(0);}
  .delay-1{transition-delay:.1s;} .delay-2{transition-delay:.2s;} .delay-3{transition-delay:.3s;} .delay-4{transition-delay:.4s;}
  .services .stub:nth-child(1){transition-delay:.05s;} .services .stub:nth-child(2){transition-delay:.15s;}
  .services .stub:nth-child(3){transition-delay:.25s;} .services .stub:nth-child(4){transition-delay:.35s;}
  .services .stub:nth-child(5){transition-delay:.45s;}
  .fleet .car:nth-child(1){transition-delay:.05s;} .fleet .car:nth-child(2){transition-delay:.2s;} .fleet .car:nth-child(3){transition-delay:.35s;}

  /* HERO */
  .hero{padding:110px 0 90px;position:relative;}
  .hero-eyebrow{
    font-family:'IBM Plex Mono',monospace;font-size:0.75rem;color:var(--brass);
    letter-spacing:0.15em;text-transform:uppercase;margin-bottom:22px;
    display:flex;align-items:center;gap:10px;
  }
  .hero-eyebrow::before{content:'';width:26px;height:1px;background:var(--brass);}
  h1{
    font-family:'Fraunces',serif;font-weight:600;
    font-size:clamp(2.4rem,6vw,4.4rem);line-height:1.05;
    max-width:820px;letter-spacing:-0.01em;
  }
  h1 em{font-style:italic;color:var(--brass-bright);font-weight:500;}
  .hero p.sub{
    max-width:480px;color:var(--steel);font-size:1.05rem;margin-top:26px;font-weight:300;
  }
  .cta-row{display:flex;gap:16px;margin-top:40px;flex-wrap:wrap;}

  /* HERO GRIFFIN — hidden on mobile entirely; shown only on
     desktop, positioned inside .hero-content only (headline
     block), NOT the full hero section — so it never reaches
     down into .search-box below. Subtle scroll-driven float via
     --griffin-float (set from JS). */
  .hero-content{position:relative;z-index:2;}
  .hero-griffin{
    display:none;
  }
  @media(min-width:901px){
    .hero-griffin{
      display:block;
      position:absolute;top:30px;right:0;width:220px;margin:0;z-index:0;
      opacity:.92;pointer-events:none;user-select:none;
      transform:translateY(calc(-1 * var(--griffin-float,0px)));
      transition:transform .15s linear;
    }
    .hero-eyebrow,.hero h1,.hero p.sub,.hero .cta-row{
      position:relative;z-index:1;
    }
    html[dir="rtl"] .hero-griffin{
      right:auto;left:0;transform:translateY(calc(-1 * var(--griffin-float,0px)));
    }
  }

  .search-box{margin-top:50px;background:var(--surface);border:1px solid var(--line);padding:22px;}
  .search-grid{display:grid;grid-template-columns:1fr 1fr 1fr 1fr auto;gap:14px;}
  .search-field{display:flex;flex-direction:column;gap:6px;}
  .search-field label{
    font-family:'IBM Plex Mono',monospace;font-size:0.68rem;color:var(--steel);
    text-transform:uppercase;letter-spacing:0.06em;
  }
  .search-field input,.search-field select{
    background:var(--surface-2);border:1px solid var(--line);color:var(--paper);
    padding:12px 14px;font-family:inherit;font-size:0.9rem;width:100%;
  }
  html[dir="rtl"] .search-field input,html[dir="rtl"] .search-field select{font-family:'Tajawal',sans-serif;}
  .search-field input:focus,.search-field select:focus{outline:none;border-color:var(--brass);}
  .search-box .btn{white-space:nowrap;align-self:end;}
  @media(max-width:900px){
    .search-grid{grid-template-columns:1fr 1fr;}
    .search-box .btn{grid-column:1/-1;}
  }
  .btn{
    padding:15px 30px;font-size:0.85rem;letter-spacing:0.05em;text-transform:uppercase;
    cursor:pointer;transition:all .25s;border:1px solid transparent;
  }
  .btn-primary{background:var(--brass);color:var(--ink);font-weight:500;}
  .btn-primary:hover{background:var(--brass-bright);}
  .btn-ghost{border-color:var(--line);color:var(--paper);}
  .btn-ghost:hover{border-color:var(--brass);}

  /* SECTION HEAD */
  .section{padding:90px 0;border-top:1px solid var(--line);scroll-margin-top:72px;}
  .stats{scroll-margin-top:72px;}
  .hero{scroll-margin-top:72px;}
  .section-head{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:52px;flex-wrap:wrap;gap:20px;}
  .section-head h2{font-family:'Fraunces',serif;font-size:clamp(1.8rem,3.2vw,2.6rem);font-weight:500;}
  .section-head .tag{font-family:'IBM Plex Mono',monospace;font-size:0.75rem;color:var(--steel);max-width:320px;}

  /* SERVICES — boarding-pass stubs */
  .services{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:22px;}
  .stub{
    background:var(--surface);border:1px solid var(--line);
    position:relative;padding:26px 24px 22px;
    transition:border-color .25s, transform .25s;
  }
  .stub:hover{border-color:var(--brass);transform:translateY(-3px);}
  .stub::after{
    content:'';position:absolute;left:0;right:0;bottom:120px;
    border-top:1px dashed var(--line);
  }
  .stub-code{font-family:'IBM Plex Mono',monospace;font-size:0.72rem;color:var(--brass);letter-spacing:0.1em;margin-bottom:14px;}
  .stub h3{font-family:'Fraunces',serif;font-size:1.25rem;font-weight:500;margin-bottom:10px;}
  .stub p{color:var(--steel);font-size:0.9rem;margin-bottom:26px;}
  .stub-foot{display:flex;justify-content:space-between;font-family:'IBM Plex Mono',monospace;font-size:0.72rem;color:var(--steel);padding-top:12px;}
  .stub-foot b{color:var(--paper);}
  .stub-airport-links{display:flex;gap:10px;flex-wrap:wrap;}
  .stub-airport-links a{color:var(--steel);text-decoration:underline;text-underline-offset:2px;transition:color .2s;}
  .stub-airport-links a:hover{color:var(--brass-bright);}
  .stub-btn{
    margin-top:18px;width:100%;background:none;border:1px solid var(--line);color:var(--brass-bright);
    padding:10px 18px;font-size:0.78rem;letter-spacing:0.04em;text-transform:uppercase;
    cursor:pointer;transition:all .2s;font-family:'Work Sans',sans-serif;
  }
  .stub-btn:hover{border-color:var(--brass);background:rgba(176,141,87,0.08);}

  /* FLEET */
  .fleet{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:1px;background:var(--line);border:1px solid var(--line);}
  .car{background:var(--ink);}
  .car-photo{width:100%;height:200px;object-fit:cover;display:block;filter:grayscale(15%) contrast(1.05);background:var(--surface-2);transition:opacity .5s ease,filter .3s ease;}
  .car-photo.broken{display:flex;align-items:center;justify-content:center;font-family:'IBM Plex Mono',monospace;font-size:0.7rem;color:var(--steel);letter-spacing:0.08em;}
  .car-photo:hover{filter:grayscale(0%) contrast(1.1);}
  .car-body{padding:26px 28px 34px;}
  .car .code{font-family:'IBM Plex Mono',monospace;color:var(--brass);font-size:0.72rem;letter-spacing:0.1em;}
  .car h4{font-family:'Fraunces',serif;font-size:1.4rem;font-weight:500;margin:10px 0 8px;}
  .car p{color:var(--steel);font-size:0.88rem;}
  .car-btn{
    margin-top:18px;background:none;border:1px solid var(--line);color:var(--brass-bright);
    padding:10px 18px;font-size:0.78rem;letter-spacing:0.04em;text-transform:uppercase;
    cursor:pointer;transition:all .2s;font-family:'Work Sans',sans-serif;
  }
  .car-btn:hover{border-color:var(--brass);background:rgba(176,141,87,0.08);}

  /* STRIP STATS */
  .stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));border-top:1px solid var(--line);border-bottom:1px solid var(--line);}
  .stat{padding:34px 28px;border-left:1px solid var(--line);}
  .stat:first-child{border-left:none;}
  .stat b{font-family:'Fraunces',serif;font-size:2.2rem;color:var(--brass-bright);display:block;font-weight:500;}
  .stat span{font-family:'IBM Plex Mono',monospace;font-size:0.72rem;color:var(--steel);text-transform:uppercase;letter-spacing:0.06em;}

  /* CONTACT */
  .contact-grid{display:grid;grid-template-columns:1.1fr 0.9fr;gap:60px;}
  .booking-form-container{display:flex;flex-direction:column;}
  .contact-info{display:flex;flex-direction:column;gap:8px;}
  .contact-grid form{display:flex;flex-direction:column;gap:16px;}
  input,select,textarea{
    background:var(--surface);border:1px solid var(--line);color:var(--paper);
    padding:14px 16px;font-family:'Work Sans',sans-serif;font-size:0.92rem;
  }
  input:focus,select:focus,textarea:focus{outline:none;border-color:var(--brass);}
  textarea{min-height:100px;resize:vertical;}
  .gdpr-box{display:flex;align-items:flex-start;gap:10px;font-size:0.78rem;color:var(--steel);margin-top:2px;}
  .gdpr-box input[type="checkbox"]{accent-color:var(--brass);margin-top:3px;cursor:pointer;flex-shrink:0;}
  .form-alert{
    display:none;background:rgba(37,211,102,0.12);border:1px solid #25D366;
    color:var(--paper);padding:14px;font-size:0.88rem;
  }
  .phone-row{display:flex;gap:8px;}
  .phone-row input{flex:1;}

  /* Custom country-code dropdown: replaces the native <select> so we can
     show real flag images (native <select> can't render images in its
     options at all, and emoji flags rendered unreliably on Windows). */
  .country-select{position:relative;flex:0 0 108px;}
  .country-select-btn{
    display:flex;align-items:center;gap:6px;width:100%;height:100%;
    background:var(--surface);border:1px solid var(--line);color:var(--paper);
    padding:14px 8px;font-family:'Work Sans',sans-serif;font-size:0.88rem;
    cursor:pointer;
  }
  .country-select-btn:hover,.country-select.open .country-select-btn{border-color:var(--brass);}
  .country-flag{border-radius:2px;display:block;flex-shrink:0;}
  .country-chevron{margin-left:auto;color:var(--steel);flex-shrink:0;}
  .country-select.open .country-chevron{transform:rotate(180deg);}
  .country-dropdown{
    position:absolute;top:calc(100% + 6px);left:0;z-index:50;
    width:280px;max-width:80vw;background:var(--surface-2);
    border:1px solid var(--line);box-shadow:0 12px 32px rgba(0,0,0,0.5);
  }
  html[dir="rtl"] .country-dropdown{left:auto;right:0;}
  .country-search{
    width:100%;padding:12px 14px;background:var(--surface);border:none;
    border-bottom:1px solid var(--line);color:var(--paper);
    font-family:'Work Sans',sans-serif;font-size:0.88rem;
  }
  .country-search:focus{outline:none;}
  .country-list{max-height:260px;overflow-y:auto;}
  .country-item{
    display:flex;align-items:center;gap:10px;width:100%;
    padding:9px 14px;background:none;border:none;color:var(--paper);
    font-family:'Work Sans',sans-serif;font-size:0.86rem;text-align:left;
    cursor:pointer;
  }
  html[dir="rtl"] .country-item{text-align:right;}
  .country-item img{border-radius:2px;flex-shrink:0;}
  .country-item:hover{background:rgba(176,141,87,0.12);}
  .country-item-name{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
  .country-item-code{color:var(--steel);font-family:'IBM Plex Mono',monospace;font-size:0.8rem;flex-shrink:0;}
  .country-empty{padding:16px 14px;color:var(--steel);font-size:0.86rem;text-align:center;}

  .info-line{display:flex;justify-content:space-between;padding:16px 0;border-bottom:1px solid var(--line);font-size:0.92rem;}
  .info-line span:first-child{color:var(--steel);}
  .info-line span:last-child{font-family:'IBM Plex Mono',monospace;color:var(--brass-bright);}
  .payments-box{margin-top:28px;padding-top:20px;border-top:1px dashed var(--line);}
  .payments-title{font-family:'IBM Plex Mono',monospace;font-size:0.75rem;color:var(--steel);margin-bottom:14px;text-transform:uppercase;letter-spacing:0.08em;}
  .payment-badges{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
  .pay-card{
    background:var(--surface);border:1px solid var(--line);color:var(--paper);
    padding:10px 14px;font-size:0.78rem;font-family:'IBM Plex Mono',monospace;
    display:flex;align-items:center;gap:10px;border-radius:4px;
    transition:border-color .25s,background .25s;
  }
  .pay-card:hover{border-color:var(--brass);background:rgba(176,141,87,0.06);}
  .pay-card svg{width:22px;height:22px;flex-shrink:0;color:var(--brass);}
  .pay-card span{white-space:nowrap;}
  @media(max-width:760px){
    .payment-badges{grid-template-columns:1fr 1fr;gap:6px;}
    .pay-card{padding:8px 10px;font-size:0.72rem;}
    .pay-card svg{width:18px;height:18px;}
  }

  /* VIDEO GALLERY */
  .video-gallery{
    display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:22px;
  }
  .video-gallery--single{
    grid-template-columns:1fr;max-width:420px;margin:0 auto;
  }
  .promo-video{
    width:min(100%,calc(75vh * 9 / 16));max-width:420px;
    aspect-ratio:9/16;object-fit:cover;display:block;margin:0 auto;
    background:var(--surface);border:1px solid var(--line);border-radius:4px;
    transition:border-color .25s;
  }
  .promo-video:hover{border-color:var(--brass);}
  @media(max-width:760px){
    .video-gallery{grid-template-columns:1fr;}
    .promo-video{width:min(100%,calc(65vh * 9 / 16));}
  }

  /* TESTIMONIALS */
  .testimonials{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:22px;}
  .testi{
    background:var(--surface);border:1px solid var(--line);padding:28px 26px;
    transition:border-color .25s;
  }
  .testi:hover{border-color:var(--brass);}
  .testi-stars{color:var(--brass-bright);font-size:0.9rem;letter-spacing:2px;margin-bottom:14px;}
  .testi blockquote{color:var(--paper);font-size:0.92rem;line-height:1.65;margin-bottom:18px;font-style:italic;}
  .testi-author{display:flex;justify-content:space-between;align-items:center;font-size:0.82rem;}
  .testi-author b{color:var(--paper);font-weight:500;}
  .testi-author span{color:var(--steel);font-family:'IBM Plex Mono',monospace;font-size:0.72rem;}

  /* COOKIE BANNER */
  .cookie-banner{
    position:fixed;bottom:0;left:0;right:0;z-index:700;
    background:var(--surface);border-top:1px solid var(--line);
    padding:18px 28px;display:flex;align-items:center;justify-content:space-between;
    gap:16px;font-size:0.82rem;color:var(--steel);
    transform:translateY(100%);transition:transform .4s cubic-bezier(.2,1,.3,1);
  }
  .cookie-banner.visible{transform:translateY(0);}
  .cookie-banner a{color:var(--brass-bright);text-decoration:underline;}
  .cookie-btns{display:flex;gap:10px;flex-shrink:0;}
  .cookie-btns button{padding:10px 20px;font-size:0.78rem;cursor:pointer;border:1px solid var(--line);background:none;color:var(--paper);transition:all .2s;letter-spacing:0.03em;}
  .cookie-btns button.primary-cookie{background:var(--brass);color:var(--ink);border-color:var(--brass);font-weight:500;}
  .cookie-btns button:hover{opacity:0.85;}
  @media(max-width:760px){
    .cookie-banner{flex-direction:column;text-align:center;padding:16px 20px;}
  }

  /* PRIVACY MODAL */
  .modal-overlay{
    position:fixed;inset:0;z-index:800;background:rgba(0,0,0,0.7);
    display:none;align-items:center;justify-content:center;padding:28px;
  }
  .modal-overlay.open{display:flex;}
  .modal-box{
    background:var(--surface);border:1px solid var(--line);max-width:640px;width:100%;
    max-height:80vh;overflow-y:auto;padding:40px 36px;position:relative;
  }
  .modal-close{
    position:absolute;top:10px;right:12px;background:none;border:none;
    color:var(--steel);font-size:1.4rem;cursor:pointer;transition:color .2s;
    width:44px;height:44px;display:flex;align-items:center;justify-content:center;
  }
  .modal-close:hover{color:var(--paper);}
  .modal-box h3{font-family:'Fraunces',serif;font-size:1.4rem;margin-bottom:18px;}
  .modal-box p,.modal-box li{color:var(--steel);font-size:0.88rem;line-height:1.7;margin-bottom:12px;}
  .modal-box ul{padding-left:20px;margin-bottom:12px;}

  /* WORLD CLOCKS TICKER — stesso pattern del board aeroporti in header */
  .clocks-ticker{
    background:var(--surface);
    border-top:1px solid var(--line);
    border-bottom:1px solid var(--line);
    overflow:hidden;
    padding:14px 0;
    margin-top:0;
    margin-bottom:6px;
    width:100vw;
    position:relative;
    left:50%;
    right:50%;
    margin-left:-50vw;
    margin-right:-50vw;
  }
  .clocks-ticker-inner{
    display:flex;gap:0;animation:scroll 45s linear infinite;white-space:nowrap;
    will-change:transform;transform:translateZ(0);backface-visibility:hidden;
  }
  .clock-ticker-item{
    display:inline-flex;align-items:center;gap:8px;
    padding:0 28px;border-right:1px solid var(--line);
    font-family:'IBM Plex Mono',monospace;font-size:0.78rem;color:var(--steel);
  }
  .clock-ticker-item b{color:var(--brass-bright);font-weight:500;}
  .clock-ticker-item.is-base{color:var(--paper);}
  .clock-flag-img{display:inline-block;border-radius:2px;flex-shrink:0;}
  .clock-ticker-dot{width:5px;height:5px;border-radius:50%;background:var(--brass);animation:pulse 1.6s ease-in-out infinite;}
  html[dir="rtl"] .clocks-ticker-inner{animation-name:scrollrtl;}
  @media (prefers-reduced-motion: reduce){
    .clocks-ticker-inner{animation:none;}
  }

  /* ENHANCED FOOTER */
  footer{
    border-top:1px solid var(--line);padding:26px 0 10px;
    color:var(--steel);font-size:0.78rem;
  }
  .footer-inner{display:flex;justify-content:space-between;flex-wrap:wrap;gap:32px;margin-bottom:28px;}
  .footer-col h4{font-family:'IBM Plex Mono',monospace;font-size:0.72rem;color:var(--brass);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:14px;}
  .footer-col nav{display:block;padding:0;max-width:none;margin:0;}
  .footer-col a{display:block;color:var(--steel);font-size:0.82rem;padding:4px 0;transition:color .2s;}
  .footer-col a:hover{color:var(--paper);}
  .footer-bottom{border-top:1px solid var(--line);padding-top:10px;display:flex;justify-content:space-between;flex-wrap:wrap;gap:12px;font-size:0.75rem;}
  @media(max-width:760px){
    .footer-inner{flex-direction:column;gap:24px;}
  }

  @media(max-width:760px){
    .nav-links{display:none;}
    .nav-links.active{
      display:flex;flex-direction:column;position:absolute;top:100%;left:0;right:0;
      background:var(--surface);padding:20px 28px;border-bottom:1px solid var(--line);gap:16px;
    }
    .nav-links.active a{padding:8px 0;} /* rende ogni link facilmente toccabile */
    .menu-toggle{
      display:flex;align-items:center;justify-content:center;
      width:44px;height:44px;flex-shrink:0; /* area di tocco minima consigliata 44x44px */
    }
    .lang-switch button{padding:9px 12px;} /* prima 5px 10px: troppo piccolo per il dito */
    .contact-grid{grid-template-columns:1fr;}
    .section-head{flex-direction:column;align-items:flex-start;}

    /* HERO: su desktop il padding verticale enorme (110/90px) ha senso
       per bilanciare il griffone in overlay; su mobile è solo scroll
       vuoto prima del contenuto utile, quindi lo riduciamo. */
    .hero{padding:56px 0 40px;}
    .hero p.sub{margin-top:18px;}
    .cta-row{margin-top:28px;gap:12px;}
    .cta-row .btn{flex:1;text-align:center;} /* pulsanti a tutta larghezza, facili da premere col pollice */
    .search-box{margin-top:32px;padding:18px;}
    .btn{padding:16px 24px;} /* garantisce un'altezza di tocco >44px */

    /* iOS Safari fa zoom automatico su qualunque input con font-size
       sotto i 16px: qui erano 0.9rem/14.4px sia nella ricerca hero
       sia nel form di prenotazione. Forziamo 16px solo su mobile per
       non ingrandire troppo il testo sui form desktop. */
    .search-field input,.search-field select,
    input,select,textarea{font-size:16px;}
  }
  @media(min-width:761px) and (max-width:1024px){
    .wrap{padding:0 20px;}
    .search-grid{grid-template-columns:1fr 1fr 1fr auto;}
    .search-box .btn{grid-column:4;}
    .services{grid-template-columns:repeat(auto-fit,minmax(220px,1fr));}
    .fleet{grid-template-columns:repeat(auto-fit,minmax(280px,1fr));}
    .contact-grid{grid-template-columns:1fr;gap:40px;}
    .hero{padding:90px 0 70px;}
    .hero h1{font-size:2.8rem;}
    .stat{padding:28px 20px;}
    .nav-links{gap:24px;font-size:0.8rem;}
  }
  :focus-visible{outline:2px solid var(--brass);outline-offset:2px;}
  @media (prefers-reduced-motion: reduce){
    .board-inner{animation:none;}
    .dot{animation:none;}
    .reveal{opacity:1;transform:none;transition:none;}
  }

  /* Honeypot anti-spam field: hidden from real visitors, but not with
     display:none/visibility:hidden — some bots skip those and only fill
     visually-hidden-but-"present" fields, which is exactly what we want. */
  .hp-field{
    position:absolute;left:-9999px;top:-9999px;width:1px;height:1px;
    overflow:hidden;
  }

  /* WHATSAPP FLOATING BUTTON
     --fab-shift is kept in sync with JS (see syncFabToViewport) to fix a
     known Android bug (MIUI browser / some Chrome builds): position:fixed
     is computed against the full layout viewport instead of the currently
     visible visual viewport, so the button sits below the fold and is
     invisible until the address bar collapses on scroll. */
  .whatsapp-fab{
    position:fixed;bottom:100px;right:22px;z-index:600;
    width:58px;height:58px;border-radius:50%;
    background:#25D366;display:flex;align-items:center;justify-content:center;
    box-shadow:0 6px 20px rgba(0,0,0,0.35);
    transition:transform .2s;
    transform:translateZ(0) translateY(calc(-1 * var(--fab-shift, 0px)));
  }
  .whatsapp-fab:hover{transform:translateZ(0) translateY(calc(-1 * var(--fab-shift, 0px))) scale(1.08);}
  .whatsapp-fab svg{width:30px;height:30px;}
  @media(max-width:760px){
    .whatsapp-fab{width:52px;height:52px;bottom:90px;right:16px;}
    .whatsapp-fab svg{width:27px;height:27px;}
  }
  html[dir="rtl"] .whatsapp-fab{right:auto;left:22px;}
  @media(max-width:760px){
    html[dir="rtl"] .whatsapp-fab{right:auto;left:16px;}
  }

</style>
