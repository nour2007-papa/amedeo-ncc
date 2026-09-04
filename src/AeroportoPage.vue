<script setup>
/* =========================================================
   صفحة مطار عامة — تُستخدم لـ Malpensa / Linate / Bergamo
   عبر main.js اللي بيحدد الـ slug من الـ URL ويبعت الـ data
   المناسبة من src/data/airports.js
   ========================================================= */
import { ref, computed, onMounted } from 'vue';

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

onMounted(() => setLang('it'));

function goHome() {
  window.location.href = '/';
}

/* الفورم — نفس منطق البوكينج فورم البسيط، بس هنا بيبعت مباشرة على واتساب
   (نفس الأسلوب المستخدم في نسخ المعاينة القديمة). */
const name = ref('');
const phone = ref('');

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
  const message = `${t.value.title}\n${zona}\n${name.value} - ${phone.value}`;
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
              <input type="tel" v-model="phone" required placeholder="333 000 0000" />
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

<style scoped>
/* ملاحظة: التصميم الكامل (الخطوط، الألوان، الأنيميشن) موجود في
   القوالب القديمة الثلاثة — لسه محتاج ننقله هنا كـ CSS كامل قبل
   الـ deploy الفعلي. النسخة دي بتركّز على البنية والمنطق (routing,
   لغات, فورم) — التنسيق النهائي خطوة تالية منفصلة. */
.wrap { max-width: 1180px; margin: 0 auto; padding: 0 28px; }
</style>
