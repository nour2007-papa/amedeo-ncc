<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { initializeApp } from 'firebase/app';
import {
  getAuth, signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut,
} from 'firebase/auth';
import {
  getFirestore, collection, query, orderBy, onSnapshot, doc, updateDoc,
} from 'firebase/firestore';
import { firebaseConfig } from './firebase.js';

const fbApp = initializeApp(firebaseConfig);
const auth = getAuth(fbApp);
const db = getFirestore(fbApp);

/* ---------- Login ---------- */
const user = ref(null);
const authLoading = ref(true);
const email = ref('');
const password = ref('');
const loginError = ref('');
const loggingIn = ref(false);
let unsubAuth = null;

onMounted(() => {
  unsubAuth = onAuthStateChanged(auth, (u) => {
    user.value = u;
    authLoading.value = false;
  });
});
onUnmounted(() => unsubAuth && unsubAuth());

async function login() {
  loginError.value = '';
  loggingIn.value = true;
  try {
    await signInWithEmailAndPassword(auth, email.value.trim(), password.value);
  } catch (e) {
    loginError.value = 'Email o password non corretti.';
  } finally {
    loggingIn.value = false;
  }
}

async function loginWithGoogle() {
  loginError.value = '';
  loggingIn.value = true;
  try {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  } catch (e) {
    if (e.code === 'auth/popup-closed-by-user') {
      loginError.value = '';
    } else if (e.code === 'auth/popup-blocked') {
      loginError.value = 'المتصفح بيمنع النافذة المنبثقة. اسمح بالـ popups لهذا الموقع.';
    } else {
      loginError.value = 'خطأ في تسجيل الدخول بجوجل: ' + e.message;
    }
  } finally {
    loggingIn.value = false;
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

const groupedByDay = computed(() => {
  const groups = {};
  for (const b of bookings.value) {
    const key = b.serviceDate || '__nodate__';
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
  const d = new Date(`${key}T00:00:00`);
  if (Number.isNaN(d.getTime())) return key;
  return d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function formatCreatedAt(ts) {
  if (!ts?.toDate) return '';
  return ts.toDate().toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

async function toggleConfirm(b) {
  try {
    await updateDoc(doc(db, 'bookings', b.id), { confirmed: !b.confirmed });
  } catch (e) {
    alert('Errore: impossibile aggiornare lo stato. Riprova.');
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

        <button type="submit" :disabled="loggingIn">{{ loggingIn ? 'Accesso in corso...' : 'Accedi' }}</button>

        <div class="admin-divider"><span>oppure</span></div>

        <button type="button" @click="loginWithGoogle" :disabled="loggingIn" class="admin-google-btn">
          Accedi con Google
        </button>
      </form>
    </div>

    <div v-else class="admin-dashboard">
      <header class="admin-header">
        <h1>Prenotazioni — Amedeo NCC</h1>
        <button class="admin-logout" @click="logout">Esci</button>
      </header>

      <div v-if="bookingsLoading" class="admin-center">Caricamento prenotazioni...</div>
      <div v-else-if="bookings.length === 0" class="admin-center">Nessuna prenotazione ancora.</div>

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

              <button class="admin-toggle" @click="toggleConfirm(b)">
                {{ b.confirmed ? 'Segna come non confermata' : 'Conferma prenotazione' }}
              </button>
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

.admin-divider{
  display:flex; align-items:center; text-align:center; color:var(--steel);
  font-size:0.78rem; margin:6px 0;
}
.admin-divider::before, .admin-divider::after{
  content:''; flex:1; border-bottom:1px solid var(--line);
}
.admin-divider span{padding:0 10px;}

.admin-google-btn{
  background:none; border:1px solid var(--brass); color:var(--brass-bright);
  padding:12px; font-weight:600; text-transform:uppercase; font-size:0.8rem;
  cursor:pointer; margin-top:0;
}
.admin-google-btn:hover{background:rgba(176,141,87,0.1);}
.admin-google-btn:disabled{opacity:0.6; cursor:default;}

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
  margin-top:14px; width:100%; background:none; border:1px solid var(--line);
  color:var(--brass-bright); padding:10px; font-size:0.78rem; text-transform:uppercase;
  letter-spacing:0.03em; cursor:pointer;
}
.admin-toggle:hover{border-color:var(--brass); background:rgba(176,141,87,0.08);}
</style>
