const assert = require('assert');
const mongoose = require('mongoose');
const User = require('../models/User');

const CALABARZON_PROVINCES = ['Cavite', 'Laguna', 'Batangas', 'Rizal', 'Quezon'];

const PSGC_PROVINCES = {
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

function isCalabarzonProvince(province) {
  if (!province || typeof province !== 'string') return false;
  const p = province.toLowerCase().trim();
  return CALABARZON_PROVINCES.some(cp => cp.toLowerCase() === p);
}

function detectRegionFromAddress(address = '', province = '') {
  if (province) {
    if (isCalabarzonProvince(province)) return 'CALABARZON';
    if (province.toLowerCase().includes('ncr') || province.toLowerCase().includes('manila')) return 'NCR';
  }

  const addr = (address || '').toLowerCase();
  for (const prov of CALABARZON_PROVINCES) {
    if (addr.includes(prov.toLowerCase())) return 'CALABARZON';
  }

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

function formatFullAddress({ addressLine1 = '', addressLine2 = '', barangay = '', city = '', province = '' } = {}) {
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

console.log('====================================================');
console.log('RUNNING ADDRESS RESOLUTION & REGION DETECTION TESTS');
console.log('====================================================\n');

// TEST 1: User with Province Cavite
const reg1 = detectRegionFromAddress('Block 1 Lot 2 Sampaguita St.', 'Cavite');
assert.strictEqual(reg1, 'CALABARZON', 'Should detect CALABARZON from province Cavite');
console.log('  ✔ Test 1 passed: Province "Cavite" yields CALABARZON');

// TEST 2: User with Bacoor City in address string (no province explicitly set)
const reg2 = detectRegionFromAddress('Block 1 Lot 2 Sampaguita St., Bacoor City, Barangay Molino', '');
assert.strictEqual(reg2, 'CALABARZON', 'Should detect CALABARZON from city Bacoor');
console.log('  ✔ Test 2 passed: Address containing "Bacoor City" yields CALABARZON');

// TEST 3: User in Metro Manila
const reg3 = detectRegionFromAddress('123 Taft Ave, Manila City', 'Metro Manila (NCR)');
assert.strictEqual(reg3, 'NCR', 'Should detect NCR from province Metro Manila');
console.log('  ✔ Test 3 passed: Metro Manila yields NCR');

// TEST 4: Address formatting
const formatted = formatFullAddress({
  addressLine1: 'Blk 12 Lot 4, Emerald St.',
  addressLine2: 'Greenbreeze Subdivision',
  barangay: 'San Agustin',
  city: 'Dasmariñas City',
  province: 'Cavite'
});
assert.strictEqual(
  formatted,
  'Blk 12 Lot 4, Emerald St., Greenbreeze Subdivision, Barangay San Agustin, Dasmariñas City, Cavite'
);
console.log('  ✔ Test 4 passed: Formatted address correctly synthesizes structured fields:');
console.log('    -> ' + formatted);

// TEST 5: User Schema Verification
const user = new User({
  username: 'test_geo_user',
  password: 'hashed_password',
  email: 'geo@cleaneco.ph',
  first_name: 'Juan',
  last_name: 'Dela Cruz',
  address: formatted,
  addressLine1: 'Blk 12 Lot 4, Emerald St.',
  addressLine2: 'Greenbreeze Subdivision',
  barangay: 'San Agustin',
  city: 'Dasmariñas City',
  province: 'Cavite'
});

assert.strictEqual(user.province, 'Cavite');
assert.strictEqual(user.city, 'Dasmariñas City');
assert.strictEqual(user.barangay, 'San Agustin');
console.log('  ✔ Test 5 passed: User mongoose model stores structured fields');

console.log('\n====================================================');
console.log('ALL ADDRESS & REGION DETECTION TESTS PASSED (5/5)');
console.log('====================================================');

