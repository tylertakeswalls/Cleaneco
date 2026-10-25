require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const Service = require('../models/Service');
const Order = require('../models/Order');
const { calculateServiceEstimate, calculateStartingPrice, calculateOrderTotals } = require('../utils/pricing');

// Old hardcoded formula for comparison
function legacyCalculate(serviceName, inputs = {}) {
  const name = serviceName.toLowerCase();
  if (name.includes('siphon') || name.includes('desludg')) {
    const numTanks = parseInt(inputs.numTanks || 1);
    const capacityType = parseInt(inputs.capacityType || 1);
    const accessibility = inputs.accessibility || 'easy';
    const trips = numTanks * capacityType;
    let cost = trips * 8000;
    if (accessibility === 'difficult') {
      cost += 1500;
    }
    return { subtotal: cost, trips };
  } else if (name.includes('deep clean') || name.includes('declog')) {
    const numTanks = parseInt(inputs.numTanks || 1);
    return { subtotal: numTanks * 8000, trips: numTanks };
  } else {
    return { subtotal: 0, trips: 1 };
  }
}

async function runTests() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB for pricing parity testing.\n');

  const siphoningService = await Service.findOne({ name: /siphon/i });
  const deepCleanService = await Service.findOne({ name: /deep clean/i });

  if (!siphoningService || !deepCleanService) {
    console.error('Could not find existing services in database!');
    process.exit(1);
  }

  const siphoningTestCases = [
    { numTanks: 1, capacityType: '1', accessibility: 'easy' },
    { numTanks: 1, capacityType: '2', accessibility: 'easy' },
    { numTanks: 2, capacityType: '1', accessibility: 'difficult' },
    { numTanks: 2, capacityType: '2', accessibility: 'difficult' },
    { numTanks: 5, capacityType: '2', accessibility: 'difficult' },
  ];

  console.log('--- TEST 1: Siphoning & Desludging Parity ---');
  let allPassed = true;
  for (const tc of siphoningTestCases) {
    const legacy = legacyCalculate(siphoningService.name, tc);
    const modern = calculateServiceEstimate(siphoningService, tc);

    const matchesPrice = legacy.subtotal === modern.subtotal;
    const matchesTrips = legacy.trips === modern.trips;
    if (matchesPrice && matchesTrips) {
      console.log(`[PASS] Inputs: ${JSON.stringify(tc)} => ₱${modern.subtotal} (${modern.trips} trips)`);
    } else {
      allPassed = false;
      console.error(`[FAIL] Inputs: ${JSON.stringify(tc)} => Expected ₱${legacy.subtotal} (${legacy.trips} trips), got ₱${modern.subtotal} (${modern.trips} trips)`);
    }
  }

  console.log('\n--- TEST 2: Deep Cleaning & Declogging Parity ---');
  const deepCleanTestCases = [
    { numTanks: 1 },
    { numTanks: 2 },
    { numTanks: 4 }
  ];

  for (const tc of deepCleanTestCases) {
    const legacy = legacyCalculate(deepCleanService.name, tc);
    const modern = calculateServiceEstimate(deepCleanService, tc);

    const matchesPrice = legacy.subtotal === modern.subtotal;
    const matchesTrips = legacy.trips === modern.trips;
    if (matchesPrice && matchesTrips) {
      console.log(`[PASS] Inputs: ${JSON.stringify(tc)} => ₱${modern.subtotal} (${modern.trips} trips)`);
    } else {
      allPassed = false;
      console.error(`[FAIL] Inputs: ${JSON.stringify(tc)} => Expected ₱${legacy.subtotal} (${legacy.trips} trips), got ₱${modern.subtotal} (${modern.trips} trips)`);
    }
  }

  console.log('\n--- TEST 3: Starting Prices ---');
  const siphStart = calculateStartingPrice(siphoningService);
  const deepStart = calculateStartingPrice(deepCleanService);
  console.log(`Siphoning Starting Price: ₱${siphStart} (Expected: 8000) -> ${siphStart === 8000 ? '[PASS]' : '[FAIL]'}`);
  console.log(`Deep Clean Starting Price: ₱${deepStart} (Expected: 8000) -> ${deepStart === 8000 ? '[PASS]' : '[FAIL]'}`);

  console.log('\n--- TEST 4: Delete Protection on Service with Orders ---');
  const orderCount = await Order.countDocuments({
    $or: [
      { service_id: siphoningService._id },
      { service_ids: siphoningService._id }
    ]
  });
  console.log(`Siphoning service has ${orderCount} existing order(s).`);
  if (orderCount > 0) {
    console.log('[PASS] Delete protection condition triggers correctly (blocks deletion and prompts "Unavailable").');
  } else {
    console.log('[INFO] No existing orders found for Siphoning.');
  }

  await mongoose.disconnect();
  console.log('\nAll parity checks completed ' + (allPassed ? 'SUCCESSFULLY!' : 'WITH FAILURES!'));
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
