import { createApp, h } from 'vue';
import { airports, airportSlugs } from './data/airports.js';

// La pagina di gestione prenotazioni si apre solo con questo link segreto:
// https://amedeo-ncc.vercel.app/#gestione-9f3k2x7q
// Chi non conosce questo link vede solo il sito pubblico normale.
const isAdminRoute = window.location.hash.startsWith('#gestione-9f3k2x7q');

// صفحات المطارات — /aeroporti/malpensa, /aeroporti/linate, /aeroporti/bergamo
// (بديل خفيف لـ vue-router، بنفس أسلوب الـ hash routing الموجود أصلاً)
const airportMatch = window.location.pathname.match(/^\/aeroporti\/([a-z-]+)\/?$/);
const airportSlug = airportMatch && airportSlugs.includes(airportMatch[1]) ? airportMatch[1] : null;

// La PWA (installazione come app sul telefono) è attiva SOLO per la
// pagina di gestione: i visitatori del sito pubblico non vedono manifest
// né service worker, e non viene mai proposto di installare il sito intero.
if (isAdminRoute) {
  const adminCss = document.createElement('link');
  adminCss.rel = 'stylesheet';
  adminCss.href = '/admin.css';
  document.head.appendChild(adminCss);

  const manifestLink = document.createElement('link');
  manifestLink.rel = 'manifest';
  manifestLink.href = '/manifest-gestione.json';
  document.head.appendChild(manifestLink);

  const themeColor = document.createElement('meta');
  themeColor.name = 'theme-color';
  themeColor.content = '#0C0F12';
  document.head.appendChild(themeColor);

  const appleCapable = document.createElement('meta');
  appleCapable.name = 'apple-mobile-web-app-capable';
  appleCapable.content = 'yes';
  document.head.appendChild(appleCapable);

  const appleStatusBar = document.createElement('meta');
  appleStatusBar.name = 'apple-mobile-web-app-status-bar-style';
  appleStatusBar.content = 'black-translucent';
  document.head.appendChild(appleStatusBar);

  const appleTitle = document.createElement('meta');
  appleTitle.name = 'apple-mobile-web-app-title';
  appleTitle.content = 'Gestione Amedeo';
  document.head.appendChild(appleTitle);

  const appleIcon = document.createElement('link');
  appleIcon.rel = 'apple-touch-icon';
  appleIcon.href = '/icon-gestione-192.png';
  document.head.appendChild(appleIcon);

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw-gestione.js').catch((e) => {
        console.warn('Service worker "gestione" non registrato:', e);
      });
    });
  }
}

// Import dinamico: il sito pubblico, il pannello di gestione, e le pagine
// aeroporto finiscono ognuno nel proprio file JS, così un visitatore
// normale non scarica mai codice che non gli serve.
const loadComponent = isAdminRoute
  ? import('./Admin.vue')
  : airportSlug
  ? import('./AeroportoPage.vue')
  : import('./App.vue');

loadComponent.then((mod) => {
  if (airportSlug) {
    createApp({
      render: () => h(mod.default, { slug: airportSlug, data: airports[airportSlug] }),
    }).mount('#app');
  } else {
    createApp(mod.default).mount('#app');
  }
});