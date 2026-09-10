
async function saveToFirestore(snapshot) {
  if (!props.db) return null;
  let docRef;
  const editToken = generateEditToken();
  
  // تنسيق التاريخ والوقت ليظهر بالشكل الكامل (YYYY-MM-DD HH:mm) بدلاً من قصه
  const formattedDateTime = snapshot.dataOra ? snapshot.dataOra.replace('T', ' ') : '';

  try {
    docRef = await addDoc(collection(props.db, 'bookings'), {
      editToken,
      // campi storici (compatibilità con il mirror attuale in Admin.vue)
      name: snapshot.name,
      titolo: snapshot.titolo || null,
      country: snapshot.country,
      phone: snapshot.phone,
      service: TIPI_SERVIZIO.find(s => s.id === snapshot.tipoServizio)?.it || snapshot.tipoServizio,
      
      // ⬇️ تم الإصلاح هنا: إرسال التاريخ والوقت كاملاً بدون slice(0, 10)
      serviceDate: formattedDateTime,
      
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

  // Specchia la prenotazione come bozza in ncc-fleet
  const syncOperation = {
    bookingId: docRef.id,
    name: snapshot.name,
    country: snapshot.country,
    phone: snapshot.phone,
    service: TIPI_SERVIZIO.find(s => s.id === snapshot.tipoServizio)?.it || snapshot.tipoServizio,
    
    // ⬇️ تم الإصلاح هنا أيضاً: إرسال الوقت والتاريخ كاملاً إلى ncc-fleet
    serviceDate: formattedDateTime,
    
    hotel: snapshot.destinazione || null,
    flight: snapshot.volo || null,
    people: snapshot.passeggeri || null,
    bags: snapshot.bagagli || null,
    details: note.value || null,
  };

  // Add to sync queue first for resilience
  syncQueue.enqueue({
    bookingId: docRef.id,
    operation: 'sync-pending',
    data: syncOperation,
    options: { priority: 'high' },
  });

  fetch('/api/sync-pending', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(syncOperation),
  })
    .then((response) => {
      if (response.ok) {
        syncQueue.clearCompleted();
      } else {
        console.warn('[sync-pending] non-successful response:', response.status);
      }
    })
    .catch((e) => {
      console.warn('[sync-pending] chiamata fallita (non bloccante, rimane in coda):', e);
    });

  return docRef;
}