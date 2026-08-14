<script setup>
/* =========================================================
   BookingForm.vue — form di prenotazione CONDIVISO lato cliente.
   Contiene solo i campi che il cliente deve compilare (nessun campo
   operativo/admin: niente stato, priorità, sorgente, veicolo,
   autista, importo, pagamento — quelli si gestiscono solo dal
   pannello Admin/ncc-fleet).

   Riusabile su più siti (Grifone/Amedeo, Masarat...): basta passare
   le props `db` (istanza Firestore già inizializzata dal sito
   ospitante) e `whatsappNumber`.

   Salvataggio: stessa forma attuale — un documento nella collection
   "bookings" (il mirror verso "prenotazioni" nel pannello ncc-fleet
   resta gestito da Admin.vue, invariato). In più vengono salvati i
   nuovi campi (tipoServizio, zona, dataOra ISO, volo, passeggeri,
   bagagli) con gli STESSI id usati in bookingConstants.js del
   pannello fleet, così il mirror futuro non richiede mapping.
   ========================================================= */
import { reactive, ref, computed, watch } from 'vue';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

const props = defineProps({
  db: { type: Object, default: null },           // istanza Firestore del sito ospitante (opzionale)
  whatsappNumber: { type: String, required: true }, // es. '393520003122'
  lang: { type: String, default: 'ar' },           // 'ar' | 'it' | 'en'
  brandName: { type: String, default: 'Grifone NCC' },
  // Precompilazione da pulsanti della pagina (es. "seleziona auto",
  // ricerca hero, card viaggio). `note` è un testo di contesto
  // automatico (non un campo visibile) aggiunto al messaggio WhatsApp
  // e a "details" su Firestore — non compare come input per il cliente.
  prefill: { type: Object, default: null },
});

const emit = defineEmits(['sent']);

/* ---------- Stessi id/label del pannello fleet (bookingConstants.js) ---------- */
const TIPI_SERVIZIO = [
  { id: 'aeroporto', ar: 'مطار', it: 'Aeroporto', en: 'Airport' },
  { id: 'business', ar: 'أعمال', it: 'Business', en: 'Business' },
  { id: 'milano', ar: 'تنقل داخل ميلانو', it: 'Milano', en: 'Within Milan' },
  { id: 'evento', ar: 'فعالية / مناسبة', it: 'Evento', en: 'Event' },
  { id: 'intercity', ar: 'بين المدن', it: 'Intercity', en: 'Intercity' },
  { id: 'altro', ar: 'أخرى', it: 'Altro', en: 'Other' },
];

const LINGUE = [
  { id: 'ar', ar: 'العربية', it: 'Arabo', en: 'Arabic' },
  { id: 'it', ar: 'Italiano', it: 'Italiano', en: 'Italian' },
  { id: 'en', ar: 'English', it: 'Inglese', en: 'English' },
  { id: 'altro', ar: 'أخرى', it: 'Altro', en: 'Other' },
];

/* ---------- Testi UI nelle 3 lingue ---------- */
const UI = {
  ar: {
    title: 'حجز جديد', name: 'اسم العميل', whatsapp: 'رقم WhatsApp',
    lingua: 'اللغة', tipoServizio: 'نوع الخدمة', dataOra: 'تاريخ ووقت الاستلام',
    zona: 'نقطة الاستلام', destinazione: 'الوجهة', volo: 'رقم الرحلة',
    passeggeri: 'الركاب', bagagli: 'الحقائب', gdpr: 'أوافق على معالجة بياناتي لغرض الرد على طلب الحجز',
    submit: 'إرسال عبر واتساب', success: 'تم إرسال الطلب بنجاح ✅',
  },
  it: {
    title: 'Nuova Prenotazione', name: 'Nome cliente', whatsapp: 'Numero WhatsApp',
    lingua: 'Lingua', tipoServizio: 'Tipo servizio', dataOra: 'Data e ora ritiro',
    zona: 'Punto di ritiro', destinazione: 'Destinazione', volo: 'Numero volo',
    passeggeri: 'Passeggeri', bagagli: 'Bagagli', gdpr: 'Acconsento al trattamento dei dati per rispondere alla richiesta di prenotazione',
    submit: 'Invia su WhatsApp', success: 'Richiesta inviata con successo ✅',
  },
  en: {
    title: 'New Booking', name: 'Client name', whatsapp: 'WhatsApp number',
    lingua: 'Language', tipoServizio: 'Service type', dataOra: 'Pickup date & time',
    zona: 'Pickup point', destinazione: 'Destination', volo: 'Flight number',
    passeggeri: 'Passengers', bagagli: 'Luggage', gdpr: 'I agree to the processing of my data to reply to this booking request',
    submit: 'Send via WhatsApp', success: 'Request sent successfully ✅',
  },
};
const t = computed(() => UI[props.lang] || UI.ar);
const label = (item) => `${item.ar} | ${item.it}`;

/* ---------- Stato del form ---------- */
const form = reactive({
  name: '',
  country: '+39',
  phone: '',
  lingua: props.lang === 'en' ? 'en' : props.lang === 'it' ? 'it' : 'ar',
  tipoServizio: 'aeroporto',
  dataOra: '',
  zona: '',
  destinazione: '',
  volo: '',
  passeggeri: '',
  bagagli: '',
  gdpr: false,
  website: '', // honeypot anti-bot — deve restare vuoto
});
const note = ref(''); // contesto automatico, non un campo del form
const showSuccess = ref(false);
const sending = ref(false);

const showFlightField = computed(() => form.tipoServizio === 'aeroporto');

// Applica i valori arrivati dai pulsanti della pagina (ricerca hero,
// "seleziona auto", card viaggio...) ogni volta che cambiano.
watch(() => props.prefill, (p) => {
  if (!p) return;
  if (p.tipoServizio) form.tipoServizio = p.tipoServizio;
  if (p.destinazione) form.destinazione = p.destinazione;
  if (p.zona) form.zona = p.zona;
  if (p.dataOra) form.dataOra = p.dataOra;
  if (p.note) note.value = note.value ? `${note.value} | ${p.note}` : p.note;
}, { deep: true });

function resetForm() {
  Object.assign(form, {
    name: '', country: '+39', phone: '', lingua: form.lingua, tipoServizio: 'aeroporto',
    dataOra: '', zona: '', destinazione: '', volo: '', passeggeri: '', bagagli: '',
    gdpr: false, website: '',
  });
}

async function saveToFirestore(snapshot) {
  if (!props.db) return;
  try {
    await addDoc(collection(props.db, 'bookings'), {
      // campi storici (compatibilità con il mirror attuale in Admin.vue)
      name: snapshot.name,
      country: snapshot.country,
      phone: snapshot.phone,
      service: TIPI_SERVIZIO.find(s => s.id === snapshot.tipoServizio)?.it || snapshot.tipoServizio,
      serviceDate: snapshot.dataOra ? snapshot.dataOra.slice(0, 10) : '',
      people: snapshot.passeggeri || null,
      flight: snapshot.volo || null,
      hotel: snapshot.destinazione || null,
      bags: snapshot.bagagli || null,
      details: snapshot.note || null,
      lang: snapshot.lingua || 'ar',
      // nuovi campi — stessi id di bookingConstants.js (ncc-fleet)
      tipoServizio: snapshot.tipoServizio,
      lingua: snapshot.lingua,
      dataOra: snapshot.dataOra || null,
      zona: snapshot.zona || null,
      destinazione: snapshot.destinazione || null,
      volo: snapshot.volo || null,
      passeggeri: snapshot.passeggeri || null,
      bagagli: snapshot.bagagli || null,
      confirmed: false,
      createdAt: serverTimestamp(),
    });
  } catch (e) {
    console.warn('Impossibile salvare la prenotazione su Firestore:', e);
  }
}

function submitBooking() {
  // honeypot: bot rilevato → reset silenzioso, nessun invio
  if (form.website) { resetForm(); return; }
  if (!form.name || !form.phone || !form.gdpr) return;

  sending.value = true;
  const servizioLabel = TIPI_SERVIZIO.find(s => s.id === form.tipoServizio);
  const lines = [
    `📋 ${form.name ? '' : ''}Nuova richiesta di prenotazione — ${props.brandName}`,
    `Nome: ${form.name}`,
    `Telefono: ${form.country} ${form.phone}`,
    `Servizio: ${servizioLabel ? label(servizioLabel) : form.tipoServizio}`,
  ];
  if (form.dataOra) lines.push(`Data/ora ritiro: ${form.dataOra.replace('T', ' ')}`);
  if (form.zona) lines.push(`Punto di ritiro: ${form.zona}`);
  if (form.destinazione) lines.push(`Destinazione: ${form.destinazione}`);
  if (form.volo) lines.push(`Volo: ${form.volo}`);
  if (form.passeggeri) lines.push(`Passeggeri: ${form.passeggeri}`);
  if (form.bagagli) lines.push(`Bagagli: ${form.bagagli}`);
  if (note.value) lines.push(`Note: ${note.value}`);

  const text = encodeURIComponent(lines.join('\n'));
  showSuccess.value = true;

  saveToFirestore({ ...form, note: note.value });
  emit('sent', { ...form, note: note.value });

  window.location.href = `https://wa.me/${props.whatsappNumber}?text=${text}`;

  resetForm();
  note.value = '';
  sending.value = false;
  setTimeout(() => (showSuccess.value = false), 4000);
}
</script>

<template>
  <form class="booking-form" @submit.prevent="submitBooking" :dir="lang === 'ar' ? 'rtl' : 'ltr'">
    <h3 class="bf-title">{{ t.title }}</h3>

    <!-- honeypot anti-bot: rimane nascosto e vuoto per un utente reale -->
    <input type="text" v-model="form.website" tabindex="-1" autocomplete="off" class="bf-honeypot">

    <label class="bf-field">
      <span>{{ t.name }}</span>
      <input type="text" v-model.trim="form.name" required maxlength="100">
    </label>

    <div class="bf-row">
      <label class="bf-field">
        <span>{{ t.whatsapp }}</span>
        <div class="bf-phone">
          <select v-model="form.country">
            <option value="+39">+39</option>
            <option value="+966">+966</option>
            <option value="+971">+971</option>
            <option value="+20">+20</option>
            <option value="+962">+962</option>
            <option value="+961">+961</option>
          </select>
          <input type="tel" v-model.trim="form.phone" required maxlength="20" placeholder="333 000 0000">
        </div>
      </label>

      <label class="bf-field">
        <span>{{ t.lingua }}</span>
        <select v-model="form.lingua">
          <option v-for="l in LINGUE" :key="l.id" :value="l.id">{{ label(l) }}</option>
        </select>
      </label>
    </div>

    <label class="bf-field">
      <span>{{ t.tipoServizio }}</span>
      <select v-model="form.tipoServizio">
        <option v-for="s in TIPI_SERVIZIO" :key="s.id" :value="s.id">{{ label(s) }}</option>
      </select>
    </label>

    <label class="bf-field">
      <span>{{ t.dataOra }}</span>
      <input type="datetime-local" v-model="form.dataOra">
    </label>

    <div class="bf-row">
      <label class="bf-field">
        <span>{{ t.zona }}</span>
        <input type="text" v-model.trim="form.zona" maxlength="120">
      </label>
      <label class="bf-field">
        <span>{{ t.destinazione }}</span>
        <input type="text" v-model.trim="form.destinazione" maxlength="120">
      </label>
    </div>

    <div class="bf-row">
      <label class="bf-field" v-if="showFlightField">
        <span>{{ t.volo }}</span>
        <input type="text" v-model.trim="form.volo" maxlength="20">
      </label>
      <label class="bf-field">
        <span>{{ t.passeggeri }}</span>
        <input type="number" min="1" v-model="form.passeggeri">
      </label>
      <label class="bf-field">
        <span>{{ t.bagagli }}</span>
        <input type="number" min="0" v-model="form.bagagli">
      </label>
    </div>

    <label class="bf-gdpr">
      <input type="checkbox" v-model="form.gdpr" required>
      <span>{{ t.gdpr }}</span>
    </label>

    <button type="submit" class="bf-submit" :disabled="sending">{{ t.submit }}</button>

    <p v-if="showSuccess" class="bf-success">{{ t.success }}</p>
  </form>
</template>

<style scoped>
.booking-form { display: flex; flex-direction: column; gap: 14px; max-width: 560px; }
.bf-title { margin: 0 0 4px; font-size: 1.3rem; color: #d9a441; }
.bf-honeypot { position: absolute; left: -9999px; width: 1px; height: 1px; opacity: 0; }
.bf-field { display: flex; flex-direction: column; gap: 4px; flex: 1; font-size: .85rem; }
.bf-field span { opacity: .85; }
.bf-field input, .bf-field select { padding: 10px 12px; border-radius: 8px; border: 1px solid #333; background: #12151c; color: #fff; }
.bf-row { display: flex; gap: 12px; flex-wrap: wrap; }
.bf-phone { display: flex; gap: 6px; }
.bf-phone select { flex: 0 0 90px; }
.bf-phone input { flex: 1; }
.bf-gdpr { display: flex; align-items: flex-start; gap: 8px; font-size: .78rem; opacity: .85; }
.bf-submit { padding: 12px; border-radius: 8px; border: none; background: #d9a441; color: #12151c; font-weight: 700; cursor: pointer; }
.bf-submit:disabled { opacity: .6; cursor: not-allowed; }
.bf-success { color: #4caf6d; font-size: .85rem; }
</style>
