<script setup>
/* =========================================================
   صفحة مطار عامة — تُستخدم لـ Malpensa / Linate / Bergamo
   عبر main.js اللي بيحدد الـ slug من الـ URL ويبعت الـ data
   المناسبة من src/data/airports.js
   ========================================================= */
import { ref, computed, onMounted, watch } from 'vue';

const props = defineProps({
  slug: { type: String, required: true },
  data: { type: Object, required: true }, // { code, km, minRange, T }
});

const WHATSAPP_NUMBER = import.meta.env.VITE_WHATSAPP_NUMBER || '393520003122';
const WHATSAPP_DISPLAY = '+39 352 000 3122';

const currentLang = ref('it');
const t = computed(() => props.data.T[currentLang.value]);

function setLang(lang) {
  currentLang.value = lang;
  document.documentElement.setAttribute('lang', lang);
  document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
}

/* ---------- SEO: title/description/canonical/og لكل مطار ولكل لغة ---------- */
function setMetaTag(selector, attr, value) {
  let el = document.querySelector(selector);
  if (!el) {
    el = document.createElement(selector.startsWith('link') ? 'link' : 'meta');
    if (selector.includes('property=')) el.setAttribute('property', selector.match(/"([^"]+)"/)[1]);
    else if (selector.includes('name=')) el.setAttribute('name', selector.match(/"([^"]+)"/)[1]);
    else if (selector.includes('rel=')) el.setAttribute('rel', selector.match(/"([^"]+)"/)[1]);
    document.head.appendChild(el);
  }
  el.setAttribute(attr, value);
}
function updateSeo() {
  const title = `${t.value.title} | Transfer NCC Milano | Grifone NCC`;
  const desc = t.value.sub;
  const url = `https://www.amedeo-ncc.vercel.app/aeroporti/${props.slug}`;
  document.title = title;
  setMetaTag('meta[name="description"]', 'content', desc);
  setMetaTag('link[rel="canonical"]', 'href', url);
  setMetaTag('meta[property="og:title"]', 'content', title);
  setMetaTag('meta[property="og:description"]', 'content', desc);
  setMetaTag('meta[property="og:url"]', 'content', url);
}
watch(currentLang, updateSeo);
onMounted(() => { setLang('it'); updateSeo(); });

function goHome() {
  window.location.href = '/';
}

/* ---------- خريطة المطار ---------- */
const mapQueries = {
  malpensa: 'Aeroporto di Milano-Malpensa, Ferno VA',
  linate: 'Aeroporto di Milano Linate, Segrate MI',
  bergamo: 'Aeroporto di Bergamo-Orio al Serio, Orio al Serio BG',
};
const mapSrc = computed(() =>
  `https://www.google.com/maps?q=${encodeURIComponent(mapQueries[props.slug] || t.value.title)}&output=embed`
);

/* الفورم — نفس منطق البوكينج فورم البسيط، بس هنا بيبعت مباشرة على واتساب
   (نفس الأسلوب المستخدم في نسخ المعاينة القديمة). */
const name = ref('');
const phone = ref('');

/* ---------- مفتاح الدولة (نفس منطق BookingForm.vue) ---------- */
const countryCodes = [
  { code: '+966', name: 'السعودية', iso2: 'sa' }, { code: '+971', name: 'الإمارات', iso2: 'ae' },
  { code: '+965', name: 'الكويت', iso2: 'kw' }, { code: '+974', name: 'قطر', iso2: 'qa' },
  { code: '+973', name: 'البحرين', iso2: 'bh' }, { code: '+968', name: 'عمان', iso2: 'om' },
  { code: '+20', name: 'مصر', iso2: 'eg' }, { code: '+962', name: 'الأردن', iso2: 'jo' },
  { code: '+961', name: 'لبنان', iso2: 'lb' }, { code: '+963', name: 'سوريا', iso2: 'sy' },
  { code: '+964', name: 'العراق', iso2: 'iq' }, { code: '+967', name: 'اليمن', iso2: 'ye' },
  { code: '+970', name: 'فلسطين', iso2: 'ps' }, { code: '+212', name: 'المغرب', iso2: 'ma' },
  { code: '+213', name: 'الجزائر', iso2: 'dz' }, { code: '+216', name: 'تونس', iso2: 'tn' },
  { code: '+218', name: 'ليبيا', iso2: 'ly' }, { code: '+249', name: 'السودان', iso2: 'sd' },
  { code: '+39', name: 'Italia', iso2: 'it' }, { code: '+41', name: 'Svizzera', iso2: 'ch' },
  { code: '+33', name: 'Francia', iso2: 'fr' }, { code: '+43', name: 'Austria', iso2: 'at' },
  { code: '+356', name: 'Malta', iso2: 'mt' }, { code: '+385', name: 'Croazia', iso2: 'hr' },
  { code: '+30', name: 'Grecia', iso2: 'gr' }, { code: '+32', name: 'Belgio', iso2: 'be' },
  { code: '+420', name: 'Rep. Ceca', iso2: 'cz' }, { code: '+45', name: 'Danimarca', iso2: 'dk' },
  { code: '+358', name: 'Finlandia', iso2: 'fi' }, { code: '+49', name: 'Germania', iso2: 'de' },
  { code: '+36', name: 'Ungheria', iso2: 'hu' }, { code: '+353', name: 'Irlanda', iso2: 'ie' },
  { code: '+31', name: 'Paesi Bassi', iso2: 'nl' }, { code: '+47', name: 'Norvegia', iso2: 'no' },
  { code: '+48', name: 'Polonia', iso2: 'pl' }, { code: '+351', name: 'Portogallo', iso2: 'pt' },
  { code: '+40', name: 'Romania', iso2: 'ro' }, { code: '+7', name: 'Russia', iso2: 'ru' },
  { code: '+34', name: 'Spagna', iso2: 'es' }, { code: '+46', name: 'Svezia', iso2: 'se' },
  { code: '+44', name: 'Regno Unito', iso2: 'gb' }, { code: '+61', name: 'Australia', iso2: 'au' },
  { code: '+1', name: 'Stati Uniti / Canada', iso2: 'us' }, { code: '+55', name: 'Brasile', iso2: 'br' },
  { code: '+86', name: 'Cina', iso2: 'cn' }, { code: '+91', name: 'India', iso2: 'in' },
  { code: '+81', name: 'Giappone', iso2: 'jp' }, { code: '+82', name: 'Corea del Sud', iso2: 'kr' },
  { code: '+90', name: 'Turchia', iso2: 'tr' }, { code: '+27', name: 'Sudafrica', iso2: 'za' },
];
const countryOpen = ref(false);
const countrySearch = ref('');
const selectedCountryIso2 = ref('it');
const countrySelectRef = ref(null);
const selectedCountry = computed(() => countryCodes.find(c => c.iso2 === selectedCountryIso2.value) || countryCodes[0]);
const filteredCountries = computed(() => {
  const q = countrySearch.value.trim().toLowerCase();
  if (!q) return countryCodes;
  return countryCodes.filter(c => c.name.toLowerCase().includes(q) || c.code.includes(q));
});
function toggleCountryDropdown() {
  countryOpen.value = !countryOpen.value;
  if (countryOpen.value) countrySearch.value = '';
}
function selectCountry(c) {
  selectedCountryIso2.value = c.iso2;
  countryOpen.value = false;
}
function handleClickOutside(event) {
  if (countryOpen.value && countrySelectRef.value && !countrySelectRef.value.contains(event.target)) {
    countryOpen.value = false;
  }
}
onMounted(() => document.addEventListener('click', handleClickOutside));

function submitForm() {
  if (!name.value.trim() || !phone.value.trim()) {
    const msg =
      currentLang.value === 'ar' ? 'من فضلك املأ الاسم ورقم الهاتف'
      : currentLang.value === 'en' ? 'Please fill in your name and phone number'
      : 'Compila nome e numero di telefono';
    alert(msg);
    return;
  }
  const zona = t.value.title;
  const message = `${t.value.title}\n${zona}\n${selectedCountry.value.code} ${phone.value} - ${name.value}`;
  const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank');
}
</script>

<template>
  <div :dir="currentLang === 'ar' ? 'rtl' : 'ltr'">
    <header>
      <nav class="wrap">
        <div class="logo">
          <span class="logo-dot"></span>
          <span class="logo-text">GRIFONE <b>NCC</b></span>
        </div>
        <div class="nav-links">
          <a href="#" @click.prevent="goHome">{{ t.back }}</a>
        </div>
        <div class="lang-switch" role="group">
          <button :class="{ active: currentLang === 'it' }" @click="setLang('it')">IT</button>
          <button :class="{ active: currentLang === 'en' }" @click="setLang('en')">EN</button>
          <button :class="{ active: currentLang === 'ar' }" @click="setLang('ar')">AR</button>
        </div>
      </nav>
    </header>

    <main>
      <section class="hero wrap">
        <div class="hero-eyebrow">{{ t.eyebrow }}</div>
        <h1>{{ t.title }}</h1>
        <p class="sub">{{ t.sub }}</p>
        <div class="cta-row">
          <a href="#prenota" class="btn btn-primary">{{ t.cta }}</a>
        </div>
      </section>

      <section class="stats wrap">
        <div class="stat"><b>{{ data.km }} {{ t.km }}</b><span>{{ t.dist }}</span></div>
        <div class="stat"><b>{{ data.minRange }} {{ t.min }}</b><span>{{ t.dur }}</span></div>
        <div class="stat"><b>{{ data.code }}</b><span>{{ t.avail }}</span></div>
        <div class="stat"><b>24/7</b><span>{{ t.hours }}</span></div>
      </section>

      <section class="section wrap">
        <div class="services">
          <div class="stub"><h3>{{ t.tracking }}</h3></div>
          <div class="stub"><h3>{{ t.meet }}</h3></div>
        </div>
      </section>

      <section class="section wrap map-section">
        <iframe class="airport-map" :src="mapSrc" loading="lazy" referrerpolicy="no-referrer-when-downgrade" :title="t.title"></iframe>
      </section>

      <section class="section wrap" id="prenota">
        <div class="section-head">
          <h2>{{ t.booktitle }}</h2>
          <div class="tag mono">{{ t.booktag }}</div>
        </div>
        <div class="contact-grid">
          <form class="booking-form" @submit.prevent="submitForm">
            <h3 class="bf-title">{{ t.formtitle }}</h3>
            <label class="bf-field">
              <span>{{ t.name }}</span>
              <input type="text" v-model="name" required />
            </label>
            <label class="bf-field">
              <span>{{ t.phone }}</span>
              <div class="phone-row">
                <div class="country-select" ref="countrySelectRef" :class="{ open: countryOpen }">
                  <button type="button" class="country-select-btn" @click="toggleCountryDropdown" :aria-expanded="countryOpen" aria-haspopup="listbox">
                    <img :src="`https://flagcdn.com/24x18/${selectedCountry.iso2}.png`" :alt="selectedCountry.name" width="22" height="16" class="country-flag">
                    <span class="mono">{{ selectedCountry.code }}</span>
                    <svg class="country-chevron" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
                  </button>
                  <div v-if="countryOpen" class="country-dropdown" role="listbox">
                    <input type="text" v-model="countrySearch" class="country-search" placeholder="..." @click.stop>
                    <div class="country-list">
                      <button type="button" v-for="c in filteredCountries" :key="c.code + c.iso2" class="country-item" role="option" @click="selectCountry(c)">
                        <img :src="`https://flagcdn.com/24x18/${c.iso2}.png`" :alt="c.name" width="20" height="15">
                        <span class="country-item-name">{{ c.name }}</span>
                        <span class="country-item-code">{{ c.code }}</span>
                      </button>
                      <div v-if="filteredCountries.length === 0" class="country-empty">—</div>
                    </div>
                  </div>
                </div>
                <input type="tel" v-model="phone" required placeholder="333 000 0000" />
              </div>
            </label>
            <label class="bf-field">
              <span>{{ t.zona }}</span>
              <input type="text" :value="t.title" readonly />
            </label>
            <button type="submit" class="btn btn-primary">{{ t.submit }}</button>
          </form>
          <div>
            <div class="info-line"><span>{{ t.iphone }}</span><span>{{ WHATSAPP_DISPLAY }}</span></div>
            <div class="info-line"><span>{{ t.iwa }}</span><span>{{ WHATSAPP_DISPLAY }}</span></div>
            <div class="info-line"><span>{{ t.imail }}</span><span>amedeo018@libero.it</span></div>
          </div>
        </div>
      </section>
    </main>

    <footer class="wrap">
      <div class="footer-bottom">
        <span>© 2026 Grifone NCC · P.IVA XXXXXXXXXXX</span>
        <span>{{ t.footnote }}</span>
      </div>
    </footer>

    <a class="whatsapp-fab" :href="`https://wa.me/${WHATSAPP_NUMBER}`" target="_blank" rel="noopener" aria-label="WhatsApp">
      <svg viewBox="0 0 32 32" fill="white"><path d="M16.001 3C9.373 3 4 8.373 4 15c0 2.386.703 4.61 1.912 6.478L4 29l7.702-1.874A11.94 11.94 0 0016.001 27C22.629 27 28 21.627 28 15S22.629 3 16.001 3zm0 21.818a9.77 9.77 0 01-4.98-1.362l-.357-.212-4.573 1.112 1.135-4.457-.233-.366A9.78 9.78 0 016.182 15c0-5.42 4.4-9.818 9.819-9.818 5.418 0 9.818 4.398 9.818 9.818 0 5.419-4.4 9.818-9.818 9.818zm5.386-7.35c-.295-.148-1.746-.862-2.017-.96-.271-.099-.469-.148-.667.148-.197.295-.764.96-.937 1.157-.172.198-.345.222-.64.074-.295-.148-1.246-.459-2.373-1.463-.877-.782-1.47-1.748-1.642-2.043-.172-.295-.018-.454.13-.601.134-.133.296-.345.444-.518.148-.172.197-.295.296-.492.099-.198.05-.37-.025-.518-.074-.148-.667-1.606-.914-2.2-.24-.579-.485-.5-.667-.51-.172-.008-.37-.01-.568-.01a1.09 1.09 0 00-.79.37c-.271.296-1.036 1.013-1.036 2.47 0 1.457 1.06 2.865 1.208 3.063.148.198 2.086 3.186 5.053 4.468.706.305 1.256.487 1.685.623.708.225 1.352.193 1.861.117.568-.085 1.746-.714 1.993-1.403.246-.69.246-1.28.172-1.403-.074-.123-.271-.197-.567-.345z"/></svg>
    </a>
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
    background:var(--ink);color:var(--paper);
    font-family:'Work Sans',sans-serif;font-weight:300;line-height:1.5;
    -webkit-font-smoothing:antialiased;overflow-x:hidden;max-width:100vw;
  }
  a{color:inherit;text-decoration:none;}
  .mono{font-family:'IBM Plex Mono',monospace;}
  html[dir="rtl"] body{font-family:'Tajawal','Work Sans',sans-serif;}
  html[dir="rtl"] .mono,html[dir="rtl"] .info-line span:last-child{font-family:'IBM Plex Mono','Tajawal',monospace;}
  html[dir="rtl"] h1,html[dir="rtl"] h2,html[dir="rtl"] .stub h3{font-family:'Cairo','Fraunces',serif;}
  html[dir="rtl"] .logo-text{font-family:'Cairo',serif;}
  html[dir="rtl"] input{font-family:'Tajawal',sans-serif;}
  :focus-visible{outline:2px solid var(--brass);outline-offset:2px;}

  .wrap{max-width:1180px;margin:0 auto;padding:0 28px;}

  /* NAV */
  header{
    position:sticky;top:0;z-index:50;background:rgba(12,15,18,0.88);
    -webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);
    border-bottom:1px solid var(--line);
  }
  header nav{display:flex;align-items:center;justify-content:space-between;padding:18px 0;}
  .logo{display:flex;align-items:center;gap:10px;}
  .logo-dot{width:10px;height:10px;border-radius:50%;background:var(--brass);flex-shrink:0;}
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

  /* HERO */
  .hero{padding:90px 0 70px;}
  .hero-eyebrow{
    font-family:'IBM Plex Mono',monospace;font-size:0.75rem;color:var(--brass);
    letter-spacing:0.15em;text-transform:uppercase;margin-bottom:22px;
    display:flex;align-items:center;gap:10px;
  }
  .hero-eyebrow::before{content:'';width:26px;height:1px;background:var(--brass);}
  h1{
    font-family:'Fraunces',serif;font-weight:600;
    font-size:clamp(2.2rem,5.5vw,3.6rem);line-height:1.08;
    max-width:820px;letter-spacing:-0.01em;
  }
  .hero p.sub{max-width:480px;color:var(--steel);font-size:1.05rem;margin-top:22px;font-weight:300;}
  .cta-row{display:flex;gap:16px;margin-top:36px;flex-wrap:wrap;}
  .btn{
    padding:15px 30px;font-size:0.85rem;letter-spacing:0.05em;text-transform:uppercase;
    cursor:pointer;transition:all .25s;border:1px solid transparent;display:inline-block;
  }
  .btn-primary{background:var(--brass);color:var(--ink);font-weight:500;}
  .btn-primary:hover{background:var(--brass-bright);}

  /* STATS */
  .stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));border-top:1px solid var(--line);border-bottom:1px solid var(--line);}
  .stat{padding:34px 28px;border-left:1px solid var(--line);}
  .stat:first-child{border-left:none;}
  .stat b{font-family:'Fraunces',serif;font-size:2.2rem;color:var(--brass-bright);display:block;font-weight:500;}
  .stat span{font-family:'IBM Plex Mono',monospace;font-size:0.72rem;color:var(--steel);text-transform:uppercase;letter-spacing:0.06em;}

  /* SECTION */
  .section{padding:80px 0;border-top:1px solid var(--line);scroll-margin-top:72px;}
  .section-head{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:44px;flex-wrap:wrap;gap:20px;}
  .section-head h2{font-family:'Fraunces',serif;font-size:clamp(1.8rem,3.2vw,2.6rem);font-weight:500;}
  .tag{font-family:'IBM Plex Mono',monospace;font-size:0.75rem;color:var(--steel);max-width:320px;}

  /* SERVICES stubs (monitoraggio volo / incontro in aeroporto) */
  .services{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:22px;}
  .stub{background:var(--surface);border:1px solid var(--line);padding:30px 26px;transition:border-color .25s,transform .25s;}
  .stub:hover{border-color:var(--brass);transform:translateY(-3px);}
  .stub h3{font-family:'Fraunces',serif;font-size:1.2rem;font-weight:500;}

  /* CONTACT / BOOKING FORM */
  .contact-grid{display:grid;grid-template-columns:1.1fr 0.9fr;gap:60px;}
  .booking-form{display:flex;flex-direction:column;gap:16px;}
  .bf-title{font-family:'Fraunces',serif;font-size:1.25rem;font-weight:500;margin-bottom:4px;}
  .bf-field{display:flex;flex-direction:column;gap:6px;}
  .bf-field span{
    font-family:'IBM Plex Mono',monospace;font-size:0.68rem;color:var(--steel);
    text-transform:uppercase;letter-spacing:0.06em;
  }
  input{
    background:var(--surface);border:1px solid var(--line);color:var(--paper);
    padding:14px 16px;font-family:'Work Sans',sans-serif;font-size:0.92rem;width:100%;
  }
  input:focus{outline:none;border-color:var(--brass);}
  input[readonly]{color:var(--steel);}

  .info-line{display:flex;justify-content:space-between;padding:16px 0;border-bottom:1px solid var(--line);font-size:0.92rem;}
  .info-line span:first-child{color:var(--steel);}
  .info-line span:last-child{font-family:'IBM Plex Mono',monospace;color:var(--brass-bright);}

  /* PHONE / COUNTRY SELECT */
  .phone-row{display:flex;gap:8px;}
  .phone-row input{flex:1;}
  .country-select{position:relative;flex:0 0 108px;}
  .country-select-btn{
    display:flex;align-items:center;gap:6px;width:100%;height:100%;
    background:var(--surface);border:1px solid var(--line);color:var(--paper);
    padding:14px 8px;font-family:'Work Sans',sans-serif;font-size:0.88rem;cursor:pointer;
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
    font-family:'Work Sans',sans-serif;font-size:0.86rem;text-align:left;cursor:pointer;
  }
  html[dir="rtl"] .country-item{text-align:right;}
  .country-item img{border-radius:2px;flex-shrink:0;}
  .country-item:hover{background:rgba(176,141,87,0.12);}
  .country-item-name{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
  .country-item-code{color:var(--steel);font-family:'IBM Plex Mono',monospace;font-size:0.8rem;flex-shrink:0;}
  .country-empty{padding:16px 14px;color:var(--steel);font-size:0.86rem;text-align:center;}

  /* MAP */
  .map-section{padding-top:0;}
  .airport-map{width:100%;height:340px;border:1px solid var(--line);filter:grayscale(35%) invert(92%) contrast(90%);}

  /* FOOTER */
  footer{border-top:1px solid var(--line);padding:26px 0;color:var(--steel);font-size:0.78rem;}
  .footer-bottom{display:flex;justify-content:space-between;flex-wrap:wrap;gap:12px;}

  /* WHATSAPP FAB */
  .whatsapp-fab{
    position:fixed;bottom:100px;right:22px;z-index:600;
    width:58px;height:58px;border-radius:50%;
    background:#25D366;display:flex;align-items:center;justify-content:center;
    box-shadow:0 6px 20px rgba(0,0,0,0.35);transition:transform .2s;
  }
  .whatsapp-fab:hover{transform:scale(1.08);}
  .whatsapp-fab svg{width:30px;height:30px;}
  html[dir="rtl"] .whatsapp-fab{right:auto;left:22px;}

  @media(max-width:760px){
    header nav{flex-wrap:wrap;gap:14px;padding:14px 0;}
    .nav-links{font-size:0.78rem;gap:20px;}
    .hero{padding:56px 0 40px;}
    .hero p.sub{margin-top:18px;}
    .cta-row{margin-top:26px;}
    .cta-row .btn{flex:1;text-align:center;}
    .btn{padding:16px 22px;}
    .section{padding:56px 0;}
    .section-head{flex-direction:column;align-items:flex-start;}
    .contact-grid{grid-template-columns:1fr;gap:36px;}
    input{font-size:16px;}
    .whatsapp-fab{width:52px;height:52px;bottom:90px;right:16px;}
    .whatsapp-fab svg{width:27px;height:27px;}
    html[dir="rtl"] .whatsapp-fab{left:16px;}
  }
</style>
