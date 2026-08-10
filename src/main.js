import { createApp } from 'vue';

// La pagina di gestione prenotazioni si apre solo con questo link segreto:
// https://amedeo-ncc.vercel.app/#gestione-9f3k2x7q
// Chi non conosce questo link vede solo il sito pubblico normale.
const isAdminRoute = window.location.hash.startsWith('#gestione-9f3k2x7q');

// La PWA (installazione come app sul telefono) è attiva SOLO per la
// pagina di gestione: i visitatori del sito pubblico non vedono manifest
// né service worker, e non viene mai proposto di installare il sito intero.
if (isAdminRoute) {
  // Carichiamo lo stile della pagina di gestione come file statico separato
  // (public/admin.css), NON tramite l'import dinamico di Admin.vue.
  // Prima capitava che, in certe condizioni (cache del browser, estensioni,
  // ordine di caricamento dei chunk), lo stile del sito pubblico (App.vue)
  // finiva applicato anche qui, rompendo il layout della pagina di gestione.
  // Un <link> statico caricato subito, indipendente dal sistema di chunk
  // di Vite, elimina questo rischio.
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

  // Supporto "Aggiungi a Home" su iOS (Safari non legge il manifest)
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

// Import dinamico: il sito pubblico e il pannello di gestione finiscono in
// due file JS separati, così un visitatore normale non scarica mai il
// codice di Admin.vue (Firebase Auth, tabelle prenotazioni, ecc.) e
// viceversa — invece di un unico file grande con tutto dentro.
const loadComponent = isAdminRoute
  ? import('./Admin.vue')
  : import('./App.vue');

loadComponent.then((mod) => {
  createApp(mod.default).mount('#app');
});
