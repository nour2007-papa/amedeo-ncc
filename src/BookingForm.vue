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
import { reactive, ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { sanitizeInput, validateName, validatePhone, validateDate, validateFlightNumber, validateNumberPeople, validateNumberBags } from './validation.js';

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

/* ---------- Titolo/appellativo del cliente (Sig./Sig.ra/Sig.na) ---------- */
const TITOLI = [
  { id: '', ar: '—', it: '—', en: '—' },
  { id: 'sig', ar: 'السيد', it: 'Sig.', en: 'Mr.' },
  { id: 'sigra', ar: 'السيدة', it: 'Sig.ra', en: 'Mrs.' },
  { id: 'signa', ar: 'الآنسة', it: 'Sig.na', en: 'Miss' },
];

/* ---------- Testi UI nelle 3 lingue ---------- */
const UI = {
  ar: {
    title: 'حجز جديد', titolo: 'اللقب', name: 'اسم العميل', whatsapp: 'رقم WhatsApp',
    lingua: 'اللغة', tipoServizio: 'نوع الخدمة', dataOra: 'تاريخ ووقت الاستلام',
    zona: 'نقطة الاستلام', destinazione: 'الوجهة', volo: 'رقم الرحلة',
    passeggeri: 'الركاب', bagagli: 'الحقائب', gdpr: 'أوافق على معالجة بياناتي لغرض الرد على طلب الحجز',
    submit: 'إرسال عبر واتساب', success: 'تم إرسال الطلب بنجاح ✅',
  },
  it: {
    title: 'Nuova Prenotazione', titolo: 'Titolo', name: 'Nome cliente', whatsapp: 'Numero WhatsApp',
    lingua: 'Lingua', tipoServizio: 'Tipo servizio', dataOra: 'Data e ora ritiro',
    zona: 'Punto di ritiro', destinazione: 'Destinazione', volo: 'Numero volo',
    passeggeri: 'Passeggeri', bagagli: 'Bagagli', gdpr: 'Acconsento al trattamento dei dati per rispondere alla richiesta di prenotazione',
    submit: 'Invia su WhatsApp', success: 'Richiesta inviata con successo ✅',
  },
  en: {
    title: 'New Booking', titolo: 'Title', name: 'Client name', whatsapp: 'WhatsApp number',
    lingua: 'Language', tipoServizio: 'Service type', dataOra: 'Pickup date & time',
    zona: 'Pickup point', destinazione: 'Destination', volo: 'Flight number',
    passeggeri: 'Passengers', bagagli: 'Luggage', gdpr: 'I agree to the processing of my data to reply to this booking request',
    submit: 'Send via WhatsApp', success: 'Request sent successfully ✅',
  },
};
const t = computed(() => UI[props.lang] || UI.ar);
// Mostra il testo bilingue solo per l'arabo; per IT/EN mostra solo la lingua del sito.
const label = (item) => (props.lang === 'ar' ? `${item.ar} | ${item.it}` : (item[props.lang] || item.it));

/* ---------- Lista prefissi telefonici + bandiere (invariata dall'originale) ---------- */
const countryCodes = [
  { code: '+966', name: 'السعودية', iso2: 'sa' },
  { code: '+971', name: 'الإمارات', iso2: 'ae' },
  { code: '+965', name: 'الكويت', iso2: 'kw' },
  { code: '+974', name: 'قطر', iso2: 'qa' },
  { code: '+973', name: 'البحرين', iso2: 'bh' },
  { code: '+968', name: 'عمان', iso2: 'om' },
  { code: '+20', name: 'مصر', iso2: 'eg' },
  { code: '+962', name: 'الأردن', iso2: 'jo' },
  { code: '+961', name: 'لبنان', iso2: 'lb' },
  { code: '+963', name: 'سوريا', iso2: 'sy' },
  { code: '+964', name: 'العراق', iso2: 'iq' },
  { code: '+967', name: 'اليمن', iso2: 'ye' },
  { code: '+970', name: 'فلسطين', iso2: 'ps' },
  { code: '+212', name: 'المغرب', iso2: 'ma' },
  { code: '+213', name: 'الجزائر', iso2: 'dz' },
  { code: '+216', name: 'تونس', iso2: 'tn' },
  { code: '+218', name: 'ليبيا', iso2: 'ly' },
  { code: '+249', name: 'السودان', iso2: 'sd' },
  { code: '+252', name: 'الصومال', iso2: 'so' },
  { code: '+222', name: 'موريتانيا', iso2: 'mr' },
  { code: '+269', name: 'جزر القمر', iso2: 'km' },
  { code: '+253', name: 'جيبوتي', iso2: 'dj' },
  { code: '+39', name: 'Italia', iso2: 'it' },
  { code: '+41', name: 'Svizzera', iso2: 'ch' },
  { code: '+33', name: 'Francia', iso2: 'fr' },
  { code: '+43', name: 'Austria', iso2: 'at' },
  { code: '+386', name: 'Slovenia', iso2: 'si' },
  { code: '+378', name: 'San Marino', iso2: 'sm' },
  { code: '+379', name: 'Vaticano', iso2: 'va' },
  { code: '+356', name: 'Malta', iso2: 'mt' },
  { code: '+385', name: 'Croazia', iso2: 'hr' },
  { code: '+30', name: 'Grecia', iso2: 'gr' },
  { code: '+377', name: 'Monaco', iso2: 'mc' },
  { code: '+355', name: 'Albania', iso2: 'al' },
  { code: '+376', name: 'Andorra', iso2: 'ad' },
  { code: '+375', name: 'Belarus', iso2: 'by' },
  { code: '+32', name: 'Belgio', iso2: 'be' },
  { code: '+387', name: 'Bosnia', iso2: 'ba' },
  { code: '+359', name: 'Bulgaria', iso2: 'bg' },
  { code: '+357', name: 'Cipro', iso2: 'cy' },
  { code: '+420', name: 'Rep. Ceca', iso2: 'cz' },
  { code: '+45', name: 'Danimarca', iso2: 'dk' },
  { code: '+372', name: 'Estonia', iso2: 'ee' },
  { code: '+358', name: 'Finlandia', iso2: 'fi' },
  { code: '+49', name: 'Germania', iso2: 'de' },
  { code: '+36', name: 'Ungheria', iso2: 'hu' },
  { code: '+354', name: 'Islanda', iso2: 'is' },
  { code: '+353', name: 'Irlanda', iso2: 'ie' },
  { code: '+383', name: 'Kosovo', iso2: 'xk' },
  { code: '+371', name: 'Lettonia', iso2: 'lv' },
  { code: '+423', name: 'Liechtenstein', iso2: 'li' },
  { code: '+370', name: 'Lituania', iso2: 'lt' },
  { code: '+352', name: 'Lussemburgo', iso2: 'lu' },
  { code: '+373', name: 'Moldavia', iso2: 'md' },
  { code: '+382', name: 'Montenegro', iso2: 'me' },
  { code: '+31', name: 'Paesi Bassi', iso2: 'nl' },
  { code: '+389', name: 'N. Macedonia', iso2: 'mk' },
  { code: '+47', name: 'Norvegia', iso2: 'no' },
  { code: '+48', name: 'Polonia', iso2: 'pl' },
  { code: '+351', name: 'Portogallo', iso2: 'pt' },
  { code: '+40', name: 'Romania', iso2: 'ro' },
  { code: '+7', name: 'Russia', iso2: 'ru' },
  { code: '+381', name: 'Serbia', iso2: 'rs' },
  { code: '+421', name: 'Slovacchia', iso2: 'sk' },
  { code: '+34', name: 'Spagna', iso2: 'es' },
  { code: '+46', name: 'Svezia', iso2: 'se' },
  { code: '+380', name: 'Ucraina', iso2: 'ua' },
  { code: '+44', name: 'Regno Unito', iso2: 'gb' },
  { code: '+93', name: 'Afghanistan', iso2: 'af' },
  { code: '+244', name: 'Angola', iso2: 'ao' },
  { code: '+1268', name: 'Antigua', iso2: 'ag' },
  { code: '+54', name: 'Argentina', iso2: 'ar' },
  { code: '+374', name: 'Armenia', iso2: 'am' },
  { code: '+61', name: 'Australia', iso2: 'au' },
  { code: '+994', name: 'Azerbaijan', iso2: 'az' },
  { code: '+1242', name: 'Bahamas', iso2: 'bs' },
  { code: '+880', name: 'Bangladesh', iso2: 'bd' },
  { code: '+1246', name: 'Barbados', iso2: 'bb' },
  { code: '+501', name: 'Belize', iso2: 'bz' },
  { code: '+229', name: 'Benin', iso2: 'bj' },
  { code: '+975', name: 'Bhutan', iso2: 'bt' },
  { code: '+591', name: 'Bolivia', iso2: 'bo' },
  { code: '+267', name: 'Botswana', iso2: 'bw' },
  { code: '+55', name: 'Brasile', iso2: 'br' },
  { code: '+673', name: 'Brunei', iso2: 'bn' },
  { code: '+226', name: 'Burkina Faso', iso2: 'bf' },
  { code: '+257', name: 'Burundi', iso2: 'bi' },
  { code: '+855', name: 'Cambodia', iso2: 'kh' },
  { code: '+237', name: 'Cameroon', iso2: 'cm' },
  { code: '+1', name: 'Canada', iso2: 'ca' },
  { code: '+238', name: 'Cape Verde', iso2: 'cv' },
  { code: '+236', name: 'Central African Rep.', iso2: 'cf' },
  { code: '+235', name: 'Chad', iso2: 'td' },
  { code: '+56', name: 'Chile', iso2: 'cl' },
  { code: '+86', name: 'Cina', iso2: 'cn' },
  { code: '+57', name: 'Colombia', iso2: 'co' },
  { code: '+242', name: 'Congo', iso2: 'cg' },
  { code: '+243', name: 'Congo RD', iso2: 'cd' },
  { code: '+506', name: 'Costa Rica', iso2: 'cr' },
  { code: '+53', name: 'Cuba', iso2: 'cu' },
  { code: '+1767', name: 'Dominica', iso2: 'dm' },
  { code: '+1809', name: 'Rep. Dominicana', iso2: 'do' },
  { code: '+593', name: 'Ecuador', iso2: 'ec' },
  { code: '+503', name: 'El Salvador', iso2: 'sv' },
  { code: '+240', name: 'Guinea Equatoriale', iso2: 'gq' },
  { code: '+291', name: 'Eritrea', iso2: 'er' },
  { code: '+268', name: 'Eswatini', iso2: 'sz' },
  { code: '+251', name: 'Etiopia', iso2: 'et' },
  { code: '+679', name: 'Fiji', iso2: 'fj' },
  { code: '+241', name: 'Gabon', iso2: 'ga' },
  { code: '+220', name: 'Gambia', iso2: 'gm' },
  { code: '+995', name: 'Georgia', iso2: 'ge' },
  { code: '+233', name: 'Ghana', iso2: 'gh' },
  { code: '+1473', name: 'Grenada', iso2: 'gd' },
  { code: '+502', name: 'Guatemala', iso2: 'gt' },
  { code: '+224', name: 'Guinea', iso2: 'gn' },
  { code: '+245', name: 'Guinea-Bissau', iso2: 'gw' },
  { code: '+592', name: 'Guyana', iso2: 'gy' },
  { code: '+509', name: 'Haiti', iso2: 'ht' },
  { code: '+504', name: 'Honduras', iso2: 'hn' },
  { code: '+852', name: 'Hong Kong', iso2: 'hk' },
  { code: '+91', name: 'India', iso2: 'in' },
  { code: '+62', name: 'Indonesia', iso2: 'id' },
  { code: '+98', name: 'Iran', iso2: 'ir' },
  { code: '+972', name: 'Israele', iso2: 'il' },
  { code: '+1876', name: 'Giamaica', iso2: 'jm' },
  { code: '+81', name: 'Giappone', iso2: 'jp' },
  { code: '+7', name: 'Kazakhstan', iso2: 'kz' },
  { code: '+254', name: 'Kenya', iso2: 'ke' },
  { code: '+686', name: 'Kiribati', iso2: 'ki' },
  { code: '+850', name: 'Corea del Nord', iso2: 'kp' },
  { code: '+82', name: 'Corea del Sud', iso2: 'kr' },
  { code: '+996', name: 'Kyrgyzstan', iso2: 'kg' },
  { code: '+856', name: 'Laos', iso2: 'la' },
  { code: '+266', name: 'Lesotho', iso2: 'ls' },
  { code: '+231', name: 'Liberia', iso2: 'lr' },
  { code: '+853', name: 'Macao', iso2: 'mo' },
  { code: '+261', name: 'Madagascar', iso2: 'mg' },
  { code: '+265', name: 'Malawi', iso2: 'mw' },
  { code: '+60', name: 'Malesia', iso2: 'my' },
  { code: '+960', name: 'Maldive', iso2: 'mv' },
  { code: '+223', name: 'Mali', iso2: 'ml' },
  { code: '+692', name: 'Marshall', iso2: 'mh' },
  { code: '+230', name: 'Mauritius', iso2: 'mu' },
  { code: '+52', name: 'Messico', iso2: 'mx' },
  { code: '+691', name: 'Micronesia', iso2: 'fm' },
  { code: '+976', name: 'Mongolia', iso2: 'mn' },
  { code: '+258', name: 'Mozambico', iso2: 'mz' },
  { code: '+95', name: 'Myanmar', iso2: 'mm' },
  { code: '+264', name: 'Namibia', iso2: 'na' },
  { code: '+674', name: 'Nauru', iso2: 'nr' },
  { code: '+977', name: 'Nepal', iso2: 'np' },
  { code: '+64', name: 'Nuova Zelanda', iso2: 'nz' },
  { code: '+505', name: 'Nicaragua', iso2: 'ni' },
  { code: '+227', name: 'Niger', iso2: 'ne' },
  { code: '+234', name: 'Nigeria', iso2: 'ng' },
  { code: '+92', name: 'Pakistan', iso2: 'pk' },
  { code: '+680', name: 'Palau', iso2: 'pw' },
  { code: '+507', name: 'Panama', iso2: 'pa' },
  { code: '+675', name: 'Papua N.G.', iso2: 'pg' },
  { code: '+595', name: 'Paraguay', iso2: 'py' },
  { code: '+51', name: 'Perù', iso2: 'pe' },
  { code: '+63', name: 'Filippine', iso2: 'ph' },
  { code: '+250', name: 'Rwanda', iso2: 'rw' },
  { code: '+1869', name: 'Saint Kitts', iso2: 'kn' },
  { code: '+1758', name: 'Saint Lucia', iso2: 'lc' },
  { code: '+1784', name: 'Saint Vincent', iso2: 'vc' },
  { code: '+685', name: 'Samoa', iso2: 'ws' },
  { code: '+239', name: 'São Tomé', iso2: 'st' },
  { code: '+221', name: 'Senegal', iso2: 'sn' },
  { code: '+248', name: 'Seychelles', iso2: 'sc' },
  { code: '+232', name: 'Sierra Leone', iso2: 'sl' },
  { code: '+65', name: 'Singapore', iso2: 'sg' },
  { code: '+677', name: 'Solomon', iso2: 'sb' },
  { code: '+27', name: 'Sudafrica', iso2: 'za' },
  { code: '+211', name: 'Sud Sudan', iso2: 'ss' },
  { code: '+94', name: 'Sri Lanka', iso2: 'lk' },
  { code: '+597', name: 'Suriname', iso2: 'sr' },
  { code: '+886', name: 'Taiwan', iso2: 'tw' },
  { code: '+992', name: 'Tagikistan', iso2: 'tj' },
  { code: '+255', name: 'Tanzania', iso2: 'tz' },
  { code: '+66', name: 'Thailandia', iso2: 'th' },
  { code: '+670', name: 'Timor Est', iso2: 'tl' },
  { code: '+228', name: 'Togo', iso2: 'tg' },
  { code: '+676', name: 'Tonga', iso2: 'to' },
  { code: '+1868', name: 'Trinidad', iso2: 'tt' },
  { code: '+90', name: 'Turchia', iso2: 'tr' },
  { code: '+993', name: 'Turkmenistan', iso2: 'tm' },
  { code: '+688', name: 'Tuvalu', iso2: 'tv' },
  { code: '+256', name: 'Uganda', iso2: 'ug' },
  { code: '+1', name: 'Stati Uniti', iso2: 'us' },
  { code: '+598', name: 'Uruguay', iso2: 'uy' },
  { code: '+998', name: 'Uzbekistan', iso2: 'uz' },
  { code: '+678', name: 'Vanuatu', iso2: 'vu' },
  { code: '+58', name: 'Venezuela', iso2: 've' },
  { code: '+84', name: 'Vietnam', iso2: 'vn' },
  { code: '+260', name: 'Zambia', iso2: 'zm' },
  { code: '+263', name: 'Zimbabwe', iso2: 'zw' },
];


/* ---------- Stato del form ---------- */
const form = reactive({
  name: '',
  titolo: '',
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

/* ---------- Dropdown prefisso telefonico con bandiere (invariato dall'originale) ---------- */
const countryOpen = ref(false);
const countrySearch = ref('');
const selectedCountryIso2 = ref('it'); // corrisponde al default form.country = '+39'
const countrySelectRef = ref(null);

const selectedCountry = computed(() =>
  countryCodes.find(c => c.iso2 === selectedCountryIso2.value) ||
  countryCodes.find(c => c.code === form.country) ||
  countryCodes[0]
);

const filteredCountries = computed(() => {
  const q = countrySearch.value.trim().toLowerCase();
  if (!q) return countryCodes;
  return countryCodes.filter(c =>
    c.name.toLowerCase().includes(q) || c.code.includes(q)
  );
});

function toggleCountryDropdown() {
  countryOpen.value = !countryOpen.value;
  if (countryOpen.value) countrySearch.value = '';
}
function selectCountry(c) {
  form.country = c.code;
  selectedCountryIso2.value = c.iso2;
  countryOpen.value = false;
}
function handleCountryClickOutside(event) {
  if (countryOpen.value && countrySelectRef.value && !countrySelectRef.value.contains(event.target)) {
    countryOpen.value = false;
  }
}
onMounted(() => document.addEventListener('click', handleCountryClickOutside));
onUnmounted(() => document.removeEventListener('click', handleCountryClickOutside));

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
    name: '', titolo: '', country: '+39', phone: '', lingua: form.lingua, tipoServizio: 'aeroporto',
    dataOra: '', zona: '', destinazione: '', volo: '', passeggeri: '', bagagli: '',
    gdpr: false, website: '',
  });
  selectedCountryIso2.value = 'it';
}

async function saveToFirestore(snapshot) {
  if (!props.db) return;
  try {
    await addDoc(collection(props.db, 'bookings'), {
      // campi storici (compatibilità con il mirror attuale in Admin.vue)
      name: snapshot.name,
      titolo: snapshot.titolo || null,
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
    console.error('Impossibile salvare la prenotazione su Firestore:', e);
    throw new Error('Si è verificato un errore durante il salvataggio. Riprova o contatta direttamente via WhatsApp.');
  }
}

async function submitBooking() {
  // honeypot: bot rilevato → reset silenzioso, nessun invio
  if (form.website) { resetForm(); return; }
  if (!form.name || !form.phone || !form.gdpr) return;

  // Validation
  if (!validateName(form.name)) {
    alert('Per favore inserisci un nome valido (minimo 2 caratteri).');
    return;
  }
  if (!validatePhone(form.phone)) {
    alert('Per favore inserisci un numero di telefono valido.');
    return;
  }
  if (form.dataOra && !validateDate(form.dataOra)) {
    alert('La data del servizio deve essere nel futuro.');
    return;
  }
  if (form.volo && !validateFlightNumber(form.volo)) {
    alert('Il numero di volo non è valido (es. AZ1234).');
    return;
  }
  if (form.passeggeri && !validateNumberPeople(form.passeggeri)) {
    alert('Il numero di passeggeri deve essere tra 1 e 20.');
    return;
  }
  if (form.bagagli && !validateNumberBags(form.bagagli)) {
    alert('Il numero di bagagli deve essere tra 0 e 20.');
    return;
  }

  // Sanitize inputs
  form.name = sanitizeInput(form.name);
  form.zona = sanitizeInput(form.zona);
  form.destinazione = sanitizeInput(form.destinazione);
  form.volo = sanitizeInput(form.volo);
  note.value = sanitizeInput(note.value);

  sending.value = true;
  const servizioLabel = TIPI_SERVIZIO.find(s => s.id === form.tipoServizio);
  const titoloItem = TITOLI.find(t2 => t2.id === form.titolo);
  const titoloPrefix = titoloItem && titoloItem.id ? `${label(titoloItem)} ` : '';
  const lines = [
    `📋 ${form.name ? '' : ''}Nuova richiesta di prenotazione — ${props.brandName}`,
    `Nome: ${titoloPrefix}${form.name}`,
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

  // ننتظر الحفظ في Firestore يخلص قبل ما نحول العميل لواتساب،
  // عشان المتصفح (خصوصًا الموبايل) ميلغيش الطلب لما تتغير الصفحة
  try {
    await saveToFirestore({ ...form, note: note.value });
  } catch (error) {
    console.error('Errore durante il salvataggio:', error);
    alert('Si è verificato un errore. Il tuo messaggio verrà comunque inviato via WhatsApp.');
  }
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

    <div class="bf-row">
      <label class="bf-field bf-field-titolo">
        <span>{{ t.titolo }}</span>
        <select v-model="form.titolo">
          <option v-for="item in TITOLI" :key="item.id" :value="item.id">{{ label(item) }}</option>
        </select>
      </label>

      <label class="bf-field bf-field-name">
        <span>{{ t.name }}</span>
        <input type="text" v-model.trim="form.name" required maxlength="100">
      </label>
    </div>

    <div class="bf-row">
      <label class="bf-field">
        <span>{{ t.whatsapp }}</span>
        <div class="phone-row">
          <div class="country-select" ref="countrySelectRef" :class="{ open: countryOpen }">
            <button type="button" class="country-select-btn" @click="toggleCountryDropdown" :aria-expanded="countryOpen" aria-haspopup="listbox">
              <img :src="`https://flagcdn.com/24x18/${selectedCountry.iso2}.png`" :alt="`Bandiera ${selectedCountry.name}`" width="22" height="16" class="country-flag">
              <span>{{ selectedCountry.code }}</span>
              <svg class="country-chevron" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
            </button>
            <div v-if="countryOpen" class="country-dropdown" role="listbox">
              <input type="text" v-model="countrySearch" class="country-search" placeholder="..." @click.stop>
              <div class="country-list">
                <button type="button" v-for="c in filteredCountries" :key="c.code + c.iso2" class="country-item" role="option" @click="selectCountry(c)">
                  <img :src="`https://flagcdn.com/24x18/${c.iso2}.png`" :alt="`Bandiera ${c.name}`" width="22" height="16" loading="lazy">
                  <span class="country-item-name">{{ c.name }}</span>
                  <span class="country-item-code">{{ c.code }}</span>
                </button>
                <div v-if="filteredCountries.length === 0" class="country-empty">—</div>
              </div>
            </div>
          </div>
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
.bf-field-titolo { flex: 0 0 110px; min-width: 90px; }
.bf-field-titolo select { padding-left: 8px; padding-right: 6px; }
.bf-field-name { flex: 1 1 auto; }
.bf-row { display: flex; gap: 12px; flex-wrap: wrap; }
.bf-gdpr { display: flex; align-items: flex-start; gap: 8px; font-size: .78rem; opacity: .85; }
.bf-submit { padding: 12px; border-radius: 8px; border: none; background: #d9a441; color: #12151c; font-weight: 700; cursor: pointer; }
.bf-submit:disabled { opacity: .6; cursor: not-allowed; }
.bf-success { color: #4caf6d; font-size: .85rem; }

/* Dropdown prefisso telefonico con bandiere — stesso stile dell'originale */
.phone-row{display:flex;gap:8px;}
.phone-row input{flex:1;padding:10px 12px;border-radius:8px;border:1px solid #333;background:#12151c;color:#fff;}
.country-select{position:relative;flex:0 0 108px;}
.country-select-btn{
  display:flex;align-items:center;gap:6px;width:100%;height:100%;
  background:var(--surface,#14181D);border:1px solid var(--line,#262B31);color:var(--paper,#EDEAE3);
  padding:10px 8px;border-radius:8px;font-family:'Work Sans',sans-serif;font-size:0.88rem;
  cursor:pointer;
}
.country-select-btn:hover,.country-select.open .country-select-btn{border-color:var(--brass,#B08D57);}
.country-flag{border-radius:2px;display:block;flex-shrink:0;}
.country-chevron{margin-left:auto;color:var(--steel,#8B93AA);flex-shrink:0;}
.country-select.open .country-chevron{transform:rotate(180deg);}
.country-dropdown{
  position:absolute;top:calc(100% + 6px);left:0;z-index:50;
  width:280px;max-width:80vw;background:var(--surface-2,#1B2027);
  border:1px solid var(--line,#262B31);box-shadow:0 12px 32px rgba(0,0,0,0.5);border-radius:8px;overflow:hidden;
}
[dir="rtl"] .country-dropdown{left:auto;right:0;}
.country-search{
  width:100%;padding:12px 14px;background:var(--surface,#14181D);border:none;
  border-bottom:1px solid var(--line,#262B31);color:var(--paper,#EDEAE3);
  font-family:'Work Sans',sans-serif;font-size:0.88rem;box-sizing:border-box;
}
.country-search:focus{outline:none;}
.country-list{max-height:260px;overflow-y:auto;}
.country-item{
  display:flex;align-items:center;gap:10px;width:100%;
  padding:9px 14px;background:none;border:none;color:var(--paper,#EDEAE3);
  font-family:'Work Sans',sans-serif;font-size:0.86rem;text-align:left;
  cursor:pointer;
}
[dir="rtl"] .country-item{text-align:right;}
.country-item img{border-radius:2px;flex-shrink:0;}
.country-item:hover{background:rgba(176,141,87,0.12);}
.country-item-name{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.country-item-code{color:var(--steel,#8B93AA);font-family:'IBM Plex Mono',monospace;font-size:0.8rem;flex-shrink:0;}
.country-empty{padding:16px 14px;color:var(--steel,#8B93AA);font-size:0.86rem;text-align:center;}
</style>
