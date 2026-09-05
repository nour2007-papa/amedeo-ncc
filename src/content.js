export const services = [
  { code: 'RT · 001', titleKey: 's1_title', descKey: 's1_desc', tag1: 'MXP / LIN / BGY', tag2: 'H24', airport: true },
  { code: 'RT · 002', titleKey: 's2_title', descKey: 's2_desc', tag1: 'MILANO', tag2: 'MEZZA/GG' },
  { code: 'RT · 003', titleKey: 's3_title', descKey: 's3_desc', tag1: 'MILANO / LOMB.', tag2: 'SU RICH.' },
  { code: 'RT · 004', titleKey: 's4_title', descKey: 's4_desc', tag1: 'ON DEMAND', tag2: 'PREV. 48H' },
  { code: 'RT · 005', titleKey: 's5_title', descKey: 's5_desc', tag1: 'IT / EU', tag2: 'SU RICH.' },
];

export const fleet = [
  { code: 'CLASSE-E', name: 'Mercedes Classe E', descKey: 'c1', photo: 'https://images.unsplash.com/photo-1589199928766-31ac1fa51e2c?fm=jpg&q=70&w=1200&auto=format&fit=crop', alt: 'Mercedes Classe E - Berlina executive per transfer aeroporto e rappresentanza business a Milano' },
  { code: 'CLASSE-S', name: 'Mercedes Classe S', descKey: 'c2', photo: 'https://images.unsplash.com/photo-1615135902193-b107418fb7eb?fm=jpg&q=70&w=1200&auto=format&fit=crop', alt: 'Mercedes Classe S - Limousine di lusso per VIP e occasioni speciali a Milano' },
  { code: 'CLASSE-V', name: 'Mercedes Classe V', descKey: 'c3', photo: 'https://images.unsplash.com/photo-1765461734605-3429047e7afc?fm=jpg&q=70&w=1200&auto=format&fit=crop', alt: 'Mercedes Classe V - Van premium fino a 6 passeggeri per famiglie e gruppi a Milano' },
];

export const trips = [
  { kind: 'trip', code: 'MI → ROMA', titleKey: 'v1_title', descKey: 'v1', photo: 'https://images.unsplash.com/photo-1515542483964-5e8c63d7d89b?fm=jpg&q=70&w=1200&auto=format&fit=crop', alt: 'Viaggio da Milano a Roma con autista privato - Tour del Colosseo e Piazza di Spagna', name: 'Roma' },
  { kind: 'trip', code: 'MI → PISA', titleKey: 'v2_title', descKey: 'v2', photo: 'https://images.unsplash.com/photo-1548510907-5b514c51aba6?fm=jpg&q=70&w=1200&auto=format&fit=crop', alt: 'Viaggio da Milano a Pisa con autista privato - Tour della Torre Pendente e Piazza dei Miracoli', name: 'Pisa' },
  { kind: 'trip', code: 'MI → VENEZIA', titleKey: 'v3_title', descKey: 'v3', photo: 'https://images.unsplash.com/photo-1767199289290-010e7caf8240?fm=jpg&q=70&w=1200&auto=format&fit=crop', alt: 'Viaggio da Milano a Venezia con autista privato - Tour di San Marco e Canal Grande', name: 'Venezia' },
  { kind: 'trip', code: 'MI → COMO', titleKey: 'v4_title', descKey: 'v4', photo: 'https://images.unsplash.com/photo-1603491595041-3429047e7afc?fm=jpg&q=70&w=1200&auto=format&fit=crop', alt: 'Viaggio da Milano al Lago di Como con autista privato - Tour di Bellagio e Villa del Balbianello', name: 'Como' },
  { kind: 'trip', code: 'MI → FIRENZE', titleKey: 'v8_title', descKey: 'v8', photo: 'https://images.unsplash.com/photo-1748191024085-391d76b8d5ed?fm=jpg&q=70&w=1200&auto=format&fit=crop', alt: 'Viaggio da Milano a Firenze con autista privato - Tour del Duomo e Uffizi', name: 'Firenze' },
  { kind: 'otherItaly', code: 'MI → ITALIA', titleKey: 'v9_title', descKey: 'v9_desc', photoRotating: 'otherItaly' },
  { kind: 'trip', code: 'MI → PARIGI', titleKey: 'v5_title', descKey: 'v5', photo: 'https://images.unsplash.com/photo-1431274172761-fca41d930114?fm=jpg&q=70&w=1200&auto=format&fit=crop', alt: 'Viaggio da Milano a Parigi con autista privato - Tour della Torre Eiffel e Champs-Élysées', name: 'Parigi' },
  { kind: 'trip', code: 'MI → SVIZZERA', titleKey: 'v6_title', descKey: 'v6', photo: 'https://images.unsplash.com/photo-1527668752968-14dc70a27c95?fm=jpg&q=70&w=1200&auto=format&fit=crop', alt: 'Viaggio da Milano alla Svizzera con autista privato - Tour di Zurigo, Lucerna e Ginevra', name: 'Svizzera' },
  { kind: 'custom', code: 'MI → ?', titleKey: 'v7_title', descKey: 'v7_desc', photoRotating: 'customTrip' },
];

export const otherItalyImages = [
  'https://images.unsplash.com/photo-1561956021-947f09ae0101?fm=jpg&q=70&w=1200&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1530735606451-8f5f13955328?fm=jpg&q=70&w=1200&auto=format&fit=crop',
];

export const customTripImages = [
  'https://images.unsplash.com/photo-1515542483964-5e8c63d7d89b?fm=jpg&q=70&w=1200&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1548510907-5b514c51aba6?fm=jpg&q=70&w=1200&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1767199289290-010e7caf8240?fm=jpg&q=70&w=1200&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1603491595041-3429047e7afc?fm=jpg&q=70&w=1200&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1431274172761-fca41d930114?fm=jpg&q=70&w=1200&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1527668752968-14dc70a27c95?fm=jpg&q=70&w=1200&auto=format&fit=crop',
];