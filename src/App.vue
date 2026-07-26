<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';

/* =========================================================
   i18n dictionary (IT / EN / AR) — ported 1:1 from the
   latest final HTML (includes SEO/privacy/footer keys).
   ========================================================= */
const dict = {
  "it": {
    "routes": [
      {
        "code": "MXP → DUOMO",
        "label": "AEROPORTO MALPENSA"
      },
      {
        "code": "LIN → CITY",
        "label": "AEROPORTO LINATE"
      },
      {
        "code": "BGY → BRERA",
        "label": "AEROPORTO ORIO AL SERIO"
      },
      {
        "code": "MILANO → ROMA",
        "label": "LUNGA PERCORRENZA"
      },
      {
        "code": "MILANO → GINEVRA",
        "label": "TRANSFER EUROPA"
      },
      {
        "code": "CENTRO → FIERA",
        "label": "RAPPRESENTANZA"
      }
    ],
    "nav_services": "Servizi",
    "nav_fleet": "Flotta",
    "nav_trips": "Viaggi",
    "nav_contact": "Contatti",
    "hero_eyebrow": "Servizio NCC · Milano & Lombardia",
    "hero_title": "Il vostro autista, <em>ovunque a Milano</em>, in ogni momento.",
    "hero_sub": "Transfer aeroporto, rappresentanza, eventi ed escursioni. Operiamo dalla Lombardia verso ogni destinazione in Italia e in Europa. Puntualità, discrezione e vetture Mercedes di classe superiore — prenotabile in due minuti.",
    "hero_cta1": "Prenota una corsa",
    "hero_cta2": "Scopri i servizi",
    "search_from": "Da",
    "search_to": "A",
    "search_date": "Data",
    "search_service": "Servizio",
    "search_submit": "Richiedi preventivo",
    "stat1": "Disponibilità",
    "stat2": "Copertura viaggi",
    "stat3": "Tempo medio risposta",
    "stat4": "Lingue parlate",
    "services_title": "Servizi",
    "services_tag": "OGNI CORSA HA UN CODICE, UN ORARIO, UNA DESTINAZIONE.",
    "s1_title": "Transfer Aeroporto",
    "s1_desc": "Monitoraggio voli in tempo reale, attesa inclusa, ritiro bagagli assistito.",
    "s2_title": "Rappresentanza",
    "s2_desc": "Autista dedicato per incontri di lavoro, fiere e delegazioni straniere.",
    "s3_title": "Tour con guida",
    "s3_desc": "Itinerari su misura in città e in Lombardia, in arabo, italiano o inglese.",
    "s4_title": "Eventi & Cerimonie",
    "s4_desc": "Matrimoni, gala e serate — flotta coordinata e puntualità assoluta.",
    "s5_title": "Lunga percorrenza · Italia & Europa",
    "s5_desc": "Viaggi extraurbani da Milano verso ogni città italiana e le principali destinazioni europee.",
    "fleet_title": "Flotta",
    "fleet_tag": "VETTURE MANTENUTE E SANIFICATE PRIMA DI OGNI CORSA.",
    "c1": "Berlina executive, 3 passeggeri, ideale per transfer e rappresentanza.",
    "c2": "Il massimo del comfort per ospiti VIP e occasioni di rilievo.",
    "c3": "Van premium fino a 6 passeggeri, perfetto per famiglie e piccoli gruppi.",
    "btn_book_car": "Prenota questa auto",
    "btn_book_trip": "Richiedi questo viaggio",
    "trips_title": "Viaggi consigliati",
    "trips_tag": "GITE FUORI MILANO CON AUTISTA PRIVATO, SU RICHIESTA.",
    "v1": "La Città Eterna, a vostra disposizione per la giornata o il weekend.",
    "v2": "La Torre Pendente e Piazza dei Miracoli, in giornata da Milano.",
    "v3": "La laguna e i canali, con autista che vi aspetta per il ritorno.",
    "v4": "Il lago più elegante d'Italia, a meno di un'ora da Milano.",
    "v5": "La Torre Eiffel e i grandi viali parigini, con autista dedicato per l'intero percorso.",
    "v6": "Alpi, laghi e città come Lucerna e Zurigo, in un unico viaggio senza pensieri.",
    "v8": "Il Duomo, gli Uffizi e il Rinascimento italiano, a portata di un giorno.",
    "v9_title": "Altre mete in Italia",
    "v9_desc": "Costiera Amalfitana, Cinque Terre e molto altro — scriveteci la meta e organizziamo il viaggio.",
    "v1_title": "Roma",
    "v2_title": "Pisa",
    "v3_title": "Venezia",
    "v4_title": "Como",
    "v5_title": "Parigi",
    "v6_title": "Svizzera",
    "v8_title": "Firenze",
    "pay_cash": "Contanti",
    "pay_card": "Carte di credito",
    "pay_paypal": "PayPal",
    "pay_transfer": "🏦 Bonifico bancario",
    "img_unavailable": "IMMAGINE NON DISPONIBILE",
    "btn_other_italy": "Richiedi questa meta",
    "note_other_italy": "Meta in Italia da definire con il cliente (es. Costiera Amalfitana, Cinque Terre — indicare nel campo hotel/destinazione)",
    "v7_title": "Scegli tu la meta",
    "v7_desc": "Non vedi la tua destinazione? Ditecelo voi: organizziamo il viaggio su misura ovunque in Italia o in Europa.",
    "btn_custom_trip": "Scegli la tua destinazione",
    "note_car_prefix": "Auto richiesta",
    "note_trip_prefix": "Viaggio verso",
    "note_custom": "Destinazione da definire con il cliente (indicare la città nel campo hotel/destinazione)",
    "note_from_prefix": "Partenza da",
    "note_date_prefix": "Data",
    "contact_title": "Prenota",
    "contact_tag": "CONFERMA ENTRO 8 MINUTI DALLA RICHIESTA.",
    "f_name": "Nome e cognome",
    "f_phone": "Telefono / WhatsApp",
    "f_details": "Data, ora e note aggiuntive",
    "f_people": "Numero di persone",
    "f_flight": "Numero di volo (se transfer aeroporto)",
    "f_hotel": "Hotel / indirizzo di destinazione",
    "f_bags": "Numero di valigie",
    "f_gdpr": "Accetto il trattamento dei dati personali ai sensi del GDPR.",
    "f_submit": "Invia richiesta",
    "i_phone": "Telefono",
    "i_whatsapp": "WhatsApp",
    "i_mail": "Email",
    "i_area": "Zona operativa",
    "i_hours": "Orari",
    "foot_note": "Servizio di Noleggio con Conducente autorizzato — Milano",
    "pay_title": "Metodi di pagamento accettati",
    "f_success_alert": "Reindirizzamento a WhatsApp in corso...",
    "wa_message": "Ciao 👋 vorrei prenotare un'auto con autista.\nNumero di persone: \nCittà: \nData: ",
    "pay_bank": "Bonifico bancario",
    "foot_nav": "Navigazione",
    "foot_legal": "Legale",
    "foot_privacy": "Privacy Policy",
    "foot_cookies": "Cookie Policy",
    "foot_terms": "Termini e condizioni",
    "foot_contact_title": "Contatti",
    "privacy_title": "Informativa sulla Privacy",
    "privacy_p1": "Amedeo NCC, con sede operativa a Milano, in qualita di titolare del trattamento, raccoglie i dati personali forniti volontariamente tramite il modulo di contatto (nome, telefono, email, dati relativi al servizio richiesto) al solo fine di rispondere alle vostre richieste di prenotazione e preventivo.",
    "privacy_p2": "I dati saranno trattati in conformita al Regolamento Generale sulla Protezione dei Dati (GDPR, Reg. UE 2016/679). Non saranno ceduti a terzi salvo obbligo di legge. I dati saranno conservati per il tempo strettamente necessario all'evasione della richiesta e comunque non oltre 24 mesi dalla raccolta.",
    "privacy_p3": "<b>Diritti dell'interessato:</b> Ai sensi degli artt. 15-22 del GDPR, avete diritto di accedere, rettificare, cancellare, limitare il trattamento, portabilita dei dati e opposizione. Per esercitare i vostri diritti, contattateci a amedeo018@libero.it.",
    "privacy_p4": "<b>Cookie:</b> Questo sito utilizza esclusivamente cookie tecnici necessari al funzionamento. Non vengono utilizzati cookie di profilazione o di terze parti.",
    "privacy_l1": "Base giuridica: consenso (modulo di contatto) e legittimo interesse (esecuzione del servizio).",
    "privacy_l2": "Responsabile della protezione dei dati: Amedeo NCC — amedeo018@libero.it",
    "privacy_p5": "Ultimo aggiornamento: Luglio 2026.",
    "cookie_text": "Utilizziamo solo cookie tecnici necessari al funzionamento di questo sito. Cliccando \"Accetta\" acconsenti all'uso dei cookie. <a href=\"#\" onclick=\"openPrivacyModal();return false;\">Informativa</a>",
    "cookie_accept": "Accetta",
    "cookie_dismiss": "Chiudi",
    "f_service_placeholder": "Scegli il servizio",
    "f_country_search": "Cerca paese o prefisso...",
    "f_country_none": "Nessun paese trovato"
  },
  "en": {
    "routes": [
      {
        "code": "MXP → DUOMO",
        "label": "MALPENSA AIRPORT"
      },
      {
        "code": "LIN → CITY",
        "label": "LINATE AIRPORT"
      },
      {
        "code": "BGY → BRERA",
        "label": "ORIO AL SERIO AIRPORT"
      },
      {
        "code": "MILANO → ROMA",
        "label": "LONG DISTANCE"
      },
      {
        "code": "MILANO → GINEVRA",
        "label": "EUROPE TRANSFER"
      },
      {
        "code": "CENTRO → FIERA",
        "label": "EXECUTIVE TRAVEL"
      }
    ],
    "nav_services": "Services",
    "nav_fleet": "Fleet",
    "nav_trips": "Trips",
    "nav_contact": "Contact",
    "hero_eyebrow": "Chauffeur Service · Milan & Lombardy",
    "hero_title": "Your driver, <em>anywhere in Milan</em>, at any moment.",
    "hero_sub": "Airport transfers, corporate travel, events and tours. We operate from Lombardy to any destination in Italy and Europe. Punctuality, discretion and premium Mercedes vehicles — booked in two minutes.",
    "hero_cta1": "Book a ride",
    "hero_cta2": "View services",
    "search_from": "From",
    "search_to": "To",
    "search_date": "Date",
    "search_service": "Service",
    "search_submit": "Get a quote",
    "stat1": "Availability",
    "stat2": "Travel coverage",
    "stat3": "Avg. response time",
    "stat4": "Languages spoken",
    "services_title": "Services",
    "services_tag": "EVERY RIDE HAS A CODE, A TIME, A DESTINATION.",
    "s1_title": "Airport Transfer",
    "s1_desc": "Real-time flight tracking, waiting time included, assisted luggage pickup.",
    "s2_title": "Corporate Travel",
    "s2_desc": "Dedicated driver for business meetings, fairs and foreign delegations.",
    "s3_title": "Guided Tours",
    "s3_desc": "Custom itineraries across the city and Lombardy, in Arabic, Italian or English.",
    "s4_title": "Events & Ceremonies",
    "s4_desc": "Weddings, galas and evenings — coordinated fleet and absolute punctuality.",
    "s5_title": "Long distance · Italy & Europe",
    "s5_desc": "Intercity travel from Milan to any Italian city and major European destinations.",
    "fleet_title": "Fleet",
    "fleet_tag": "VEHICLES SERVICED AND SANITIZED BEFORE EVERY RIDE.",
    "c1": "Executive sedan, 3 passengers, ideal for transfers and corporate travel.",
    "c2": "The utmost comfort for VIP guests and important occasions.",
    "c3": "Premium van, up to 6 passengers, perfect for families and small groups.",
    "btn_book_car": "Book this car",
    "btn_book_trip": "Request this trip",
    "trips_title": "Recommended Trips",
    "trips_tag": "DAY TRIPS FROM MILAN WITH A PRIVATE DRIVER, ON REQUEST.",
    "v1": "The Eternal City, at your disposal for the day or the weekend.",
    "v2": "The Leaning Tower and Piazza dei Miracoli, as a day trip from Milan.",
    "v3": "The lagoon and canals, with your driver waiting for the return.",
    "v4": "Italy's most elegant lake, less than an hour from Milan.",
    "v5": "The Eiffel Tower and the grand Parisian boulevards, with a dedicated driver for the whole route.",
    "v6": "Alps, lakes and cities like Lucerne and Zurich, all in one worry-free trip.",
    "v8": "The Duomo, the Uffizi and the Italian Renaissance, within a day's reach.",
    "v9_title": "Other destinations in Italy",
    "v9_desc": "Amalfi Coast, Cinque Terre and much more — tell us where and we'll arrange the trip.",
    "v1_title": "Rome",
    "v2_title": "Pisa",
    "v3_title": "Venice",
    "v4_title": "Como",
    "v5_title": "Paris",
    "v6_title": "Switzerland",
    "v8_title": "Florence",
    "pay_cash": "Cash",
    "pay_card": "Credit cards",
    "pay_paypal": "PayPal",
    "pay_transfer": "🏦 Bank transfer",
    "img_unavailable": "IMAGE NOT AVAILABLE",
    "btn_other_italy": "Request this destination",
    "note_other_italy": "Destination in Italy to be defined with the customer (e.g. Amalfi Coast, Cinque Terre — please specify in the hotel/destination field)",
    "v7_title": "You choose the destination",
    "v7_desc": "Don't see your destination? Tell us where: we'll arrange a tailor-made trip anywhere in Italy or Europe.",
    "btn_custom_trip": "Choose your destination",
    "note_car_prefix": "Requested car",
    "note_trip_prefix": "Trip to",
    "note_custom": "Destination to be defined with the customer (please enter the city in the hotel/destination field)",
    "note_from_prefix": "Pickup from",
    "note_date_prefix": "Date",
    "contact_title": "Book Now",
    "contact_tag": "CONFIRMATION WITHIN 8 MINUTES OF YOUR REQUEST.",
    "f_name": "Full name",
    "f_phone": "Phone / WhatsApp",
    "f_details": "Date, time and additional notes",
    "f_people": "Number of people",
    "f_flight": "Flight number (if airport transfer)",
    "f_hotel": "Hotel / destination address",
    "f_bags": "Number of bags",
    "f_gdpr": "I accept the processing of personal data under GDPR.",
    "f_submit": "Send request",
    "i_phone": "Phone",
    "i_whatsapp": "WhatsApp",
    "i_mail": "Email",
    "i_area": "Service area",
    "i_hours": "Hours",
    "foot_note": "Licensed Chauffeur Service (NCC) — Milan",
    "pay_title": "Accepted Payment Methods",
    "f_success_alert": "Redirecting to WhatsApp...",
    "wa_message": "Hello 👋 I would like to book a car with driver.\nNumber of people: \nCity: \nDate: ",
    "pay_bank": "Bank transfer",
    "foot_nav": "Navigation",
    "foot_legal": "Legal",
    "foot_privacy": "Privacy Policy",
    "foot_cookies": "Cookie Policy",
    "foot_terms": "Terms & Conditions",
    "foot_contact_title": "Contact",
    "privacy_title": "Privacy Policy",
    "privacy_p1": "Amedeo NCC, based in Milan, as data controller, collects personal data provided voluntarily through the contact form (name, phone, email, service details) solely to respond to your booking and quote requests.",
    "privacy_p2": "Data will be processed in compliance with the General Data Protection Regulation (GDPR, EU Reg. 2016/679). Data will not be shared with third parties except as required by law. Data will be retained for no longer than 24 months.",
    "privacy_p3": "<b>Your rights:</b> Under Articles 15-22 of the GDPR, you have the right to access, rectify, erase, restrict processing, data portability and objection. To exercise your rights, contact us at amedeo018@libero.it.",
    "privacy_p4": "<b>Cookies:</b> This website uses only strictly necessary technical cookies. No profiling or third-party cookies are used.",
    "privacy_l1": "Legal basis: consent (contact form) and legitimate interest (service execution).",
    "privacy_l2": "Data Protection Officer: Amedeo NCC — amedeo018@libero.it",
    "privacy_p5": "Last updated: July 2026.",
    "cookie_text": "We only use technical cookies necessary for this site to function. By clicking \"Accept\" you consent to the use of cookies. <a href=\"#\" onclick=\"openPrivacyModal();return false;\">Policy</a>",
    "cookie_accept": "Accept",
    "cookie_dismiss": "Dismiss",
    "f_service_placeholder": "Choose a service",
    "f_country_search": "Search country or code...",
    "f_country_none": "No country found"
  },
  "ar": {
    "routes": [
      {
        "code": "MXP → DUOMO",
        "label": "مطار مالبينسا"
      },
      {
        "code": "LIN → CITY",
        "label": "مطار ليناتي"
      },
      {
        "code": "BGY → BRERA",
        "label": "مطار أوريو أل سيريو"
      },
      {
        "code": "MILANO → ROMA",
        "label": "رحلات بعيدة"
      },
      {
        "code": "MILANO → GINEVRA",
        "label": "توصيل داخل أوروبا"
      },
      {
        "code": "CENTRO → FIERA",
        "label": "تمثيل تجاري"
      }
    ],
    "nav_services": "خدماتنا",
    "nav_fleet": "الأسطول",
    "nav_trips": "الرحلات",
    "nav_contact": "تواصل معنا",
    "hero_eyebrow": "خدمة سائق خاص · ميلانو ولومبارديا",
    "hero_title": "سائقك الخاص، <em>في أي مكان بميلانو</em>، وفي أي وقت.",
    "hero_sub": "نقل من وإلى المطار، تمثيل تجاري، مناسبات وجولات سياحية. نعمل من لومبارديا إلى أي وجهة في إيطاليا وأوروبا. دقة في المواعيد وسرية تامة وسيارات مرسيدس فاخرة — الحجز خلال دقيقتين.",
    "hero_cta1": "احجز رحلتك",
    "hero_cta2": "اكتشف خدماتنا",
    "search_from": "من",
    "search_to": "إلى",
    "search_date": "التاريخ",
    "search_service": "الخدمة",
    "search_submit": "احصل على عرض سعر",
    "stat1": "متاح",
    "stat2": "نطاق الرحلات",
    "stat3": "متوسط وقت الرد",
    "stat4": "اللغات المتاحة",
    "services_title": "خدماتنا",
    "services_tag": "لكل رحلة رمز وموعد ووجهة.",
    "s1_title": "نقل من وإلى المطار",
    "s1_desc": "متابعة الرحلات لحظة بلحظة، وقت انتظار مجاني، ومساعدة في نقل الأمتعة.",
    "s2_title": "تمثيل تجاري",
    "s2_desc": "سائق مخصص للاجتماعات والمعارض والوفود الأجنبية.",
    "s3_title": "جولات سياحية بمرشد",
    "s3_desc": "برامج مخصصة داخل المدينة ولومبارديا، بالعربية والإيطالية والإنجليزية.",
    "s4_title": "المناسبات والاحتفالات",
    "s4_desc": "أفراح وحفلات وسهرات — أسطول منسق ودقة تامة في المواعيد.",
    "s5_title": "رحلات بعيدة · إيطاليا وأوروبا",
    "s5_desc": "رحلات من ميلانو إلى أي مدينة إيطالية وأهم الوجهات الأوروبية.",
    "fleet_title": "الأسطول",
    "fleet_tag": "سيارات مصانة ومعقّمة قبل كل رحلة.",
    "c1": "سيارة تنفيذية لثلاثة ركاب، مثالية للنقل والتمثيل التجاري.",
    "c2": "أقصى درجات الراحة لكبار الضيوف والمناسبات المهمة.",
    "c3": "فان فاخر حتى 6 ركاب، مثالي للعائلات والمجموعات الصغيرة.",
    "btn_book_car": "احجز هذه السيارة",
    "btn_book_trip": "اطلب هذه الرحلة",
    "trips_title": "رحلات مقترحة",
    "trips_tag": "رحلات يومية خارج ميلانو مع سائق خاص، حسب الطلب.",
    "v1": "المدينة الخالدة، تحت تصرفكم ليوم كامل أو لعطلة نهاية الأسبوع.",
    "v2": "برج بيزا المائل وساحة الميراكولي، في رحلة يوم واحد من ميلانو.",
    "v3": "البحيرة والقنوات، مع سائق ينتظركم للعودة.",
    "v4": "أرقى بحيرة في إيطاليا، على بعد أقل من ساعة من ميلانو.",
    "v5": "برج إيفل والشوارع الباريسية الكبرى، مع سائق مخصص طوال الرحلة.",
    "v6": "جبال الألب والبحيرات ومدن مثل لوتسرن وزيوريخ، في رحلة واحدة بلا أي هم.",
    "v8": "الدومو ومتحف أوفيتزي وعصر النهضة الإيطالية، على بعد يوم واحد بس.",
    "v9_title": "وجهات تانية في إيطاليا",
    "v9_desc": "ساحل أمالفي، تشينكوي تيري، وأماكن كتير تانية — قولّنا الوجهة وإحنا هننظملك الرحلة.",
    "v1_title": "روما",
    "v2_title": "بيزا",
    "v3_title": "فينيسيا",
    "v4_title": "كومو",
    "v5_title": "باريس",
    "v6_title": "سويسرا",
    "v8_title": "فلورنسا",
    "pay_cash": "نقدي",
    "pay_card": "بطاقات ائتمان",
    "pay_paypal": "PayPal",
    "pay_transfer": "🏦 تحويل بنكي",
    "img_unavailable": "الصورة غير متاحة",
    "btn_other_italy": "اطلب هذه الوجهة",
    "note_other_italy": "وجهة في إيطاليا يحددها العميل (مثلاً ساحل أمالفي أو تشينكوي تيري — يرجى التحديد في حقل الفندق/الوجهة)",
    "v7_title": "اختر وجهتك بنفسك",
    "v7_desc": "مش لاقي وجهتك؟ قولّنا مكانها وإحنا هننظملك الرحلة على مقاسك في أي مكان بإيطاليا أو أوروبا.",
    "btn_custom_trip": "اختر وجهتك",
    "note_car_prefix": "السيارة المطلوبة",
    "note_trip_prefix": "رحلة إلى",
    "note_custom": "الوجهة يحددها العميل (يرجى كتابة المدينة في حقل الفندق/الوجهة)",
    "note_from_prefix": "الانطلاق من",
    "note_date_prefix": "التاريخ",
    "contact_title": "احجز الآن",
    "contact_tag": "تأكيد الحجز خلال 8 دقائق.",
    "f_name": "الاسم الكامل",
    "f_phone": "الهاتف / واتساب",
    "f_details": "التاريخ والوقت وملاحظات إضافية",
    "f_people": "عدد الأشخاص",
    "f_flight": "رقم الرحلة (لو نقل من المطار)",
    "f_hotel": "الفندق / عنوان الوجهة",
    "f_bags": "عدد الحقائب",
    "f_gdpr": "أوافق على معالجة البيانات الشخصية وفقًا لسياسة الخصوصية GDPR.",
    "f_submit": "إرسال الطلب",
    "i_phone": "الهاتف",
    "i_whatsapp": "واتساب",
    "i_mail": "البريد الإلكتروني",
    "i_area": "منطقة الخدمة",
    "i_hours": "ساعات العمل",
    "foot_note": "خدمة نقل خاص مرخصة (NCC) — ميلانو",
    "pay_title": "وسائل الدفع المقبولة",
    "f_success_alert": "جاري توجيهك إلى واتساب...",
    "wa_message": "مرحباً 👋 أرغب في حجز سيارة مع سائق.\nعدد الأشخاص: \nالمدينة: \nالتاريخ: ",
    "pay_bank": "تحويل بنكي",
    "foot_nav": "القائمة",
    "foot_legal": "قانوني",
    "foot_privacy": "سياسة الخصوصية",
    "foot_cookies": "سياسة ملفات تعريف الارتباط",
    "foot_terms": "الشروط والأحكام",
    "foot_contact_title": "تواصل معنا",
    "privacy_title": "سياسة الخصوصية",
    "privacy_p1": "أميدو NCC، مقره في ميلانو، بصفته مسؤول معالجة البيانات، يجمع البيانات الشخصية المقدمة طواعية عبر نموذج الاتصال (الاسم، الهاتف، البريد، تفاصيل الخدمة) لغرض وحيد هو الرد على طلبات الحجز والتسعير.",
    "privacy_p2": "سيتم معالجة البيانات وفقًا للائحة العامة لحماية البيانات (GDPR). لن يتم مشاركة البيانات مع أطراف ثالثة إلا كما يقتضي القانون. سيتم الاحتفاظ بالبيانات لمدة لا تتجاوز 24 شهرًا.",
    "privacy_p3": "<b>حقوقك:</b> وفقًا للمواد 15-22 من GDPR، لديك حق الوصول والتصحيح والحذف وتقييد المعالجة ونقل البيانات والاعتراض. للتمرن على حقوقك، تواصل معنا عبر amedeo018@libero.it.",
    "privacy_p4": "<b>ملفات تعريف الارتباط:</b> يستخدم هذا الموقع فقط ملفات تعريف ارتباط تقنية ضرورية. لا نستخدم ملفات تعريف ارتباط للتتبع أو من أطراف ثالثة.",
    "privacy_l1": "الأساس القانوني: الموافقة (نموذج الاتصال) والمصلحة المشروعة (تنفيذ الخدمة).",
    "privacy_l2": "مسؤول حماية البيانات: أميدو NCC — amedeo018@libero.it",
    "privacy_p5": "آخر تحديث: يوليو 2026.",
    "cookie_text": "نستخدم فقط ملفات تعريف الارتباط التقنية الضرورية لتشغيل هذا الموقع. بالنقر على \"قبول\" فإنك توافق على استخدام ملفات تعريف الارتباط. <a href=\"#\" onclick=\"openPrivacyModal();return false;\">السياسة</a>",
    "cookie_accept": "قبول",
    "cookie_dismiss": "إغلاق",
    "f_service_placeholder": "اختر الخدمة",
    "f_country_search": "ابحث عن دولة أو كود...",
    "f_country_none": "لا توجد نتائج"
  }
};

/* Phone country-code list for the booking form */
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
  { code: '+355', name: 'Albania', iso2: 'al' },
  { code: '+376', name: 'Andorra', iso2: 'ad' },
  { code: '+43', name: 'Austria', iso2: 'at' },
  { code: '+375', name: 'Belarus', iso2: 'by' },
  { code: '+32', name: 'Belgio', iso2: 'be' },
  { code: '+387', name: 'Bosnia', iso2: 'ba' },
  { code: '+359', name: 'Bulgaria', iso2: 'bg' },
  { code: '+385', name: 'Croazia', iso2: 'hr' },
  { code: '+357', name: 'Cipro', iso2: 'cy' },
  { code: '+420', name: 'Rep. Ceca', iso2: 'cz' },
  { code: '+45', name: 'Danimarca', iso2: 'dk' },
  { code: '+372', name: 'Estonia', iso2: 'ee' },
  { code: '+358', name: 'Finlandia', iso2: 'fi' },
  { code: '+33', name: 'Francia', iso2: 'fr' },
  { code: '+49', name: 'Germania', iso2: 'de' },
  { code: '+30', name: 'Grecia', iso2: 'gr' },
  { code: '+36', name: 'Ungheria', iso2: 'hu' },
  { code: '+354', name: 'Islanda', iso2: 'is' },
  { code: '+353', name: 'Irlanda', iso2: 'ie' },
  { code: '+383', name: 'Kosovo', iso2: 'xk' },
  { code: '+371', name: 'Lettonia', iso2: 'lv' },
  { code: '+423', name: 'Liechtenstein', iso2: 'li' },
  { code: '+370', name: 'Lituania', iso2: 'lt' },
  { code: '+352', name: 'Lussemburgo', iso2: 'lu' },
  { code: '+356', name: 'Malta', iso2: 'mt' },
  { code: '+373', name: 'Moldavia', iso2: 'md' },
  { code: '+377', name: 'Monaco', iso2: 'mc' },
  { code: '+382', name: 'Montenegro', iso2: 'me' },
  { code: '+31', name: 'Paesi Bassi', iso2: 'nl' },
  { code: '+389', name: 'N. Macedonia', iso2: 'mk' },
  { code: '+47', name: 'Norvegia', iso2: 'no' },
  { code: '+48', name: 'Polonia', iso2: 'pl' },
  { code: '+351', name: 'Portogallo', iso2: 'pt' },
  { code: '+40', name: 'Romania', iso2: 'ro' },
  { code: '+7', name: 'Russia', iso2: 'ru' },
  { code: '+378', name: 'San Marino', iso2: 'sm' },
  { code: '+381', name: 'Serbia', iso2: 'rs' },
  { code: '+421', name: 'Slovacchia', iso2: 'sk' },
  { code: '+386', name: 'Slovenia', iso2: 'si' },
  { code: '+34', name: 'Spagna', iso2: 'es' },
  { code: '+46', name: 'Svezia', iso2: 'se' },
  { code: '+41', name: 'Svizzera', iso2: 'ch' },
  { code: '+380', name: 'Ucraina', iso2: 'ua' },
  { code: '+44', name: 'Regno Unito', iso2: 'gb' },
  { code: '+379', name: 'Vaticano', iso2: 'va' },
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

/* =========================================================
   Structured content — services / fleet / trips driven by
   arrays + v-for instead of copy-pasted markup.
   ========================================================= */
const services = [
  { code: 'RT · 001', titleKey: 's1_title', descKey: 's1_desc', tag1: 'MXP / LIN / BGY', tag2: 'H24' },
  { code: 'RT · 002', titleKey: 's2_title', descKey: 's2_desc', tag1: 'MILANO', tag2: 'MEZZA/GG' },
  { code: 'RT · 003', titleKey: 's3_title', descKey: 's3_desc', tag1: 'MILANO / LOMB.', tag2: 'SU RICH.' },
  { code: 'RT · 004', titleKey: 's4_title', descKey: 's4_desc', tag1: 'ON DEMAND', tag2: 'PREV. 48H' },
  { code: 'RT · 005', titleKey: 's5_title', descKey: 's5_desc', tag1: 'IT / EU', tag2: 'SU RICH.' },
];

const fleet = [
  { code: 'CLASSE-E', name: 'Mercedes Classe E', descKey: 'c1', photo: 'https://images.unsplash.com/photo-1589199928766-31ac1fa51e2c?fm=jpg&q=70&w=1200&auto=format&fit=crop', alt: 'Mercedes Classe E esterno' },
  { code: 'CLASSE-S', name: 'Mercedes Classe S', descKey: 'c2', photo: 'https://images.unsplash.com/photo-1615135902193-b107418fb7eb?fm=jpg&q=70&w=1200&auto=format&fit=crop', alt: 'Mercedes Classe S esterno' },
  { code: 'CLASSE-V', name: 'Mercedes Classe V', descKey: 'c3', photo: 'https://images.unsplash.com/photo-1765461734605-34657fa04db2?fm=jpg&q=70&w=1200&auto=format&fit=crop', alt: 'Mercedes Classe V esterno' },
];

const trips = [
  { kind: 'trip', code: 'MI → ROMA', titleKey: 'v1_title', descKey: 'v1', photo: 'https://images.unsplash.com/photo-1515542483964-5e8c63d7d89b?fm=jpg&q=70&w=1200&auto=format&fit=crop', alt: 'Roma', name: 'Roma' },
  { kind: 'trip', code: 'MI → PISA', titleKey: 'v2_title', descKey: 'v2', photo: 'https://images.unsplash.com/photo-1548510907-5b514c51aba6?fm=jpg&q=70&w=1200&auto=format&fit=crop', alt: 'Pisa', name: 'Pisa' },
  { kind: 'trip', code: 'MI → VENEZIA', titleKey: 'v3_title', descKey: 'v3', photo: 'https://images.unsplash.com/photo-1767199289290-010e7caf8240?fm=jpg&q=70&w=1200&auto=format&fit=crop', alt: 'Venezia', name: 'Venezia' },
  { kind: 'trip', code: 'MI → COMO', titleKey: 'v4_title', descKey: 'v4', photo: 'https://images.unsplash.com/photo-1603491595041-3429047e7afc?fm=jpg&q=70&w=1200&auto=format&fit=crop', alt: 'Como', name: 'Como' },
  { kind: 'trip', code: 'MI → FIRENZE', titleKey: 'v8_title', descKey: 'v8', photo: 'https://images.unsplash.com/photo-1748191024085-391d76b8d5ed?fm=jpg&q=70&w=1200&auto=format&fit=crop', alt: 'Firenze', name: 'Firenze' },
  { kind: 'otherItaly', code: 'MI → ITALIA', titleKey: 'v9_title', descKey: 'v9_desc', photoRotating: 'otherItaly' },
  { kind: 'trip', code: 'MI → PARIGI', titleKey: 'v5_title', descKey: 'v5', photo: 'https://images.unsplash.com/photo-1431274172761-fca41d930114?fm=jpg&q=70&w=1200&auto=format&fit=crop', alt: 'Parigi', name: 'Parigi' },
  { kind: 'trip', code: 'MI → SVIZZERA', titleKey: 'v6_title', descKey: 'v6', photo: 'https://images.unsplash.com/photo-1527668752968-14dc70a27c95?fm=jpg&q=70&w=1200&auto=format&fit=crop', alt: 'Svizzera', name: 'Svizzera' },
  { kind: 'custom', code: 'MI → ?', titleKey: 'v7_title', descKey: 'v7_desc', photoRotating: 'customTrip' },
];

const otherItalyImages = [
  'https://images.unsplash.com/photo-1561956021-947f09ae0101?fm=jpg&q=70&w=1200&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1530735606451-8f5f13955328?fm=jpg&q=70&w=1200&auto=format&fit=crop',
];
const customTripImages = [
  'https://images.unsplash.com/photo-1515542483964-5e8c63d7d89b?fm=jpg&q=70&w=1200&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1548510907-5b514c51aba6?fm=jpg&q=70&w=1200&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1767199289290-010e7caf8240?fm=jpg&q=70&w=1200&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1603491595041-3429047e7afc?fm=jpg&q=70&w=1200&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1431274172761-fca41d930114?fm=jpg&q=70&w=1200&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1527668752968-14dc70a27c95?fm=jpg&q=70&w=1200&auto=format&fit=crop',
];
const otherItalyIndex = ref(0);
const customTripIndex = ref(0);
const otherItalyPhoto = computed(() => otherItalyImages[otherItalyIndex.value]);
const customTripPhoto = computed(() => customTripImages[customTripIndex.value]);
function tripPhoto(trip) {
  if (trip.photoRotating === 'otherItaly') return otherItalyPhoto.value;
  if (trip.photoRotating === 'customTrip') return customTripPhoto.value;
  return trip.photo;
}
let rotateTimer = null;
onMounted(() => {
  rotateTimer = setInterval(() => {
    otherItalyIndex.value = (otherItalyIndex.value + 1) % otherItalyImages.length;
    customTripIndex.value = (customTripIndex.value + 1) % customTripImages.length;
  }, 3000);
});
onUnmounted(() => clearInterval(rotateTimer));

/* =========================================================
   Language state
   ========================================================= */
const currentLang = ref('it');
const t = computed(() => dict[currentLang.value]);

watch(currentLang, (lang) => {
  document.documentElement.setAttribute('lang', lang);
  document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
}, { immediate: true });

function setLang(lang) {
  currentLang.value = lang;
}

/* Departure board translates automatically because it now reads
   from t.value.routes (a computed) instead of a static array. */
const boardRoutes = computed(() => [...t.value.routes, ...t.value.routes]);

/* =========================================================
   Broken-image fallback
   ========================================================= */
function imgFallback(event) {
  const text = t.value.img_unavailable || 'IMAGE NOT AVAILABLE';
  const el = event.target;
  const div = document.createElement('div');
  div.className = 'car-photo broken';
  div.textContent = text;
  el.replaceWith(div);
}

/* =========================================================
   Hero search box → prefills the booking form below
   ========================================================= */
const serviceFormValues = ['Transfer Aeroporto', 'Rappresentanza', 'Tour con guida', 'Eventi & Cerimonie', 'Lunga percorrenza'];
const search = reactive({ from: '', to: '', date: '', serviceIndex: 0 });

function submitSearch() {
  form.service = serviceFormValues[search.serviceIndex] || '';
  if (search.to) form.hotel = search.to;

  const parts = [];
  if (search.from) parts.push(`${t.value.note_from_prefix}: ${search.from}`);
  if (search.date) parts.push(`${t.value.note_date_prefix}: ${search.date}`);
  if (parts.length) form.details = parts.join(' | ');

  scrollToContact();
}

function scrollToContact() {
  document.getElementById('contatti')?.scrollIntoView({ behavior: 'smooth' });
}

/* =========================================================
   Booking form + WhatsApp handoff
   ========================================================= */
const form = reactive({
  name: '',
  country: '+39',
  phone: '',
  service: '',
  people: '',
  flight: '',
  hotel: '',
  bags: '',
  details: '',
  gdpr: false,
  lastAutoNote: null,
  website: '', // honeypot — must stay empty
});
const showSuccess = ref(false);

/* =========================================================
   Custom country-code dropdown (replaces the native <select>).
   Native <select> options can't show flag images at all, and the
   emoji-flag fallback rendered inconsistently on Windows — so this
   builds our own popup list with real flag images (flagcdn.com).
   ========================================================= */
const countryOpen = ref(false);
const countrySearch = ref('');
const selectedCountryIso2 = ref('it'); // matches the default form.country = '+39'
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

function setAutoNote(note) {
  let text = form.details;
  if (form.lastAutoNote && text.endsWith(form.lastAutoNote)) {
    text = text.slice(0, text.length - form.lastAutoNote.length).trim();
    if (text.endsWith('|')) text = text.slice(0, -1).trim();
  }
  form.details = text ? `${text} | ${note}` : note;
  form.lastAutoNote = note;
}

function selectCar(carName) {
  setAutoNote(`${t.value.note_car_prefix}: ${carName}`);
  scrollToContact();
}

function selectTrip(cityName) {
  form.service = 'Lunga percorrenza';
  form.hotel = cityName;
  setAutoNote(`${t.value.note_trip_prefix}: ${cityName}`);
  scrollToContact();
}

function selectOtherItalyTrip() {
  form.service = 'Lunga percorrenza';
  setAutoNote(t.value.note_other_italy);
  scrollToContact();
  nextTick(() => document.getElementById('f-hotel')?.focus());
}

function selectCustomTrip() {
  form.service = 'Lunga percorrenza';
  setAutoNote(t.value.note_custom);
  scrollToContact();
  nextTick(() => document.getElementById('f-hotel')?.focus());
}

function onCardAction(trip) {
  if (trip.kind === 'otherItaly') return selectOtherItalyTrip();
  if (trip.kind === 'custom') return selectCustomTrip();
  return selectTrip(trip.name);
}

const WHATSAPP_NUMBER = '393520003122';

function sendBookingToWhatsApp() {
  // Honeypot tripped: a bot filled the hidden field. Reset the form and
  // stop here — no WhatsApp message, no visible error (don't tip the bot
  // off that it was detected).
  if (form.website) {
    Object.assign(form, {
      name: '', country: '+39', phone: '', service: '', people: '',
      flight: '', hotel: '', bags: '', details: '', gdpr: false,
      lastAutoNote: null, website: '',
    });
    selectedCountryIso2.value = 'it';
    return;
  }

  const lines = [
    `📋 Nuova richiesta di prenotazione — Amedeo NCC`,
    `Nome: ${form.name}`,
    `Telefono: ${form.country} ${form.phone}`,
    `Servizio: ${form.service}`,
  ];
  if (form.people) lines.push(`Numero di persone: ${form.people}`);
  if (form.flight) lines.push(`Numero di volo: ${form.flight}`);
  if (form.hotel) lines.push(`Hotel/destinazione: ${form.hotel}`);
  if (form.bags) lines.push(`Valigie: ${form.bags}`);
  if (form.details) lines.push(`Note: ${form.details}`);

  const text = encodeURIComponent(lines.join('\n'));
  showSuccess.value = true;
  window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${text}`, '_blank', 'noopener,noreferrer');

  Object.assign(form, {
    name: '', country: '+39', phone: '', service: '', people: '',
    flight: '', hotel: '', bags: '', details: '', gdpr: false,
    lastAutoNote: null, website: '',
  });
  selectedCountryIso2.value = 'it';
  setTimeout(() => (showSuccess.value = false), 4000);
}

const waDefaultLink = computed(() => `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(t.value.wa_message)}`);

/* =========================================================
   Privacy modal + cookie banner
   ========================================================= */
const privacyOpen = ref(false);
function openPrivacyModal() {
  privacyOpen.value = true;
  document.body.style.overflow = 'hidden';
}
function closePrivacyModal() {
  privacyOpen.value = false;
  document.body.style.overflow = '';
}
onMounted(() => {
  // f_gdpr / cookie_text in the dict contain a raw onclick="openPrivacyModal()"
  // (ported as-is from the static HTML and rendered via v-html), so the
  // functions need to exist on window for that inline handler to find them.
  window.openPrivacyModal = openPrivacyModal;
  window.closePrivacyModal = closePrivacyModal;
});

const cookieVisible = ref(false);
onMounted(() => {
  if (!localStorage.getItem('cookie_ok')) {
    setTimeout(() => (cookieVisible.value = true), 1200);
  }
});
function acceptCookies() {
  localStorage.setItem('cookie_ok', '1');
  cookieVisible.value = false;
}

/* =========================================================
   Scroll-reveal directive (v-reveal)
   ========================================================= */
const vReveal = {
  mounted(el) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          el.classList.add('active');
          io.unobserve(el);
        }
      });
    }, { threshold: 0.15 });
    io.observe(el);
  },
};

const navOpen = ref(false);

/* =========================================================
   Fix: on some Android browsers (notably MIUI's built-in browser
   and some Chrome builds), `position: fixed` is calculated against
   the full layout viewport rather than the currently visible visual
   viewport. That leaves fixed elements like the WhatsApp button
   sitting below the fold — invisible — until the address bar
   collapses on scroll. We measure the gap with the visualViewport
   API and shift the button up by exactly that amount via a CSS
   variable, so it's always inside the visible area.
   ========================================================= */
function syncFabToViewport() {
  const vv = window.visualViewport;
  if (!vv) return;
  const hiddenBottom = window.innerHeight - (vv.height + vv.offsetTop);
  document.documentElement.style.setProperty('--fab-shift', `${Math.max(0, hiddenBottom)}px`);
}
onMounted(() => {
  syncFabToViewport();
  window.visualViewport?.addEventListener('resize', syncFabToViewport);
  window.visualViewport?.addEventListener('scroll', syncFabToViewport);
  window.addEventListener('orientationchange', syncFabToViewport);
});
onUnmounted(() => {
  window.visualViewport?.removeEventListener('resize', syncFabToViewport);
  window.visualViewport?.removeEventListener('scroll', syncFabToViewport);
  window.removeEventListener('orientationchange', syncFabToViewport);
});
</script>

<template>
<noscript><div style="background:#B08D57;color:#0C0F12;padding:12px 28px;text-align:center;font-size:0.88rem;font-weight:500;">Questo sito richiede JavaScript per funzionare correttamente. Abilita JavaScript nel tuo browser.</div></noscript>

<header>
  <nav class="wrap">
    <div class="logo">
      <svg width="34" height="18" viewBox="0 0 335 175" aria-hidden="true">
        <path d="M43,133C43,115 49,107 65,107L107,107L139,65C143,59 149,55 157,55L219,55C227,55 233,59 237,65L269,107L297,107C313,107 319,115 319,133C319,143 313,147 303,147L59,147C49,147 43,143 43,133Z" fill="#B08D57"/>
        <circle cx="74" cy="147" r="8" fill="#D9B77F"/>
        <circle cx="261" cy="147" r="8" fill="#D9B77F"/>
      </svg>
      <span class="logo-text">AMEDEO <b>NCC</b></span>
    </div>
    <div class="nav-links" :class="{ active: navOpen }">
      <a href="#servizi" @click="navOpen=false">{{ t.nav_services }}</a>
      <a href="#flotta" @click="navOpen=false">{{ t.nav_fleet }}</a>
      <a href="#viaggi" @click="navOpen=false">{{ t.nav_trips }}</a>
      <a href="#contatti" @click="navOpen=false">{{ t.nav_contact }}</a>
    </div>
    <div style="display:flex;gap:10px;align-items:center;">
      <div class="lang-switch" role="group" aria-label="Lingua / Language / اللغة">
        <button v-for="l in ['it','en','ar']" :key="l" :data-lang="l"
                :class="{ active: currentLang===l }" :aria-pressed="currentLang===l"
                @click="setLang(l)">{{ l.toUpperCase() }}</button>
      </div>
      <button class="menu-toggle" aria-label="Menu" @click="navOpen = !navOpen">☰</button>
    </div>
  </nav>
</header>

<div class="board">
  <div class="board-inner">
    <span v-for="(r, i) in boardRoutes" :key="i" class="board-item">
      <span class="dot"></span><b>{{ r.code }}</b> {{ r.label }}
    </span>
  </div>
</div>

<main>
<section class="hero wrap">
  <div class="hero-eyebrow reveal delay-1" v-reveal>{{ t.hero_eyebrow }}</div>
  <h1 class="reveal delay-2" v-reveal v-html="t.hero_title"></h1>
  <p class="sub reveal delay-3" v-reveal>{{ t.hero_sub }}</p>
  <div class="cta-row reveal delay-4" v-reveal>
    <a href="#contatti" class="btn btn-primary">{{ t.hero_cta1 }}</a>
    <a href="#servizi" class="btn btn-ghost">{{ t.hero_cta2 }}</a>
  </div>

  <div class="search-box reveal delay-5" v-reveal>
    <div class="search-grid">
      <div class="search-field">
        <label>{{ t.search_from }}</label>
        <input type="text" v-model="search.from" placeholder="—">
      </div>
      <div class="search-field">
        <label>{{ t.search_to }}</label>
        <input type="text" v-model="search.to" placeholder="—">
      </div>
      <div class="search-field">
        <label>{{ t.search_date }}</label>
        <input type="date" v-model="search.date">
      </div>
      <div class="search-field">
        <label>{{ t.search_service }}</label>
        <select v-model="search.serviceIndex">
          <option v-for="(v,i) in serviceFormValues" :key="v" :value="i">{{ t['s'+(i+1)+'_title'] }}</option>
        </select>
      </div>
      <button class="btn btn-primary" @click="submitSearch">{{ t.search_submit }}</button>
    </div>
  </div>
</section>

<section class="stats wrap">
  <div class="stat"><b>24/7</b><span>{{ t.stat1 }}</span></div>
  <div class="stat"><b>LOMBARDIA → ITA/EU</b><span>{{ t.stat2 }}</span></div>
  <div class="stat"><b>&lt;8 min</b><span>{{ t.stat3 }}</span></div>
  <div class="stat"><b>IT · EN · AR</b><span>{{ t.stat4 }}</span></div>
</section>

<section class="section wrap" id="servizi">
  <div class="section-head reveal" v-reveal>
    <h2>{{ t.services_title }}</h2>
    <div class="tag mono">{{ t.services_tag }}</div>
  </div>
  <div class="services">
    <div class="stub reveal" v-reveal v-for="s in services" :key="s.code">
      <div class="stub-code">{{ s.code }}</div>
      <h3>{{ t[s.titleKey] }}</h3>
      <p>{{ t[s.descKey] }}</p>
      <div class="stub-foot"><span>{{ s.tag1 }}</span><b>{{ s.tag2 }}</b></div>
    </div>
  </div>
</section>

<section class="section wrap" id="flotta">
  <div class="section-head reveal" v-reveal>
    <h2>{{ t.fleet_title }}</h2>
    <div class="tag mono">{{ t.fleet_tag }}</div>
  </div>
  <div class="fleet">
    <div class="car reveal" v-reveal v-for="c in fleet" :key="c.code">
      <img class="car-photo" :src="c.photo" :alt="c.alt" loading="lazy" @error="imgFallback">
      <div class="car-body">
        <div class="code">{{ c.code }}</div>
        <h4>{{ c.name }}</h4>
        <p>{{ t[c.descKey] }}</p>
        <button class="car-btn" @click="selectCar(c.name)">{{ t.btn_book_car }}</button>
      </div>
    </div>
  </div>
</section>

<section class="section wrap" id="viaggi">
  <div class="section-head reveal" v-reveal>
    <h2>{{ t.trips_title }}</h2>
    <div class="tag mono">{{ t.trips_tag }}</div>
  </div>
  <div class="fleet">
    <div class="car reveal" v-reveal v-for="trip in trips" :key="trip.code">
      <img class="car-photo" :src="tripPhoto(trip)" :alt="trip.alt || t[trip.titleKey]" loading="lazy" @error="imgFallback">
      <div class="car-body">
        <div class="code">{{ trip.code }}</div>
        <h4>{{ t[trip.titleKey] }}</h4>
        <p>{{ t[trip.descKey] }}</p>
        <button class="car-btn" @click="onCardAction(trip)">
          {{ trip.kind === 'otherItaly' ? t.btn_other_italy : (trip.kind === 'custom' ? t.btn_custom_trip : t.btn_book_trip) }}
        </button>
      </div>
    </div>
  </div>
</section>

<section class="section wrap" id="contatti">
  <div class="section-head reveal" v-reveal>
    <h2>{{ t.contact_title }}</h2>
    <div class="tag mono">{{ t.contact_tag }}</div>
  </div>
  <div class="contact-grid">
    <form id="booking-form" @submit.prevent="sendBookingToWhatsApp">
      <!-- Honeypot anti-spam: real visitors never see or fill this field.
           Bots that blindly auto-fill every input on the page usually do,
           so if it has a value we silently drop the submission. -->
      <div class="hp-field" aria-hidden="true">
        <label for="f-website">Website</label>
        <input type="text" id="f-website" v-model="form.website" tabindex="-1" autocomplete="off">
      </div>
      <div v-if="showSuccess" class="form-alert" style="display:block;">{{ t.f_success_alert }}</div>
      <input type="text" v-model.trim="form.name" :placeholder="t.f_name" required maxlength="60">
      <div class="phone-row">
        <div class="country-select" ref="countrySelectRef" :class="{ open: countryOpen }">
          <button type="button" class="country-select-btn" @click="toggleCountryDropdown" :aria-expanded="countryOpen" aria-haspopup="listbox">
            <img :src="`https://flagcdn.com/24x18/${selectedCountry.iso2}.png`" :alt="selectedCountry.name" width="22" height="16" class="country-flag">
            <span>{{ selectedCountry.code }}</span>
            <svg class="country-chevron" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
          </button>
          <div v-if="countryOpen" class="country-dropdown" role="listbox">
            <input type="text" v-model="countrySearch" class="country-search" :placeholder="t.f_country_search" @click.stop>
            <div class="country-list">
              <button type="button" v-for="c in filteredCountries" :key="c.code + c.iso2" class="country-item" role="option" @click="selectCountry(c)">
                <img :src="`https://flagcdn.com/24x18/${c.iso2}.png`" :alt="c.name" width="22" height="16" loading="lazy">
                <span class="country-item-name">{{ c.name }}</span>
                <span class="country-item-code">{{ c.code }}</span>
              </button>
              <div v-if="filteredCountries.length === 0" class="country-empty">{{ t.f_country_none }}</div>
            </div>
          </div>
        </div>
        <input type="tel" id="f-phone" v-model.trim="form.phone" :placeholder="t.f_phone" required maxlength="20">
      </div>
      <select v-model="form.service" required>
        <option value="" disabled>{{ t.f_service_placeholder }}</option>
        <option v-for="(v,i) in serviceFormValues" :key="v" :value="v">{{ t['s'+(i+1)+'_title'] }}</option>
      </select>
      <input type="number" v-model="form.people" min="1" max="20" :placeholder="t.f_people">
      <input type="text" v-model.trim="form.flight" :placeholder="t.f_flight" maxlength="30">
      <input type="text" id="f-hotel" v-model.trim="form.hotel" :placeholder="t.f_hotel" maxlength="100">
      <input type="number" v-model="form.bags" min="0" max="30" :placeholder="t.f_bags">
      <textarea v-model="form.details" :placeholder="t.f_details" maxlength="500"></textarea>
      <label class="gdpr-box">
        <input type="checkbox" v-model="form.gdpr" required>
        <span v-html="t.f_gdpr"></span>
      </label>
      <button type="submit" class="btn btn-primary">{{ t.f_submit }}</button>
    </form>
    <div>
      <div class="info-line"><span>{{ t.i_phone }}</span><span><a href="tel:+393520003122" style="color:var(--brass-bright);text-decoration:none;">+39 352 000 3122</a></span></div>
      <div class="info-line"><span>{{ t.i_whatsapp }}</span><span><a href="https://wa.me/393520003122" target="_blank" rel="noopener" style="color:var(--brass-bright);text-decoration:none;">+39 352 000 3122</a></span></div>
      <div class="info-line"><span>{{ t.i_mail }}</span><span><a href="mailto:amedeo018@libero.it" style="color:var(--brass-bright);text-decoration:none;">amedeo018@libero.it</a></span></div>
      <div class="info-line"><span>{{ t.i_area }}</span><span>LOMBARDIA → ITALIA / EUROPA</span></div>
      <div class="info-line"><span>{{ t.i_hours }}</span><span>24/7</span></div>

      <div class="payments-box">
        <div class="payments-title">{{ t.pay_title }}</div>
        <div class="payment-badges">
          <div class="pay-card">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>
            <span>{{ t.pay_cash }}</span>
          </div>
          <div class="pay-card">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
            <span>{{ t.pay_card }}</span>
          </div>
          <div class="pay-card">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/><path d="M8 12l3 3 5-5"/></svg>
            <span>{{ t.pay_paypal }}</span>
          </div>
          <div class="pay-card">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9 21v-4h6v4"/></svg>
            <span>{{ t.pay_bank }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- ⚠️ Sezione recensioni rimossa: recensioni inventate = rischio legale (Codice
     del Consumo) e di reputazione. Rimettila quando avrai recensioni vere. -->

<footer class="wrap">
  <div class="footer-inner">
    <div class="footer-col">
      <h4>{{ t.foot_nav }}</h4>
      <a href="#servizi">{{ t.nav_services }}</a>
      <a href="#flotta">{{ t.nav_fleet }}</a>
      <a href="#viaggi">{{ t.nav_trips }}</a>
      <a href="#contatti">{{ t.nav_contact }}</a>
    </div>
    <div class="footer-col">
      <h4>{{ t.foot_legal }}</h4>
      <a href="#" @click.prevent="openPrivacyModal">{{ t.foot_privacy }}</a>
      <a href="#" @click.prevent="openPrivacyModal">{{ t.foot_cookies }}</a>
      <a href="#" @click.prevent="openPrivacyModal">{{ t.foot_terms }}</a>
    </div>
    <div class="footer-col">
      <h4>{{ t.foot_contact_title }}</h4>
      <a href="tel:+393520003122">+39 352 000 3122</a>
      <a href="mailto:amedeo018@libero.it">amedeo018@libero.it</a>
      <a href="https://wa.me/393520003122" target="_blank" rel="noopener">WhatsApp</a>
    </div>
  </div>
  <div class="footer-bottom">
    <!-- ⚠️ TODO: sostituire con la Partita IVA reale prima di pubblicare online -->
    <span>© 2026 Amedeo NCC · P.IVA XXXXXXXXXXX</span>
    <span>{{ t.foot_note }}</span>
  </div>
</footer>
</main>

<a class="whatsapp-fab" :href="waDefaultLink" target="_blank" rel="noopener" aria-label="Scrivici su WhatsApp">
  <svg viewBox="0 0 32 32" fill="white" aria-hidden="true"><path d="M16.001 3C9.373 3 4 8.373 4 15c0 2.386.703 4.61 1.912 6.478L4 29l7.702-1.874A11.94 11.94 0 0016.001 27C22.629 27 28 21.627 28 15S22.629 3 16.001 3zm0 21.818a9.77 9.77 0 01-4.98-1.362l-.357-.212-4.573 1.112 1.135-4.457-.233-.366A9.78 9.78 0 016.182 15c0-5.42 4.4-9.818 9.819-9.818 5.418 0 9.818 4.398 9.818 9.818 0 5.419-4.4 9.818-9.818 9.818zm5.386-7.35c-.295-.148-1.746-.862-2.017-.96-.271-.099-.469-.148-.667.148-.197.295-.764.96-.937 1.157-.172.198-.345.222-.64.074-.295-.148-1.246-.459-2.373-1.463-.877-.782-1.47-1.748-1.642-2.043-.172-.295-.018-.454.13-.601.134-.133.296-.345.444-.518.148-.172.197-.295.296-.492.099-.198.05-.37-.025-.518-.074-.148-.667-1.606-.914-2.2-.24-.579-.485-.5-.667-.51-.172-.008-.37-.01-.568-.01a1.09 1.09 0 00-.79.37c-.271.296-1.036 1.013-1.036 2.47 0 1.457 1.06 2.865 1.208 3.063.148.198 2.086 3.186 5.053 4.468.706.305 1.256.487 1.685.623.708.225 1.352.193 1.861.117.568-.085 1.746-.714 1.993-1.403.246-.69.246-1.28.172-1.403-.074-.123-.271-.197-.567-.345z"/></svg>
</a>

<!-- PRIVACY MODAL -->
<div class="modal-overlay" :class="{ open: privacyOpen }" @click.self="closePrivacyModal">
  <div class="modal-box">
    <button class="modal-close" @click="closePrivacyModal" aria-label="Chiudi">&#10005;</button>
    <h3>{{ t.privacy_title }}</h3>
    <p>{{ t.privacy_p1 }}</p>
    <p>{{ t.privacy_p2 }}</p>
    <p v-html="t.privacy_p3"></p>
    <p v-html="t.privacy_p4"></p>
    <ul>
      <li>{{ t.privacy_l1 }}</li>
      <li>{{ t.privacy_l2 }}</li>
    </ul>
    <p>{{ t.privacy_p5 }}</p>
  </div>
</div>

<!-- COOKIE BANNER -->
<div class="cookie-banner" :class="{ visible: cookieVisible }">
  <span v-html="t.cookie_text"></span>
  <div class="cookie-btns">
    <button @click="acceptCookies">{{ t.cookie_accept }}</button>
    <button @click="acceptCookies">{{ t.cookie_dismiss }}</button>
  </div>
</div>
</template>


<style>

  :root{
    --ink:#0C0F12;
    --surface:#14181D;
    --surface-2:#1B2027;
    --brass:#B08D57;
    --brass-bright:#D9B77F;
    --paper:#EDEAE3;
    --steel:#8B93AA;
    --line:#262B31;
  }
  *{margin:0;padding:0;box-sizing:border-box;}
  html{scroll-behavior:smooth;overflow-x:hidden;max-width:100vw;}
  body{
    background:var(--ink);
    color:var(--paper);
    font-family:'Work Sans',sans-serif;
    font-weight:300;
    line-height:1.5;
    -webkit-font-smoothing:antialiased;
    overflow-x:hidden;
    max-width:100vw;
    position:relative;
  }
  a{color:inherit;text-decoration:none;}
  .mono{font-family:'IBM Plex Mono',monospace;}
  html[dir="rtl"] body{font-family:'Tajawal','Work Sans',sans-serif;}
  html[dir="rtl"] .mono,html[dir="rtl"] .stub-code,html[dir="rtl"] .board-item,html[dir="rtl"] .info-line span:last-child{font-family:'IBM Plex Mono','Tajawal',monospace;}
  html[dir="rtl"] h1,html[dir="rtl"] h2,html[dir="rtl"] .car h4,html[dir="rtl"] .stub h3,html[dir="rtl"] .stat b{font-family:'Cairo','Fraunces',serif;}
  html[dir="rtl"] h1{line-height:1.25;}
  html[dir="rtl"] h1 em{font-style:normal;}
  html[dir="rtl"] .logo-text{font-family:'Cairo',serif;}
  html[dir="rtl"] input,html[dir="rtl"] select,html[dir="rtl"] textarea{font-family:'Tajawal',sans-serif;}
  .wrap{max-width:1180px;margin:0 auto;padding:0 28px;}

  /* NAV */
  header{
    position:sticky;top:0;z-index:50;
    background:rgba(12,15,18,0.88);
    -webkit-backdrop-filter:blur(10px);
    backdrop-filter:blur(10px);
    border-bottom:1px solid var(--line);
  }
  nav{display:flex;align-items:center;justify-content:space-between;padding:18px 28px;max-width:1180px;margin:0 auto;}
  .logo{display:flex;align-items:center;gap:10px;}
  .logo-mark{width:34px;height:auto;flex-shrink:0;}
  .logo-text{font-family:'Fraunces',serif;font-size:1.3rem;font-weight:600;letter-spacing:0.02em;}
  .logo-text b{color:var(--brass);font-weight:600;}
  .nav-links{display:flex;gap:32px;font-size:0.85rem;letter-spacing:0.04em;text-transform:uppercase;}
  .nav-links a{color:var(--steel);transition:color .2s;}
  .nav-links a:hover{color:var(--paper);}
  .lang-switch{display:flex;gap:6px;font-size:0.72rem;}
  .lang-switch button{
    background:none;border:1px solid var(--line);color:var(--steel);
    padding:5px 10px;cursor:pointer;font-family:'IBM Plex Mono',monospace;
    letter-spacing:0.05em;transition:all .2s;
  }
  .lang-switch button.active,.lang-switch button:hover{border-color:var(--brass);color:var(--brass-bright);}
  .menu-toggle{display:none;background:none;border:none;color:var(--paper);font-size:1.4rem;cursor:pointer;}

  /* DEPARTURE BOARD TICKER */
  .board{
    background:var(--surface);
    border-bottom:1px solid var(--line);
    overflow:hidden;
    padding:10px 0;
  }
  .board-inner{display:flex;gap:0;animation:scroll 28s linear infinite;white-space:nowrap;}
  .board-item{
    display:inline-flex;align-items:center;gap:14px;
    padding:0 28px;border-right:1px solid var(--line);
    font-family:'IBM Plex Mono',monospace;font-size:0.78rem;color:var(--steel);
  }
  .board-item b{color:var(--brass-bright);font-weight:500;}
  .dot{width:5px;height:5px;border-radius:50%;background:var(--brass);animation:pulse 1.6s ease-in-out infinite;}
  @keyframes pulse{0%,100%{opacity:0.3;}50%{opacity:1;}}
  @keyframes scroll{0%{transform:translateX(0);}100%{transform:translateX(-50%);}}
  html[dir="rtl"] .board-inner{animation-name:scrollrtl;}
  @keyframes scrollrtl{0%{transform:translateX(0);}100%{transform:translateX(50%);}}

  /* REVEAL ON SCROLL */
  .reveal{opacity:0;transform:translateY(28px);transition:opacity .7s cubic-bezier(.2,1,.3,1),transform .7s cubic-bezier(.2,1,.3,1);will-change:transform,opacity;}
  .reveal.active{opacity:1;transform:translateY(0);}
  .delay-1{transition-delay:.1s;} .delay-2{transition-delay:.2s;} .delay-3{transition-delay:.3s;} .delay-4{transition-delay:.4s;}
  .services .stub:nth-child(1){transition-delay:.05s;} .services .stub:nth-child(2){transition-delay:.15s;}
  .services .stub:nth-child(3){transition-delay:.25s;} .services .stub:nth-child(4){transition-delay:.35s;}
  .services .stub:nth-child(5){transition-delay:.45s;}
  .fleet .car:nth-child(1){transition-delay:.05s;} .fleet .car:nth-child(2){transition-delay:.2s;} .fleet .car:nth-child(3){transition-delay:.35s;}

  /* HERO */
  .hero{padding:110px 0 90px;position:relative;}
  .hero-eyebrow{
    font-family:'IBM Plex Mono',monospace;font-size:0.75rem;color:var(--brass);
    letter-spacing:0.15em;text-transform:uppercase;margin-bottom:22px;
    display:flex;align-items:center;gap:10px;
  }
  .hero-eyebrow::before{content:'';width:26px;height:1px;background:var(--brass);}
  h1{
    font-family:'Fraunces',serif;font-weight:600;
    font-size:clamp(2.4rem,6vw,4.4rem);line-height:1.05;
    max-width:820px;letter-spacing:-0.01em;
  }
  h1 em{font-style:italic;color:var(--brass-bright);font-weight:500;}
  .hero p.sub{
    max-width:480px;color:var(--steel);font-size:1.05rem;margin-top:26px;font-weight:300;
  }
  .cta-row{display:flex;gap:16px;margin-top:40px;flex-wrap:wrap;}

  .search-box{margin-top:50px;background:var(--surface);border:1px solid var(--line);padding:22px;}
  .search-grid{display:grid;grid-template-columns:1fr 1fr 1fr 1fr auto;gap:14px;}
  .search-field{display:flex;flex-direction:column;gap:6px;}
  .search-field label{
    font-family:'IBM Plex Mono',monospace;font-size:0.68rem;color:var(--steel);
    text-transform:uppercase;letter-spacing:0.06em;
  }
  .search-field input,.search-field select{
    background:var(--surface-2);border:1px solid var(--line);color:var(--paper);
    padding:12px 14px;font-family:inherit;font-size:0.9rem;width:100%;
  }
  html[dir="rtl"] .search-field input,html[dir="rtl"] .search-field select{font-family:'Tajawal',sans-serif;}
  .search-field input:focus,.search-field select:focus{outline:none;border-color:var(--brass);}
  .search-box .btn{white-space:nowrap;align-self:end;}
  @media(max-width:900px){
    .search-grid{grid-template-columns:1fr 1fr;}
    .search-box .btn{grid-column:1/-1;}
  }
  .btn{
    padding:15px 30px;font-size:0.85rem;letter-spacing:0.05em;text-transform:uppercase;
    cursor:pointer;transition:all .25s;border:1px solid transparent;
  }
  .btn-primary{background:var(--brass);color:var(--ink);font-weight:500;}
  .btn-primary:hover{background:var(--brass-bright);}
  .btn-ghost{border-color:var(--line);color:var(--paper);}
  .btn-ghost:hover{border-color:var(--brass);}

  /* SECTION HEAD */
  .section{padding:90px 0;border-top:1px solid var(--line);scroll-margin-top:72px;}
  .stats{scroll-margin-top:72px;}
  .hero{scroll-margin-top:72px;}
  .section-head{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:52px;flex-wrap:wrap;gap:20px;}
  .section-head h2{font-family:'Fraunces',serif;font-size:clamp(1.8rem,3.2vw,2.6rem);font-weight:500;}
  .section-head .tag{font-family:'IBM Plex Mono',monospace;font-size:0.75rem;color:var(--steel);max-width:320px;}

  /* SERVICES — boarding-pass stubs */
  .services{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:22px;}
  .stub{
    background:var(--surface);border:1px solid var(--line);
    position:relative;padding:26px 24px 22px;
    transition:border-color .25s, transform .25s;
  }
  .stub:hover{border-color:var(--brass);transform:translateY(-3px);}
  .stub::after{
    content:'';position:absolute;left:0;right:0;bottom:64px;
    border-top:1px dashed var(--line);
  }
  .stub-code{font-family:'IBM Plex Mono',monospace;font-size:0.72rem;color:var(--brass);letter-spacing:0.1em;margin-bottom:14px;}
  .stub h3{font-family:'Fraunces',serif;font-size:1.25rem;font-weight:500;margin-bottom:10px;}
  .stub p{color:var(--steel);font-size:0.9rem;margin-bottom:26px;}
  .stub-foot{display:flex;justify-content:space-between;font-family:'IBM Plex Mono',monospace;font-size:0.72rem;color:var(--steel);padding-top:12px;}
  .stub-foot b{color:var(--paper);}

  /* FLEET */
  .fleet{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:1px;background:var(--line);border:1px solid var(--line);}
  .car{background:var(--ink);}
  .car-photo{width:100%;height:200px;object-fit:cover;display:block;filter:grayscale(15%) contrast(1.05);background:var(--surface-2);transition:opacity .5s ease;}
  .car-photo.broken{display:flex;align-items:center;justify-content:center;font-family:'IBM Plex Mono',monospace;font-size:0.7rem;color:var(--steel);letter-spacing:0.08em;}
  .car-body{padding:26px 28px 34px;}
  .car .code{font-family:'IBM Plex Mono',monospace;color:var(--brass);font-size:0.72rem;letter-spacing:0.1em;}
  .car h4{font-family:'Fraunces',serif;font-size:1.4rem;font-weight:500;margin:10px 0 8px;}
  .car p{color:var(--steel);font-size:0.88rem;}
  .car-btn{
    margin-top:18px;background:none;border:1px solid var(--line);color:var(--brass-bright);
    padding:10px 18px;font-size:0.78rem;letter-spacing:0.04em;text-transform:uppercase;
    cursor:pointer;transition:all .2s;font-family:'Work Sans',sans-serif;
  }
  .car-btn:hover{border-color:var(--brass);background:rgba(176,141,87,0.08);}

  /* STRIP STATS */
  .stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));border-top:1px solid var(--line);border-bottom:1px solid var(--line);}
  .stat{padding:34px 28px;border-left:1px solid var(--line);}
  .stat:first-child{border-left:none;}
  .stat b{font-family:'Fraunces',serif;font-size:2.2rem;color:var(--brass-bright);display:block;font-weight:500;}
  .stat span{font-family:'IBM Plex Mono',monospace;font-size:0.72rem;color:var(--steel);text-transform:uppercase;letter-spacing:0.06em;}

  /* CONTACT */
  .contact-grid{display:grid;grid-template-columns:1.1fr 0.9fr;gap:60px;}
  .contact-grid form{display:flex;flex-direction:column;gap:16px;}
  input,select,textarea{
    background:var(--surface);border:1px solid var(--line);color:var(--paper);
    padding:14px 16px;font-family:'Work Sans',sans-serif;font-size:0.92rem;
  }
  input:focus,select:focus,textarea:focus{outline:none;border-color:var(--brass);}
  textarea{min-height:100px;resize:vertical;}
  .gdpr-box{display:flex;align-items:flex-start;gap:10px;font-size:0.78rem;color:var(--steel);margin-top:2px;}
  .gdpr-box input[type="checkbox"]{accent-color:var(--brass);margin-top:3px;cursor:pointer;flex-shrink:0;}
  .form-alert{
    display:none;background:rgba(37,211,102,0.12);border:1px solid #25D366;
    color:var(--paper);padding:14px;font-size:0.88rem;
  }
  .phone-row{display:flex;gap:8px;}
  .phone-row input{flex:1;}

  /* Custom country-code dropdown: replaces the native <select> so we can
     show real flag images (native <select> can't render images in its
     options at all, and emoji flags rendered unreliably on Windows). */
  .country-select{position:relative;flex:0 0 108px;}
  .country-select-btn{
    display:flex;align-items:center;gap:6px;width:100%;height:100%;
    background:var(--surface);border:1px solid var(--line);color:var(--paper);
    padding:14px 8px;font-family:'Work Sans',sans-serif;font-size:0.88rem;
    cursor:pointer;
  }
  .country-select-btn:hover,.country-select.open .country-select-btn{border-color:var(--brass);}
  .country-flag{border-radius:2px;display:block;flex-shrink:0;}
  .country-chevron{margin-left:auto;color:var(--steel);flex-shrink:0;}
  .country-select.open .country-chevron{transform:rotate(180deg);}
  .country-dropdown{
    position:absolute;top:calc(100% + 6px);left:0;z-index:50;
    width:280px;max-width:80vw;background:var(--surface-2);
    border:1px solid var(--line);box-shadow:0 12px 32px rgba(0,0,0,0.5);
  }
  html[dir="rtl"] .country-dropdown{left:auto;right:0;}
  .country-search{
    width:100%;padding:12px 14px;background:var(--surface);border:none;
    border-bottom:1px solid var(--line);color:var(--paper);
    font-family:'Work Sans',sans-serif;font-size:0.88rem;
  }
  .country-search:focus{outline:none;}
  .country-list{max-height:260px;overflow-y:auto;}
  .country-item{
    display:flex;align-items:center;gap:10px;width:100%;
    padding:9px 14px;background:none;border:none;color:var(--paper);
    font-family:'Work Sans',sans-serif;font-size:0.86rem;text-align:left;
    cursor:pointer;
  }
  html[dir="rtl"] .country-item{text-align:right;}
  .country-item img{border-radius:2px;flex-shrink:0;}
  .country-item:hover{background:rgba(176,141,87,0.12);}
  .country-item-name{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
  .country-item-code{color:var(--steel);font-family:'IBM Plex Mono',monospace;font-size:0.8rem;flex-shrink:0;}
  .country-empty{padding:16px 14px;color:var(--steel);font-size:0.86rem;text-align:center;}

  .info-line{display:flex;justify-content:space-between;padding:16px 0;border-bottom:1px solid var(--line);font-size:0.92rem;}
  .info-line span:first-child{color:var(--steel);}
  .info-line span:last-child{font-family:'IBM Plex Mono',monospace;color:var(--brass-bright);}
  .payments-box{margin-top:28px;padding-top:20px;border-top:1px dashed var(--line);}
  .payments-title{font-family:'IBM Plex Mono',monospace;font-size:0.75rem;color:var(--steel);margin-bottom:14px;text-transform:uppercase;letter-spacing:0.08em;}
  .payment-badges{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
  .pay-card{
    background:var(--surface);border:1px solid var(--line);color:var(--paper);
    padding:10px 14px;font-size:0.78rem;font-family:'IBM Plex Mono',monospace;
    display:flex;align-items:center;gap:10px;border-radius:4px;
    transition:border-color .25s,background .25s;
  }
  .pay-card:hover{border-color:var(--brass);background:rgba(176,141,87,0.06);}
  .pay-card svg{width:22px;height:22px;flex-shrink:0;color:var(--brass);}
  .pay-card span{white-space:nowrap;}
  @media(max-width:760px){
    .payment-badges{grid-template-columns:1fr 1fr;gap:6px;}
    .pay-card{padding:8px 10px;font-size:0.72rem;}
    .pay-card svg{width:18px;height:18px;}
  }

  /* TESTIMONIALS */
  .testimonials{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:22px;}
  .testi{
    background:var(--surface);border:1px solid var(--line);padding:28px 26px;
    transition:border-color .25s;
  }
  .testi:hover{border-color:var(--brass);}
  .testi-stars{color:var(--brass-bright);font-size:0.9rem;letter-spacing:2px;margin-bottom:14px;}
  .testi blockquote{color:var(--paper);font-size:0.92rem;line-height:1.65;margin-bottom:18px;font-style:italic;}
  .testi-author{display:flex;justify-content:space-between;align-items:center;font-size:0.82rem;}
  .testi-author b{color:var(--paper);font-weight:500;}
  .testi-author span{color:var(--steel);font-family:'IBM Plex Mono',monospace;font-size:0.72rem;}

  /* COOKIE BANNER */
  .cookie-banner{
    position:fixed;bottom:0;left:0;right:0;z-index:100;
    background:var(--surface);border-top:1px solid var(--line);
    padding:18px 28px;display:flex;align-items:center;justify-content:space-between;
    gap:16px;font-size:0.82rem;color:var(--steel);
    transform:translateY(100%);transition:transform .4s cubic-bezier(.2,1,.3,1);
  }
  .cookie-banner.visible{transform:translateY(0);}
  .cookie-banner a{color:var(--brass-bright);text-decoration:underline;}
  .cookie-btns{display:flex;gap:10px;flex-shrink:0;}
  .cookie-btns button{padding:10px 20px;font-size:0.78rem;cursor:pointer;border:1px solid var(--line);background:none;color:var(--paper);transition:all .2s;letter-spacing:0.03em;}
  .cookie-btns button.primary-cookie{background:var(--brass);color:var(--ink);border-color:var(--brass);font-weight:500;}
  .cookie-btns button:hover{opacity:0.85;}
  @media(max-width:760px){
    .cookie-banner{flex-direction:column;text-align:center;padding:16px 20px;}
  }

  /* PRIVACY MODAL */
  .modal-overlay{
    position:fixed;inset:0;z-index:200;background:rgba(0,0,0,0.7);
    display:none;align-items:center;justify-content:center;padding:28px;
  }
  .modal-overlay.open{display:flex;}
  .modal-box{
    background:var(--surface);border:1px solid var(--line);max-width:640px;width:100%;
    max-height:80vh;overflow-y:auto;padding:40px 36px;position:relative;
  }
  .modal-close{
    position:absolute;top:16px;right:18px;background:none;border:none;
    color:var(--steel);font-size:1.4rem;cursor:pointer;transition:color .2s;
  }
  .modal-close:hover{color:var(--paper);}
  .modal-box h3{font-family:'Fraunces',serif;font-size:1.4rem;margin-bottom:18px;}
  .modal-box p,.modal-box li{color:var(--steel);font-size:0.88rem;line-height:1.7;margin-bottom:12px;}
  .modal-box ul{padding-left:20px;margin-bottom:12px;}

  /* ENHANCED FOOTER */
  footer{
    border-top:1px solid var(--line);padding:44px 0 34px;
    color:var(--steel);font-size:0.78rem;
  }
  .footer-inner{display:flex;justify-content:space-between;flex-wrap:wrap;gap:32px;margin-bottom:28px;}
  .footer-col h4{font-family:'IBM Plex Mono',monospace;font-size:0.72rem;color:var(--brass);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:14px;}
  .footer-col a{display:block;color:var(--steel);font-size:0.82rem;padding:4px 0;transition:color .2s;}
  .footer-col a:hover{color:var(--paper);}
  .footer-bottom{border-top:1px solid var(--line);padding-top:20px;display:flex;justify-content:space-between;flex-wrap:wrap;gap:12px;font-size:0.75rem;}
  @media(max-width:760px){
    .footer-inner{flex-direction:column;gap:24px;}
  }

  @media(max-width:760px){
    .nav-links{display:none;}
    .nav-links.active{
      display:flex;flex-direction:column;position:absolute;top:100%;left:0;right:0;
      background:var(--surface);padding:20px 28px;border-bottom:1px solid var(--line);gap:16px;
    }
    .menu-toggle{display:block;}
    .contact-grid{grid-template-columns:1fr;}
    .section-head{flex-direction:column;align-items:flex-start;}
  }
  :focus-visible{outline:2px solid var(--brass);outline-offset:2px;}
  @media (prefers-reduced-motion: reduce){
    .board-inner{animation:none;}
    .dot{animation:none;}
    .reveal{opacity:1;transform:none;transition:none;}
  }

  /* Honeypot anti-spam field: hidden from real visitors, but not with
     display:none/visibility:hidden — some bots skip those and only fill
     visually-hidden-but-"present" fields, which is exactly what we want. */
  .hp-field{
    position:absolute;left:-9999px;top:-9999px;width:1px;height:1px;
    overflow:hidden;
  }

  /* WHATSAPP FLOATING BUTTON
     --fab-shift is kept in sync with JS (see syncFabToViewport) to fix a
     known Android bug (MIUI browser / some Chrome builds): position:fixed
     is computed against the full layout viewport instead of the currently
     visible visual viewport, so the button sits below the fold and is
     invisible until the address bar collapses on scroll. */
  .whatsapp-fab{
    position:fixed;bottom:100px;right:22px;z-index:9999;
    width:58px;height:58px;border-radius:50%;
    background:#25D366;display:flex;align-items:center;justify-content:center;
    box-shadow:0 6px 20px rgba(0,0,0,0.35);
    transition:transform .2s;
    transform:translateZ(0) translateY(calc(-1 * var(--fab-shift, 0px)));
  }
  .whatsapp-fab:hover{transform:translateZ(0) translateY(calc(-1 * var(--fab-shift, 0px))) scale(1.08);}
  .whatsapp-fab svg{width:30px;height:30px;}
  @media(max-width:760px){
    .whatsapp-fab{width:52px;height:52px;bottom:90px;right:16px;}
    .whatsapp-fab svg{width:27px;height:27px;}
  }
  html[dir="rtl"] .whatsapp-fab{right:auto;left:22px;}
  @media(max-width:760px){
    html[dir="rtl"] .whatsapp-fab{right:auto;left:16px;}
  }

</style>
