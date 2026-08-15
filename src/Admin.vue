<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { initializeApp } from 'firebase/app';
import {
  getAuth, signInWithEmailAndPassword, sendPasswordResetEmail, onAuthStateChanged, signOut,
} from 'firebase/auth';
import {
  getFirestore, collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc, addDoc, getDocs,
} from 'firebase/firestore';
import { firebaseConfig } from './firebase.js';
import { fleetDb } from './firebase-fleet.js';

const fbApp = initializeApp(firebaseConfig);
const auth = getAuth(fbApp);
const db = getFirestore(fbApp);

/* ---------- Login ---------- */
const ADMIN_EMAIL = 'nour2007papa@gmail.com';
const user = ref(null);
const authLoading = ref(true);
const email = ref('');
const password = ref('');
const showPassword = ref(false);
const loginError = ref('');
const loggingIn = ref(false);
const accessDenied = ref(false);
let unsubAuth = null;

/* ---------- Modale "nome autista" alla conferma ---------- */
const driverModalBooking = ref(null);
const driverNameInput = ref('');
const driverPhoneInput = ref('');
const confirmLang = ref('it');
const driversList = ref([]); // autisti presi da ncc-fleet (nome + telefono)
let driversListLoaded = false;
// Link WhatsApp all'autista pronto dopo la conferma: i browser bloccano una
// seconda finestra popup aperta nello stesso click, quindi non la apriamo
// automaticamente — mostriamo un pulsante che l'admin clicca manualmente.
const pendingDriverWaLink = ref(null); // { url, driverName, bookingId }

async function loadDriversList() {
  if (driversListLoaded || !fleetDb) return;
  try {
    const snap = await getDocs(collection(fleetDb, 'employees'));
    driversList.value = snap.docs
      .map((d) => d.data())
      .filter((e) => e.name)
      .map((e) => ({ name: e.name, phone: e.phone || '', carId: e.carId || '' }));
    driversListLoaded = true;
  } catch (e) {
    console.warn('Impossibile caricare la lista autisti da ncc-fleet:', e);
  }
}

function onDriverNameInput() {
  const match = driversList.value.find(
    (d) => d.name.trim().toLowerCase() === driverNameInput.value.trim().toLowerCase()
  );
  if (match && match.phone) {
    driverPhoneInput.value = match.phone;
  }
}
const driverModalError = ref('');

const WA_CONFIRM_TEXT = {
  it: {
    title: '✅ Prenotazione confermata — Grifone NCC',
    hi: (name) => `Ciao ${name}, la tua richiesta è stata confermata.`,
    service: 'Servizio', date: 'Data', destination: 'Destinazione', driver: 'Autista',
    thanks: 'Grazie per aver scelto Grifone NCC!',
  },
  en: {
    title: '✅ Booking confirmed — Grifone NCC',
    hi: (name) => `Hi ${name}, your request has been confirmed.`,
    service: 'Service', date: 'Date', destination: 'Destination', driver: 'Driver',
    thanks: 'Thank you for choosing Grifone NCC!',
  },
  ar: {
    title: '✅ تم تأكيد الحجز — Grifone NCC',
    hi: (name) => `مرحبًا ${name}، تم تأكيد طلبك.`,
    service: 'الخدمة', date: 'التاريخ', destination: 'الوجهة', driver: 'السائق',
    thanks: 'شكرًا لاختيارك Grifone NCC!',
  },
};

onMounted(() => {
  unsubAuth = onAuthStateChanged(auth, (u) => {
    if (u && u.email !== ADMIN_EMAIL) {
      accessDenied.value = true;
      signOut(auth);
      user.value = null;
      authLoading.value = false;
      unsubscribeBookings();
      return;
    }
    accessDenied.value = false;
    user.value = u;
    authLoading.value = false;
    if (u) {
      subscribeBookings();
    } else {
      unsubscribeBookings();
    }
  });
});
onUnmounted(() => {
  unsubAuth && unsubAuth();
  unsubscribeBookings();
});

function isMobileDevice() {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

async function login() {
  loginError.value = '';
  accessDenied.value = false;
  loggingIn.value = true;
  try {
    await signInWithEmailAndPassword(auth, email.value.trim(), password.value);
  } catch (e) {
    loginError.value = 'Email o password non corretti.';
  } finally {
    loggingIn.value = false;
  }
}

const resetSending = ref(false);
const resetMessage = ref('');
async function resetPassword() {
  loginError.value = '';
  resetMessage.value = '';
  const target = email.value.trim();
  if (!target) {
    loginError.value = 'Inserisci prima la tua email qui sopra, poi premi "Password dimenticata?".';
    return;
  }
  resetSending.value = true;
  try {
    await sendPasswordResetEmail(auth, target);
    resetMessage.value = `Email inviata a ${target}. Controlla la posta (anche lo spam) per reimpostare la password.`;
  } catch (e) {
    if (e.code === 'auth/user-not-found') {
      loginError.value = 'Nessun account trovato con questa email.';
    } else {
      loginError.value = 'Errore durante l\'invio: ' + e.message;
    }
  } finally {
    resetSending.value = false;
  }
}

function logout() {
  signOut(auth);
}

/* ---------- Bookings ---------- */
const bookings = ref([]);
const bookingsLoading = ref(true);
let unsubBookings = null;

function subscribeBookings() {
  if (unsubBookings) return; // già in ascolto, evita doppie sottoscrizioni
  const q = query(collection(db, 'bookings'), orderBy('createdAt', 'desc'));
  unsubBookings = onSnapshot(q, (snap) => {
    bookings.value = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    bookingsLoading.value = false;
  }, (err) => {
    console.error('Errore nel caricamento delle prenotazioni:', err);
    bookingsLoading.value = false;
  });
}
function unsubscribeBookings() {
  if (unsubBookings) {
    unsubBookings();
    unsubBookings = null;
    bookings.value = [];
    bookingsLoading.value = true;
  }
}

/* ---------- Grouping & filtering (day / week / month) ---------- */
const viewMode = ref('day'); // 'day' | 'week' | 'month'
const quickFilter = ref('all'); // 'all' | 'today' | 'week' | 'month'

function toDateOnly(key) {
  if (!key || key === '__nodate__') return null;
  const d = new Date(`${key}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}
function startOfWeek(d) {
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  const m = new Date(d);
  m.setDate(d.getDate() + diff);
  m.setHours(0, 0, 0, 0);
  return m;
}
function endOfWeek(d) {
  const s = startOfWeek(d);
  const e = new Date(s);
  e.setDate(s.getDate() + 6);
  e.setHours(23, 59, 59, 999);
  return e;
}
function isoWeekNumber(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
}
function weekKeyOf(d) {
  const s = startOfWeek(d);
  return `${s.getFullYear()}-W${String(isoWeekNumber(s)).padStart(2, '0')}`;
}

const filteredBookings = computed(() => {
  if (quickFilter.value === 'all') return bookings.value;
  const now = new Date();
  return bookings.value.filter((b) => {
    const d = toDateOnly(b.serviceDate);
    if (!d) return false;
    if (quickFilter.value === 'today') return d.toDateString() === now.toDateString();
    if (quickFilter.value === 'week') return d >= startOfWeek(now) && d <= endOfWeek(now);
    if (quickFilter.value === 'month') {
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }
    return true;
  });
});

const groupedByDay = computed(() => {
  const groups = {};
  for (const b of filteredBookings.value) {
    let key;
    if (viewMode.value === 'day') {
      key = b.serviceDate || '__nodate__';
    } else if (viewMode.value === 'week') {
      const d = toDateOnly(b.serviceDate);
      key = d ? weekKeyOf(d) : '__nodate__';
    } else {
      key = b.serviceDate ? b.serviceDate.slice(0, 7) : '__nodate__';
    }
    if (!groups[key]) groups[key] = [];
    groups[key].push(b);
  }
  return groups;
});

const sortedDayKeys = computed(() => {
  const keys = Object.keys(groupedByDay.value);
  const withDate = keys.filter((k) => k !== '__nodate__').sort((a, b) => b.localeCompare(a));
  const withoutDate = keys.includes('__nodate__') ? ['__nodate__'] : [];
  return [...withDate, ...withoutDate];
});

function formatDay(key) {
  if (key === '__nodate__') return 'Senza data indicata';
  if (viewMode.value === 'week') {
    const [y, w] = key.split('-W');
    const jan4 = new Date(Date.UTC(Number(y), 0, 4));
    const jan4Day = jan4.getUTCDay() || 7;
    const week1Monday = new Date(jan4);
    week1Monday.setUTCDate(jan4.getUTCDate() - jan4Day + 1);
    const start = new Date(week1Monday);
    start.setUTCDate(week1Monday.getUTCDate() + (Number(w) - 1) * 7);
    const end = new Date(start);
    end.setUTCDate(start.getUTCDate() + 6);
    const fmt = (d) => d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
    return `Settimana ${w} · ${fmt(start)} – ${fmt(end)} ${y}`;
  }
  if (viewMode.value === 'month') {
    const d = new Date(`${key}-01T00:00:00`);
    return d.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
  }
  const d = new Date(`${key}T00:00:00`);
  if (Number.isNaN(d.getTime())) return key;
  return d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function formatCreatedAt(ts) {
  if (!ts?.toDate) return '';
  return ts.toDate().toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function cleanPhoneForWa(b) {
  return `${b.country || ''}${b.phone || ''}`.replace(/[^\d]/g, '');
}

function telHref(b) {
  const digits = cleanPhoneForWa(b);
  return digits ? `tel:+${digits}` : null;
}

function waHref(b) {
  const digits = cleanPhoneForWa(b);
  return digits ? `https://wa.me/${digits}` : null;
}

function toggleConfirm(b) {
  const willBeConfirmed = !b.confirmed;
  if (willBeConfirmed) {
    // Prima di confermare, chiediamo il nome/telefono dell'autista e la lingua del messaggio.
    driverModalBooking.value = b;
    driverNameInput.value = '';
    driverPhoneInput.value = '';
    confirmLang.value = (b.lang && WA_CONFIRM_TEXT[b.lang]) ? b.lang : 'it';
    driverModalError.value = '';
    loadDriversList();
    return;
  }
  // Annullare una conferma non richiede questi dati: procede subito.
  performToggle(b, false, '', 'it', '');
}

function cancelDriverModal() {
  driverModalBooking.value = null;
  driverNameInput.value = '';
  driverPhoneInput.value = '';
  driverModalError.value = '';
}

function confirmDriverModal() {
  const name = driverNameInput.value.trim();
  const driverPhone = driverPhoneInput.value.trim();
  if (!name) {
    driverModalError.value = 'Inserisci il nome dell\'autista.';
    return;
  }
  if (!driverPhone) {
    driverModalError.value = 'Inserisci il numero WhatsApp dell\'autista.';
    return;
  }
  const b = driverModalBooking.value;
  const lang = confirmLang.value;
  driverModalBooking.value = null;
  performToggle(b, true, name, lang, driverPhone);
}

async function performToggle(b, willBeConfirmed, driverName, lang, driverPhone) {
  const onMobile = isMobileDevice();

  // Desktop: open the client tab synchronously, right when the click happens —
  // opening it after the `await` below breaks the direct link to the user's
  // click and the browser silently blocks it as a popup.
  // Mobile: skip this — mobile browsers often don't keep a blank tab
  // alive reliably, so we navigate the current tab instead (below).
  // NOTE: we only open ONE window here. Most browsers block a second
  // window.open() fired from the same click (silently — no error), which is
  // why the driver's WhatsApp message was never sending. The driver link is
  // prepared below and shown as a manual button instead.
  const waWindow = (willBeConfirmed && !onMobile) ? window.open('', '_blank') : null;

  try {
    const updates = { confirmed: willBeConfirmed };
    if (willBeConfirmed && driverName) updates.driverName = driverName;
    await updateDoc(doc(db, 'bookings', b.id), updates);
  } catch (e) {
    alert('Errore: impossibile aggiornare lo stato. Riprova.');
    if (waWindow) waWindow.close();
    return;
  }

  // Specchia la prenotazione nel pannello ncc-fleet ("Prenotazioni"), mappata
  // sui campi che quella tabella si aspetta. La prima conferma crea il
  // documento gemello e ne salva l'id sulla prenotazione originale; le volte
  // successive (conferma/annulla ripetuti) aggiornano solo lo stato di quel
  // documento invece di crearne uno nuovo. Indipendente dall'aggiornamento
  // sopra: se questo fallisce, la conferma/annullamento sul sito resta valida.
  if (fleetDb) {
    try {
      if (willBeConfirmed && !b.fleetDocId) {
        const noteParts = [];
        noteParts.push(`Da sito agenzia · ${b.service || ''}`);
        if (b.flight) noteParts.push(`Volo: ${b.flight}`);
        if (b.people) noteParts.push(`Persone: ${b.people}`);
        if (b.bags) noteParts.push(`Valigie: ${b.bags}`);
        if (b.details) noteParts.push(b.details);

        const fleetDoc = await addDoc(collection(fleetDb, 'prenotazioni'), {
          cliente: b.name || '',
          telefono: `${b.country || ''} ${b.phone || ''}`.trim(),
          dataOra: b.serviceDate ? `${b.serviceDate}T00:00:00` : new Date().toISOString(),
          zona: 'Sito agenzia',
          destinazione: b.hotel || b.service || '',
          veicolo: '',
          // Campo "autista" popolato con il nome esatto scelto nel modale
          // (idealmente preso dalla lista employees di ncc-fleet), così la
          // prenotazione risulta collegata al conducente reale e non solo
          // menzionata nelle note.
          autista: driverName || '',
          // "autista_assegnato" è lo stato dedicato in ncc-fleet quando un
          // conducente è già assegnato alla corsa (vedi bookingConstants.js).
          stato: driverName ? 'autista_assegnato' : 'confermato',
          note: noteParts.join(' | '),
          createdAt: new Date().toISOString(),
          reminderSent: false,
        });
        await updateDoc(doc(db, 'bookings', b.id), { fleetDocId: fleetDoc.id });
      } else if (b.fleetDocId) {
        // Già specchiata in precedenza: aggiorna lo stato (confermato/annullato)
        // e il nome autista se inserito/modificato alla riconferma.
        const fleetUpdates = {
          stato: willBeConfirmed ? (driverName ? 'autista_assegnato' : 'confermato') : 'annullato',
        };
        if (willBeConfirmed && driverName) {
          fleetUpdates.autista = driverName;
          const noteParts = [`Da sito agenzia · ${b.service || ''}`];
          if (b.flight) noteParts.push(`Volo: ${b.flight}`);
          if (b.people) noteParts.push(`Persone: ${b.people}`);
          if (b.bags) noteParts.push(`Valigie: ${b.bags}`);
          if (b.details) noteParts.push(b.details);
          fleetUpdates.note = noteParts.join(' | ');
        }
        await updateDoc(doc(fleetDb, 'prenotazioni', b.fleetDocId), fleetUpdates);
      }

      // Specchia anche in "Corse" (collezione trips), così la corsa appare
      // pure nella tab Corse di ncc-fleet, non solo in Prenotazioni. Creata
      // una sola volta per prenotazione (fleetTripId salvato per evitare
      // duplicati alle riconferme successive). Il veicolo (carId) viene
      // preso dal campo "carId" già assegnato all'autista in employees, se
      // presente; il prezzo (fare) non è raccolto dal sito, quindi resta a
      // 0 — va aggiornato manualmente in "Corse" quando noto.
      if (willBeConfirmed && driverName && !b.fleetTripId) {
        const matchedDriver = driversList.value.find(
          (d) => d.name.trim().toLowerCase() === driverName.trim().toLowerCase()
        );
        const tripNoteParts = [`Da sito agenzia · Autista: ${driverName}`];
        if (b.flight) tripNoteParts.push(`Volo: ${b.flight}`);
        if (b.people) tripNoteParts.push(`Persone: ${b.people}`);
        if (b.bags) tripNoteParts.push(`Valigie: ${b.bags}`);
        if (b.details) tripNoteParts.push(b.details);

        const pickupTime = b.dataOra && b.dataOra.includes('T') ? b.dataOra.split('T')[1].slice(0, 5) : '';

        const tripDoc = await addDoc(collection(fleetDb, 'trips'), {
          date: b.serviceDate || new Date().toISOString().slice(0, 10),
          time: pickupTime,
          carId: matchedDriver?.carId || '',
          route: `Sito agenzia → ${b.hotel || b.service || ''}`,
          fare: 0,
          payment: '',
          notes: tripNoteParts.join(' | '),
        });
        await updateDoc(doc(db, 'bookings', b.id), { fleetTripId: tripDoc.id });
      }
    } catch (e) {
      console.warn('Impossibile aggiornare lo specchio su ncc-fleet:', e);
    }
  }

  if (willBeConfirmed) {
    const phone = cleanPhoneForWa(b);
    if (!phone) {
      alert('Numero di telefono mancante: impossibile aprire WhatsApp per la conferma.');
      if (waWindow) waWindow.close();
      return;
    }
    const T = WA_CONFIRM_TEXT[lang] || WA_CONFIRM_TEXT.it;
    const lines = [T.title, T.hi(b.name || '')];
    if (b.service) lines.push(`${T.service}: ${b.service}`);
    if (b.serviceDate) lines.push(`${T.date}: ${b.serviceDate}`);
    if (b.hotel) lines.push(`${T.destination}: ${b.hotel}`);
    if (driverName) lines.push(`${T.driver}: ${driverName}`);
    lines.push(T.thanks);
    const text = encodeURIComponent(lines.join('\n'));
    const url = `https://wa.me/${phone}?text=${text}`;
    if (onMobile) {
      window.location.href = url;
    } else if (waWindow) {
      waWindow.location.href = url;
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }

    // Messaggio separato all'autista, in italiano, con i dati completi della corsa.
    if (driverPhone) {
      const driverDigits = driverPhone.replace(/[^\d]/g, '');
      const dLines = [`🚗 Nuova corsa assegnata — Grifone NCC`, `Ciao ${driverName}, ecco i dati della corsa:`];
      dLines.push(`Cliente: ${b.name || '—'}`);
      const clientPhone = cleanPhoneForWa(b);
      if (clientPhone) dLines.push(`Telefono cliente: +${clientPhone}`);
      if (b.service) dLines.push(`Servizio: ${b.service}`);
      if (b.serviceDate) dLines.push(`Data: ${b.serviceDate}`);
      if (b.hotel) dLines.push(`Destinazione: ${b.hotel}`);
      if (b.flight) dLines.push(`Volo: ${b.flight}`);
      if (b.people) dLines.push(`Persone: ${b.people}`);
      if (b.bags) dLines.push(`Valigie: ${b.bags}`);
      if (b.details) dLines.push(`Note: ${b.details}`);
      const dText = encodeURIComponent(dLines.join('\n'));
      const dUrl = `https://wa.me/${driverDigits}?text=${dText}`;
      // Non apriamo questa finestra automaticamente: il browser blocca in
      // silenzio un secondo window.open() nello stesso click (vedi nota
      // sopra), quindi il messaggio all'autista non partiva mai. Il link
      // resta pronto qui e l'admin lo apre con un click separato (pulsante
      // "Invia messaggio all'autista" nella UI).
      pendingDriverWaLink.value = { url: dUrl, driverName, bookingId: b.id };
    }
  }
}

function openDriverWaLink() {
  if (!pendingDriverWaLink.value) return;
  window.open(pendingDriverWaLink.value.url, '_blank', 'noopener,noreferrer');
  pendingDriverWaLink.value = null;
}

async function deleteBooking(b) {
  if (!confirm(`Eliminare la richiesta di "${b.name || 'cliente'}"? L'azione non è reversibile.`)) return;
  try {
    await deleteDoc(doc(db, 'bookings', b.id));
  } catch (e) {
    alert('Errore: impossibile eliminare la richiesta. Riprova.');
  }
}

/* ---------- Installazione come app (PWA) ---------- */
const isStandalone = ref(
  window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
);
const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
let deferredInstallPrompt = null;
const canInstall = ref(false);
const showIosHelp = ref(false);

function onBeforeInstallPrompt(e) {
  e.preventDefault();
  deferredInstallPrompt = e;
  canInstall.value = true;
}
function onAppInstalled() {
  canInstall.value = false;
  deferredInstallPrompt = null;
  isStandalone.value = true;
}
window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
window.addEventListener('appinstalled', onAppInstalled);
onUnmounted(() => {
  window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
  window.removeEventListener('appinstalled', onAppInstalled);
});

async function installApp() {
  if (isIos) {
    showIosHelp.value = true;
    return;
  }
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  canInstall.value = false;
}
</script>

<template>
  <div class="admin">
    <div v-if="authLoading" class="admin-center">Caricamento...</div>

    <div v-else-if="!user" class="admin-center">
      <form class="admin-login-box" @submit.prevent="login">
        <h1>Grifone NCC</h1>
        <p class="admin-subtitle">Gestione prenotazioni</p>

        <input type="email" v-model="email" placeholder="Email" required autocomplete="username">
        <div class="admin-password-field">
          <input
            :type="showPassword ? 'text' : 'password'"
            v-model="password"
            placeholder="Password"
            required
            autocomplete="current-password"
          >
          <button
            type="button"
            class="admin-toggle-pw"
            @click="showPassword = !showPassword"
            :aria-label="showPassword ? 'Nascondi password' : 'Mostra password'"
          >
            <svg v-if="!showPassword" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
            <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"></path>
              <path d="M10.73 5.08A10.94 10.94 0 0 1 12 5c7 0 11 7 11 7a13.16 13.16 0 0 1-1.67 2.68"></path>
              <path d="M6.61 6.61A13.526 13.526 0 0 0 1 12s4 7 11 7a9.74 9.74 0 0 0 5.39-1.61"></path>
              <line x1="2" y1="2" x2="22" y2="22"></line>
            </svg>
          </button>
        </div>

        <p v-if="loginError" class="admin-error">{{ loginError }}</p>
        <p v-if="accessDenied" class="admin-error">
          Questo account non è autorizzato ad accedere a questo pannello.
        </p>
        <p v-if="resetMessage" class="admin-success">{{ resetMessage }}</p>

        <button type="submit" :disabled="loggingIn">{{ loggingIn ? 'Accesso in corso...' : 'Accedi' }}</button>

        <button
          type="button"
          class="admin-forgot"
          :disabled="resetSending"
          @click="resetPassword"
        >
          {{ resetSending ? 'Invio in corso...' : 'Password dimenticata?' }}
        </button>
      </form>
    </div>

    <div v-else class="admin-dashboard">
      <header class="admin-header">
        <h1>Prenotazioni — Grifone NCC</h1>
        <div class="admin-header-actions">
          <button
            v-if="!isStandalone && (canInstall || isIos)"
            class="admin-install"
            @click="installApp"
          >
            Installa app
          </button>
          <button class="admin-logout" @click="logout">Esci</button>
        </div>
      </header>

      <div v-if="showIosHelp" class="admin-modal-overlay" @click.self="showIosHelp = false">
        <div class="admin-modal">
          <h2>Installa su iPhone/iPad</h2>
          <ol>
            <li>Tocca l'icona <b>Condividi</b> ⬆️ in basso nella barra di Safari</li>
            <li>Scorri e scegli <b>"Aggiungi a Home"</b></li>
            <li>Tocca <b>"Aggiungi"</b> in alto a destra</li>
          </ol>
          <button class="admin-toggle" @click="showIosHelp = false">Ho capito</button>
        </div>
      </div>

      <div v-if="driverModalBooking" class="admin-modal-overlay" @click.self="cancelDriverModal">
        <div class="admin-modal">
          <h2>Conferma prenotazione</h2>
          <p class="admin-modal-hint">Chi è l'autista assegnato a {{ driverModalBooking.name || 'questo cliente' }}?</p>
          <input
            type="text"
            v-model.trim="driverNameInput"
            @input="onDriverNameInput"
            placeholder="Nome autista"
            class="admin-driver-input"
            list="admin-drivers-list"
            @keyup.enter="confirmDriverModal"
            autofocus
          >
          <datalist id="admin-drivers-list">
            <option v-for="d in driversList" :key="d.name" :value="d.name" />
          </datalist>
          <input
            type="tel"
            v-model.trim="driverPhoneInput"
            placeholder="Numero WhatsApp autista (es. +39 333 000 0000)"
            class="admin-driver-input"
            @keyup.enter="confirmDriverModal"
          >
          <p v-if="driversList.length" class="admin-modal-hint admin-modal-hint-small">
            {{ driversList.length }} autisti caricati da ncc-fleet — scrivi il nome per compilare il numero automaticamente, o inseriscilo manualmente se non è in elenco.
          </p>
          <p class="admin-modal-hint">Lingua del messaggio:</p>
          <div class="admin-lang-picker">
            <button
              v-for="l in [['it','Italiano'],['en','English'],['ar','عربي']]"
              :key="l[0]"
              type="button"
              :class="{ active: confirmLang === l[0] }"
              @click="confirmLang = l[0]"
            >{{ l[1] }}</button>
          </div>
          <p v-if="driverModalError" class="admin-modal-error">{{ driverModalError }}</p>
          <div class="admin-modal-actions">
            <button class="admin-logout" @click="cancelDriverModal">Annulla</button>
            <button class="admin-install" @click="confirmDriverModal">Conferma</button>
          </div>
        </div>
      </div>

      <div v-if="pendingDriverWaLink" class="admin-driver-wa-banner">
        <span>📲 رسالة السائق {{ pendingDriverWaLink.driverName }} جاهزة — اضغط لإرسالها على واتساب</span>
        <button class="admin-install" @click="openDriverWaLink">إرسال للسائق</button>
        <button class="admin-logout" @click="pendingDriverWaLink = null">تجاهل</button>
      </div>

      <div v-if="bookings.length > 0" class="admin-filters">
        <div class="admin-filter-group">
          <span class="admin-filter-label">Vista:</span>
          <button :class="{ active: viewMode === 'day' }" @click="viewMode = 'day'">Giorno</button>
          <button :class="{ active: viewMode === 'week' }" @click="viewMode = 'week'">Settimana</button>
          <button :class="{ active: viewMode === 'month' }" @click="viewMode = 'month'">Mese</button>
        </div>
        <div class="admin-filter-group">
          <span class="admin-filter-label">Mostra:</span>
          <button :class="{ active: quickFilter === 'all' }" @click="quickFilter = 'all'">Tutte</button>
          <button :class="{ active: quickFilter === 'today' }" @click="quickFilter = 'today'">Oggi</button>
          <button :class="{ active: quickFilter === 'week' }" @click="quickFilter = 'week'">Questa settimana</button>
          <button :class="{ active: quickFilter === 'month' }" @click="quickFilter = 'month'">Questo mese</button>
        </div>
      </div>

      <div v-if="bookingsLoading" class="admin-center">Caricamento prenotazioni...</div>
      <div v-else-if="bookings.length === 0" class="admin-center">Nessuna prenotazione ancora.</div>
      <div v-else-if="sortedDayKeys.length === 0" class="admin-center">Nessuna prenotazione in questo periodo.</div>

      <div v-else class="admin-days">
        <section v-for="key in sortedDayKeys" :key="key" class="admin-day">
          <h2>{{ formatDay(key) }}</h2>
          <div class="admin-cards">
            <article
              v-for="b in groupedByDay[key]"
              :key="b.id"
              class="admin-card"
              :class="{ 'is-confirmed': b.confirmed }"
            >
              <div class="admin-card-top">
                <b>{{ b.name || '—' }}</b>
                <span class="admin-badge" :class="{ on: b.confirmed }">
                  {{ b.confirmed ? 'Confermata' : 'Da confermare' }}
                </span>
              </div>

              <p class="admin-when">{{ formatCreatedAt(b.createdAt) }}</p>

              <p v-if="b.confirmed && b.driverName" class="admin-line"><span>Autista</span>{{ b.driverName }}</p>
              <p class="admin-line"><span>Servizio</span>{{ b.service || '—' }}</p>
              <p class="admin-line admin-line-phone">
                <span>Telefono</span>
                <a v-if="telHref(b)" :href="telHref(b)" class="admin-phone-link">{{ b.country }} {{ b.phone }}</a>
                <template v-else>{{ b.country }} {{ b.phone }}</template>
                <a
                  v-if="waHref(b)"
                  :href="waHref(b)"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="admin-wa-btn"
                  aria-label="Scrivi su WhatsApp"
                  title="Scrivi su WhatsApp"
                >
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true">
                    <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5.06-1.33A10 10 0 1 0 12 2Zm0 18.2a8.16 8.16 0 0 1-4.17-1.14l-.3-.18-3 .79.8-2.92-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.52-6.14c-.25-.12-1.45-.72-1.68-.8-.22-.08-.39-.12-.55.12-.16.25-.63.8-.77.96-.14.16-.28.18-.53.06-.25-.12-1.04-.38-1.98-1.22-.73-.65-1.22-1.45-1.37-1.7-.14-.25-.02-.38.11-.5.11-.11.25-.28.37-.42.12-.14.16-.25.24-.4.08-.16.04-.3-.02-.42-.06-.12-.55-1.33-.76-1.82-.2-.48-.4-.41-.55-.42h-.47c-.16 0-.42.06-.64.3-.22.25-.84.82-.84 2s.86 2.32.98 2.48c.12.16 1.7 2.6 4.12 3.64.58.25 1.03.4 1.38.51.58.18 1.11.16 1.53.1.47-.07 1.45-.59 1.65-1.16.2-.57.2-1.06.14-1.16-.06-.1-.22-.16-.47-.28Z"/>
                  </svg>
                </a>
              </p>
              <p v-if="b.hotel" class="admin-line"><span>Destinazione</span>{{ b.hotel }}</p>
              <p v-if="b.flight" class="admin-line"><span>Volo</span>{{ b.flight }}</p>
              <p v-if="b.people" class="admin-line"><span>Persone</span>{{ b.people }}</p>
              <p v-if="b.bags" class="admin-line"><span>Valigie</span>{{ b.bags }}</p>
              <p v-if="b.details" class="admin-line"><span>Note</span>{{ b.details }}</p>

              <div class="admin-actions">
                <button class="admin-toggle" @click="toggleConfirm(b)">
                  {{ b.confirmed ? 'Segna come non confermata' : 'Conferma prenotazione' }}
                </button>
                <button class="admin-delete" @click="deleteBooking(b)" aria-label="Elimina" title="Elimina">
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6h16Z"/>
                  </svg>
                </button>
              </div>
            </article>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>


