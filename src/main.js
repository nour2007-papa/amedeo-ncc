import { createApp } from 'vue';
import App from './App.vue';
import Admin from './Admin.vue';

// La pagina di gestione prenotazioni si apre solo con questo link segreto:
// https://amedeo-ncc.vercel.app/#gestione-9f3k2x7q
// Chi non conosce questo link vede solo il sito pubblico normale.
const isAdminRoute = window.location.hash.startsWith('#gestione-9f3k2x7q');

createApp(isAdminRoute ? Admin : App).mount('#app');
