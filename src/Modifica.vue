<script setup>
/* =========================================================
   Modifica.vue — صفحة يفتحها العميل من الرابط السرّي المُرسَل
   على واتساب وقت تأكيد الحجز: #modifica-{bookingId}-{token}

   لا اتصال مباشر بـ Firestore هنا — كل شيء يمر عبر
   /api/booking-edit (Admin SDK على السيرفر) اللي بيتحقق من
   تطابق التوكن ونافذة التعديل (6 ساعات قبل الاستلام).
   ========================================================= */
import { reactive, ref, computed, onMounted } from 'vue';

const bookingId = ref('');
const token = ref('');
const state = ref('loading'); // loading | invalid | expired | cancelled | form | saving | saved | cancelling | cancelled_ok | error
const errorMsg = ref('');

const form = reactive({
  dataOra: '', zona: '', destinazione: '', volo: '', passeggeri: '', bagagli: '', details: '',
});
const clientName = ref('');
const currentLang = ref('ar'); // اللغة تنضبط حسب اتجاه المتصفح؛ AR افتراضيًا لعملاء Grifone

const isRtl = computed(() => currentLang.value === 'ar');

const UI = {
  ar: {
    title: 'تعديل الحجز', hi: (n) => `مرحبًا ${n}`,
    dataOra: 'تاريخ ووقت الاستلام', zona: 'نقطة الاستلام', destinazione: 'الوجهة',
    volo: 'رقم الرحلة', passeggeri: 'عدد الركاب', bagagli: 'عدد الحقائب', details: 'ملاحظات',
    save: 'حفظ التعديلات', cancelBooking: 'إلغاء الحجز نهائيًا',
    saveSuccess: 'تم حفظ التعديلات ✅ — الحجز الآن قيد المراجعة من فريقنا.',
    cancelConfirm: 'هل أنت متأكد من إلغاء هذا الحجز؟ هذا الإجراء نهائي.',
    cancelSuccess: 'تم إلغاء الحجز.',
    invalidToken: 'هذا الرابط غير صالح.',
    windowClosed: 'انتهت مهلة التعديل — يجب التعديل قبل 6 ساعات على الأقل من موعد الاستلام. للتواصل المباشر يرجى الاتصال بنا.',
    alreadyCancelled: 'هذا الحجز مُلغى بالفعل.',
    genericError: 'حدث خطأ. حاول مرة أخرى لاحقًا.',
    loading: 'جارٍ التحميل...',
  },
  it: {
    title: 'Modifica prenotazione', hi: (n) => `Ciao ${n}`,
    dataOra: 'Data e ora ritiro', zona: 'Punto di ritiro', destinazione: 'Destinazione',
    volo: 'Numero volo', passeggeri: 'Passeggeri', bagagli: 'Bagagli', details: 'Note',
    save: 'Salva modifiche', cancelBooking: 'Annulla prenotazione',
    saveSuccess: 'Modifiche salvate ✅ — la prenotazione è ora in revisione.',
    cancelConfirm: 'Confermi l\'annullamento? L\'azione è definitiva.',
    cancelSuccess: 'Prenotazione annullata.',
    invalidToken: 'Questo link non è valido.',
    windowClosed: 'Termine per la modifica scaduto — modifiche possibili solo fino a 6 ore prima del ritiro. Contattaci direttamente.',
    alreadyCancelled: 'Questa prenotazione è già stata annullata.',
    genericError: 'Si è verificato un errore. Riprova più tardi.',
    loading: 'Caricamento...',
  },
};
const t = computed(() => UI[currentLang.value] || UI.ar);

function parseHash() {
  // formato: #modifica-{bookingId}-{token}
  const raw = window.location.hash.replace('#modifica-', '');
  const parts = raw.split('-');
  bookingId.value = parts[0] || '';
  token.value = parts[1] || '';
}

async function loadBooking() {
  parseHash();
  if (!bookingId.value || !token.value) {
    state.value = 'invalid';
    return;
  }
  try {
    const res = await fetch(`/api/booking-edit?bookingId=${encodeURIComponent(bookingId.value)}&token=${encodeURIComponent(token.value)}`);
    const data = await res.json();
    if (!res.ok) {
      if (data.error === 'already_cancelled') { state.value = 'cancelled'; return; }
      state.value = 'invalid';
      return;
    }
    if (data.booking.cancelledByClient) { state.value = 'cancelled'; return; }
    clientName.value = data.booking.name || '';
    currentLang.value = ['ar', 'it'].includes(data.booking.lang) ? data.booking.lang : 'ar';
    Object.assign(form, {
      dataOra: data.booking.dataOra || '',
      zona: data.booking.zona || '',
      destinazione: data.booking.destinazione || '',
      volo: data.booking.volo || '',
      passeggeri: data.booking.passeggeri || '',
      bagagli: data.booking.bagagli || '',
      details: data.booking.details || '',
    });
    state.value = data.editable ? 'form' : 'expired';
  } catch (e) {
    console.error('[Modifica] load fallito:', e);
    state.value = 'error';
    errorMsg.value = t.value.genericError;
  }
}

async function saveChanges() {
  state.value = 'saving';
  try {
    const res = await fetch('/api/booking-edit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bookingId: bookingId.value,
        token: token.value,
        action: 'update',
        updates: { ...form },
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      if (data.error === 'edit_window_closed') { state.value = 'expired'; return; }
      throw new Error(data.error || 'update_failed');
    }
    state.value = 'saved';
  } catch (e) {
    console.error('[Modifica] save fallito:', e);
    state.value = 'form';
    errorMsg.value = t.value.genericError;
  }
}

async function cancelBooking() {
  if (!confirm(t.value.cancelConfirm)) return;
  state.value = 'cancelling';
  try {
    const res = await fetch('/api/booking-edit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingId: bookingId.value, token: token.value, action: 'cancel' }),
    });
    const data = await res.json();
    if (!res.ok) {
      if (data.error === 'edit_window_closed') { state.value = 'expired'; return; }
      throw new Error(data.error || 'cancel_failed');
    }
    state.value = 'cancelled_ok';
  } catch (e) {
    console.error('[Modifica] cancel fallito:', e);
    state.value = 'form';
    errorMsg.value = t.value.genericError;
  }
}

onMounted(loadBooking);
</script>

<template>
  <div class="modifica-page" :dir="isRtl ? 'rtl' : 'ltr'">
    <div class="modifica-card">
      <h1 class="modifica-title">{{ t.title }}</h1>
      <p v-if="clientName && (state === 'form' || state === 'saving')" class="modifica-hi">{{ t.hi(clientName) }}</p>

      <div v-if="state === 'loading'" class="modifica-status">{{ t.loading }}</div>
      <div v-else-if="state === 'invalid'" class="modifica-status error">{{ t.invalidToken }}</div>
      <div v-else-if="state === 'expired'" class="modifica-status error">{{ t.windowClosed }}</div>
      <div v-else-if="state === 'cancelled'" class="modifica-status error">{{ t.alreadyCancelled }}</div>
      <div v-else-if="state === 'error'" class="modifica-status error">{{ errorMsg }}</div>
      <div v-else-if="state === 'saved'" class="modifica-status success">{{ t.saveSuccess }}</div>
      <div v-else-if="state === 'cancelled_ok'" class="modifica-status success">{{ t.cancelSuccess }}</div>

      <form v-else-if="state === 'form' || state === 'saving' || state === 'cancelling'" @submit.prevent="saveChanges" class="modifica-form">
        <p v-if="errorMsg" class="modifica-status error small">{{ errorMsg }}</p>

        <label class="mf-field">
          <span>{{ t.dataOra }}</span>
          <input type="datetime-local" v-model="form.dataOra">
        </label>
        <div class="mf-row">
          <label class="mf-field">
            <span>{{ t.zona }}</span>
            <input type="text" v-model.trim="form.zona" maxlength="120">
          </label>
          <label class="mf-field">
            <span>{{ t.destinazione }}</span>
            <input type="text" v-model.trim="form.destinazione" maxlength="120">
          </label>
        </div>
        <div class="mf-row">
          <label class="mf-field">
            <span>{{ t.volo }}</span>
            <input type="text" v-model.trim="form.volo" maxlength="20">
          </label>
          <label class="mf-field">
            <span>{{ t.passeggeri }}</span>
            <input type="number" min="1" v-model="form.passeggeri">
          </label>
          <label class="mf-field">
            <span>{{ t.bagagli }}</span>
            <input type="number" min="0" v-model="form.bagagli">
          </label>
        </div>
        <label class="mf-field">
          <span>{{ t.details }}</span>
          <textarea v-model.trim="form.details" maxlength="500" rows="3"></textarea>
        </label>

        <button type="submit" class="mf-save" :disabled="state !== 'form'">{{ t.save }}</button>
        <button type="button" class="mf-cancel" :disabled="state !== 'form'" @click="cancelBooking">{{ t.cancelBooking }}</button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.modifica-page{min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0C0F12;padding:24px;font-family:'Work Sans',sans-serif;}
.modifica-card{background:#14181D;border:1px solid #262B31;border-radius:12px;padding:32px 28px;max-width:520px;width:100%;}
.modifica-title{color:#EDEAE3;font-size:1.4rem;margin:0 0 6px;}
.modifica-hi{color:#8B93AA;font-size:0.9rem;margin:0 0 20px;}
.modifica-status{padding:16px;border-radius:8px;font-size:0.92rem;line-height:1.6;background:#1B2027;color:#EDEAE3;}
.modifica-status.error{background:rgba(200,70,70,0.12);color:#e08a8a;}
.modifica-status.success{background:rgba(76,175,109,0.12);color:#4caf6d;}
.modifica-status.small{margin-bottom:14px;padding:10px 14px;font-size:0.82rem;}
.modifica-form{display:flex;flex-direction:column;gap:14px;margin-top:18px;}
.mf-field{display:flex;flex-direction:column;gap:4px;flex:1;font-size:0.85rem;color:#EDEAE3;}
.mf-field span{opacity:0.85;}
.mf-field input,.mf-field textarea{padding:10px 12px;border-radius:8px;border:1px solid #333;background:#12151c;color:#fff;font-family:inherit;}
.mf-row{display:flex;gap:12px;flex-wrap:wrap;}
.mf-save{padding:12px;border-radius:8px;border:none;background:#B08D57;color:#12151c;font-weight:700;cursor:pointer;}
.mf-save:disabled{opacity:0.6;cursor:not-allowed;}
.mf-cancel{padding:12px;border-radius:8px;border:1px solid #C84646;background:none;color:#e08a8a;font-weight:600;cursor:pointer;}
.mf-cancel:disabled{opacity:0.6;cursor:not-allowed;}
</style>
