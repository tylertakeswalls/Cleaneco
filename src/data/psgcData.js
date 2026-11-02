// Official Philippine Standard Geographic Code (PSGC) reference for operational territory
export const PSGC_PROVINCES = {
  'Cavite': [
    'Bacoor City', 'Carmona City', 'Cavite City', 'Dasmariñas City', 'General Trias City',
    'Imus City', 'Tagaytay City', 'Trece Martires City', 'Alfonso', 'Amadeo', 'General Emilio Aguinaldo',
    'General Mariano Alvarez (GMA)', 'Indang', 'Kawit', 'Magallanes', 'Maragondon', 'Mendez',
    'Naic', 'Noveleta', 'Rosario', 'Silang', 'Tanza', 'Ternate'
  ],
  'Laguna': [
    'Biñan City', 'Cabuyao City', 'Calamba City', 'San Pablo City', 'San Pedro City',
    'Santa Rosa City', 'Alaminos', 'Bay', 'Calauan', 'Cavinti', 'Famy', 'Kalayaan',
    'Liliw', 'Los Baños', 'Luisiana', 'Lumban', 'Mabitac', 'Magdalena', 'Majayjay',
    'Nagcarlan', 'Paete', 'Pagsanjan', 'Pakil', 'Pangil', 'Pila', 'Rizal', 'San Antonio',
    'Santa Cruz', 'Santa Maria', 'Siniloan', 'Victoria'
  ],
  'Batangas': [
    'Batangas City', 'Lipa City', 'Santo Tomas City', 'Tanauan City', 'Agoncillo', 'Alitagtag',
    'Balayan', 'Balete', 'Bauan', 'Calaca City', 'Calatagan', 'Cuenca', 'Ibaan', 'Laurel',
    'Lemery', 'Lian', 'Lobo', 'Mabini', 'Malvar', 'Mataasnakahoy', 'Nasugbu', 'Padre Garcia',
    'Rosario', 'San Jose', 'San Juan', 'San Luis', 'San Nicolas', 'San Pascual', 'Santa Teresita',
    'Taal', 'Talisay', 'Taysan', 'Tingloy', 'Tuy'
  ],
  'Rizal': [
    'Antipolo City', 'Angono', 'Baras', 'Binangonan', 'Cainta', 'Cardona', 'Jalajala',
    'Morong', 'Pililla', 'Rodriguez (Montalban)', 'San Mateo', 'Tanay', 'Taytay', 'Teresa'
  ],
  'Quezon': [
    'Lucena City', 'Tayabas City', 'Candelaria', 'Dolores', 'Lucban', 'Pagbilao', 'Sampaloc',
    'San Antonio', 'Sariaya', 'Tiaong', 'Infanta', 'Real', 'General Nakar', 'Atimonan', 'Calauag',
    'Gumaca', 'Lopez', 'Mauban'
  ],
  'Metro Manila (NCR)': [
    'Caloocan City', 'Las Piñas City', 'Makati City', 'Malabon City', 'Mandaluyong City',
    'Manila City', 'Marikina City', 'Muntinlupa City', 'Navotas City', 'Parañaque City',
    'Pasay City', 'Pasig City', 'Quezon City', 'San Juan City', 'Taguig City', 'Valenzuela City', 'Pateros'
  ]
};

export const CALABARZON_PROVINCES = ['Cavite', 'Laguna', 'Batangas', 'Rizal', 'Quezon'];

/**
 * Checks if a given province name belongs to CALABARZON
 */
export function isCalabarzonProvince(province) {
  if (!province || typeof province !== 'string') return false;
  const p = province.toLowerCase().trim();
  return CALABARZON_PROVINCES.some(cp => cp.toLowerCase() === p);
}

/**
 * Detects Region (NCR vs CALABARZON) from province and/or raw address string
 */
export function detectRegionFromAddress(address = '', province = '') {
  if (province) {
    if (isCalabarzonProvince(province)) return 'CALABARZON';
    if (province.toLowerCase().includes('ncr') || province.toLowerCase().includes('manila')) return 'NCR';
  }

  const addr = (address || '').toLowerCase();
  for (const prov of CALABARZON_PROVINCES) {
    if (addr.includes(prov.toLowerCase())) return 'CALABARZON';
  }

  // Check known Calabarzon cities if province name wasn't explicitly mentioned
  for (const prov of CALABARZON_PROVINCES) {
    const cities = PSGC_PROVINCES[prov] || [];
    for (const city of cities) {
      const cleanCity = city.toLowerCase().replace(' city', '').trim();
      if (cleanCity.length > 3 && addr.includes(cleanCity)) {
        return 'CALABARZON';
      }
    }
  }

  return 'NCR';
}

/**
 * Formats structured address components into a single coherent address string
 */
export function formatFullAddress({ addressLine1 = '', addressLine2 = '', barangay = '', city = '', province = '' } = {}) {
  const parts = [];
  if (addressLine1 && addressLine1.trim()) parts.push(addressLine1.trim());
  if (addressLine2 && addressLine2.trim()) parts.push(addressLine2.trim());
  if (barangay && barangay.trim()) {
    const cleanBgy = barangay.trim().replace(/^brgy\.?\s+/i, '').replace(/^barangay\s+/i, '');
    parts.push(`Barangay ${cleanBgy}`);
  }
  if (city && city.trim()) parts.push(city.trim());
  if (province && province.trim()) parts.push(province.trim());
  return parts.join(', ');
}

