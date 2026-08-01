<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { initializeApp } from 'firebase/app';
import {
  getAuth, signInWithEmailAndPassword, sendPasswordResetEmail, onAuthStateChanged, signOut,
} from 'firebase/auth';
import {
  getFirestore, collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc,
} from 'firebase/firestore';
import { firebaseConfig } from './firebase.js';

const fbApp = initializeApp(firebaseConfig);
const auth = getAuth(fbApp);
const db = getFirestore(fbApp);

/* ---------- Login ---------- */
const ADMIN_EMAIL = 'nour2007papa@gmail.com';
const user = ref(null);
const authLoading = ref(true);
const email = ref('');
const password = ref('');
const loginError = ref('');
const loggingIn = ref(false);
const accessDenied = ref(false);
let unsubAuth = null;

onMounted(() => {
  unsubAuth = onAuthStateChanged(auth, (u) => {
    if (u && u.email !== ADMIN_EMAIL) {
      accessDenied.value = true;
      signOut(auth);
      user.value = null;
      authLoading.value = false;
      return;
    }
    accessDenied.value = false;
    user.value = u;
    authLoading.value = false;
  });
});
onUnmounted(() => unsubAuth && unsubAuth());

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

onMounted(() => {
  const q = query(collection(db, 'bookings'), orderBy('createdAt', 'desc'));
  unsubBookings = onSnapshot(q, (snap) => {
    bookings.value = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    bookingsLoading.value = false;
  }, () => {
    bookingsLoading.value = false;
  });
});
onUnmounted(() => unsubBookings && unsubBookings());

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

async function toggleConfirm(b) {
  const willBeConfirmed = !b.confirmed;
  const onMobile = isMobileDevice();

  // Desktop: open the tab synchronously, right when the click happens —
  // opening it after the `await` below breaks the direct link to the
  // user's click and browsers silently block it as a popup.
  // Mobile: skip this — mobile browsers often don't keep a blank tab
  // alive reliably, so we navigate the current tab instead (below).
  const waWindow = (willBeConfirmed && !onMobile) ? window.open('', '_blank') : null;

  try {
    await updateDoc(doc(db, 'bookings', b.id), { confirmed: willBeConfirmed });
  } catch (e) {
    alert('Errore: impossibile aggiornare lo stato. Riprova.');
    if (waWindow) waWindow.close();
    return;
  }
  if (willBeConfirmed) {
    const phone = cleanPhoneForWa(b);
    if (!phone) {
      alert('Numero di telefono mancante: impossibile aprire WhatsApp per la conferma.');
      if (waWindow) waWindow.close();
      return;
    }
    const lines = [
      `✅ Prenotazione confermata — Amedeo NCC`,
      `Ciao ${b.name || ''}, la tua richiesta è stata confermata.`,
    ];
    if (b.service) lines.push(`Servizio: ${b.service}`);
    if (b.serviceDate) lines.push(`Data: ${b.serviceDate}`);
    if (b.hotel) lines.push(`Destinazione: ${b.hotel}`);
    lines.push(`Grazie per aver scelto Amedeo NCC!`);
    const text = encodeURIComponent(lines.join('\n'));
    const url = `https://wa.me/${phone}?text=${text}`;
    if (onMobile) {
      window.location.href = url;
    } else if (waWindow) {
      waWindow.location.href = url;
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }
}

async function deleteBooking(b) {
  if (!confirm(`Eliminare la richiesta di "${b.name || 'cliente'}"? L'azione non è reversibile.`)) return;
  try {
    await deleteDoc(doc(db, 'bookings', b.id));
  } catch (e) {
    alert('Errore: impossibile eliminare la richiesta. Riprova.');
  }
}
</script>

<template>
  <div class="admin">
    <div v-if="authLoading" class="admin-center">Caricamento...</div>

    <div v-else-if="!user" class="admin-center">
      <form class="admin-login-box" @submit.prevent="login">
        <h1>Amedeo NCC</h1>
        <p class="admin-subtitle">Gestione prenotazioni</p>

        <input type="email" v-model="email" placeholder="Email" required autocomplete="username">
        <input type="password" v-model="password" placeholder="Password" required autocomplete="current-password">

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
        <h1>Prenotazioni — Amedeo NCC</h1>
        <button class="admin-logout" @click="logout">Esci</button>
      </header>

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

              <p class="admin-line"><span>Servizio</span>{{ b.service || '—' }}</p>
              <p class="admin-line"><span>Telefono</span>{{ b.country }} {{ b.phone }}</p>
              <p v-if="b.hotel" class="admin-line"><span>Destinazione</span>{{ b.hotel }}</p>
              <p v-if="b.flight" class="admin-line"><span>Volo</span>{{ b.flight }}</p>
              <p v-if="b.people" class="admin-line"><span>Persone</span>{{ b.people }}</p>
              <p v-if="b.bags" class="admin-line"><span>Valigie</span>{{ b.bags }}</p>
              <p v-if="b.details" class="admin-line"><span>Note</span>{{ b.details }}</p>

              <p class="admin-meta">Richiesta ricevuta: {{ formatCreatedAt(b.createdAt) }}</p>

              <div class="admin-actions">
                <button class="admin-toggle" @click="toggleConfirm(b)">
                  {{ b.confirmed ? 'Segna come non confermata' : 'Conferma prenotazione' }}
                </button>
                <button class="admin-delete" @click="deleteBooking(b)">
                  Elimina
                </button>
              </div>
            </article>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<style>
:root{
  --ink:#0C0F12; --surface:#14181D; --surface-2:#1B2027;
  --brass:#B08D57; --brass-bright:#D9B77F; --paper:#EDEAE3; --steel:#8B93AA; --line:#262B31;
}
*{margin:0;padding:0;box-sizing:border-box;}
html,body{background:var(--ink);}
.admin{
  min-height:100vh; background:var(--ink); color:var(--paper);
  font-family:'Work Sans',sans-serif; font-weight:300; line-height:1.5;
}
.admin-center{
  min-height:100vh; display:flex; align-items:center; justify-content:center;
  padding:24px; text-align:center; color:var(--steel);
}
.admin-login-box{
  width:100%; max-width:360px; background:var(--surface); border:1px solid var(--line);
  padding:40px 32px; display:flex; flex-direction:column; gap:14px;
}
.admin-login-box h1{font-family:'Fraunces',serif; font-size:1.6rem; color:var(--paper); text-align:center;}
.admin-subtitle{color:var(--steel); font-size:0.85rem; text-align:center; margin-bottom:10px;}
.admin-login-box input{
  background:var(--surface-2); border:1px solid var(--line); color:var(--paper);
  padding:12px 14px; font-family:'Work Sans',sans-serif; font-size:0.92rem;
}
.admin-login-box input:focus{outline:none; border-color:var(--brass);}
.admin-login-box button{
  background:var(--brass); color:var(--ink); border:none; padding:13px;
  font-weight:600; letter-spacing:0.03em; text-transform:uppercase; font-size:0.82rem;
  cursor:pointer; margin-top:6px;
}
.admin-login-box button:disabled{opacity:0.6; cursor:default;}
.admin-error{color:#e5877e; font-size:0.82rem;}
.admin-success{color:#8fbf8a; font-size:0.82rem;}
.admin-forgot{
  background:none; border:none; color:var(--steel); font-size:0.78rem;
  text-decoration:underline; cursor:pointer; padding:2px; margin-top:-4px;
}
.admin-forgot:hover{color:var(--brass-bright);}
.admin-forgot:disabled{opacity:0.6; cursor:default;}

.admin-header{
  display:flex; align-items:center; justify-content:space-between;
  padding:20px 24px; border-bottom:1px solid var(--line); position:sticky; top:0;
  background:var(--ink); z-index:5;
}
.admin-header h1{font-family:'Fraunces',serif; font-size:1.2rem; font-weight:500;}
.admin-logout{
  background:none; border:1px solid var(--line); color:var(--steel);
  padding:8px 16px; font-size:0.8rem; cursor:pointer;
}
.admin-logout:hover{border-color:var(--brass); color:var(--brass-bright);}
.admin-days{max-width:900px; margin:0 auto; padding:24px;}
.admin-filters{
  max-width:900px; margin:0 auto; padding:16px 24px 0;
  display:flex; flex-direction:column; gap:10px;
}
.admin-filter-group{ display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.admin-filter-label{ color:var(--steel); font-size:0.75rem; text-transform:uppercase; letter-spacing:0.06em; margin-right:2px; }
.admin-filter-group button{
  background:none; border:1px solid var(--line); color:var(--steel);
  padding:6px 12px; font-size:0.76rem; cursor:pointer; letter-spacing:0.02em;
}
.admin-filter-group button:hover{ border-color:var(--brass); color:var(--brass-bright); }
.admin-filter-group button.active{
  border-color:var(--brass); color:var(--ink); background:var(--brass-bright);
}
.admin-day{margin-bottom:36px;}
.admin-day h2{
  font-family:'IBM Plex Mono',monospace; text-transform:uppercase; font-size:0.85rem;
  letter-spacing:0.04em; color:var(--brass-bright); border-bottom:1px solid var(--line);
  padding-bottom:10px; margin-bottom:16px;
}
.admin-cards{display:grid; grid-template-columns:repeat(auto-fill, minmax(280px,1fr)); gap:14px;}
.admin-card{
  background:var(--surface); border:1px solid var(--line); padding:18px; position:relative;
}
.admin-card.is-confirmed{border-color:#4a8f6a;}
.admin-card-top{display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;}
.admin-card-top b{font-family:'Fraunces',serif; font-size:1.05rem;}
.admin-badge{
  font-size:0.7rem; text-transform:uppercase; letter-spacing:0.03em;
  padding:4px 9px; border:1px solid var(--line); color:var(--steel);
}
.admin-badge.on{border-color:#4a8f6a; color:#7fcf9e;}
.admin-line{font-size:0.85rem; color:var(--paper); margin-bottom:4px;}
.admin-line span{color:var(--steel); display:inline-block; min-width:88px;}
.admin-meta{font-size:0.72rem; color:var(--steel); margin-top:10px;}
.admin-toggle{
  width:100%; background:none; border:1px solid var(--line);
  color:var(--brass-bright); padding:10px; font-size:0.78rem; text-transform:uppercase;
  letter-spacing:0.03em; cursor:pointer;
}
.admin-toggle:hover{border-color:var(--brass); background:rgba(176,141,87,0.08);}
.admin-actions{margin-top:14px; display:flex; gap:8px;}
.admin-actions .admin-toggle{margin-top:0; flex:1;}
.admin-delete{
  background:none; border:1px solid #6b3030; color:#e08a8a; padding:10px 14px;
  font-size:0.78rem; text-transform:uppercase; letter-spacing:0.03em; cursor:pointer;
}
.admin-delete:hover{border-color:#c94f4f; background:rgba(201,79,79,0.1);}
</style>
