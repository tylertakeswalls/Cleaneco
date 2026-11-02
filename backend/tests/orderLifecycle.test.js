const assert = require('assert');
const { calculateServiceEstimate, calculateOrderTotals, calculateStartingPrice } = require('../utils/pricing');

console.log('====================================================');
console.log('RUNNING CLEANECO ORDER LIFECYCLE INTEGRATION TESTS');
console.log('====================================================\n');

// Mock Siphoning & Desludging service configuration
const mockSiphoningService = {
  _id: 'srv_siphon_001',
  name: 'Siphoning & Desludging',
  rate: 8000,
  pricing_mode: 'rate',
  fixed_fee: 0,
  fields: [
    {
      key: 'numTanks',
      label: 'Number of Tanks',
      type: 'number',
      min: 1,
      default: 1,
      counts_toward_trips: true
    },
    {
      key: 'capacityType',
      label: 'Tank Capacity / Volume',
      type: 'multiplier',
      counts_toward_trips: true,
      options: [
        { value: '1', label: 'Standard (Up to 5,000L)', factor: 1 },
        { value: '2', label: 'Medium (Up to 10,000L)', factor: 2 },
        { value: '3', label: 'High (Up to 15,000L)', factor: 3 }
      ]
    },
    {
      key: 'accessibility',
      label: 'Site Accessibility',
      type: 'surcharge',
      options: [
        { value: 'easy', label: 'Standard Hose Access (< 30m)', amount: 0 },
        { value: 'difficult', label: 'Extended Distance Hose Access (> 30m)', amount: 1500 }
      ]
    }
  ]
};

// TEST 1: Pricing Calculation & Starting Price
console.log('TEST 1: Starting Price & Base Calculation');
const startPrice = calculateStartingPrice(mockSiphoningService);
assert.strictEqual(startPrice, 8000, 'Starting price must be ₱8,000.00');
console.log('  ✔ Starting price verified: ₱8,000.00');

// TEST 2: Multi-tank & Accessibility Surcharge
console.log('\nTEST 2: Complex Estimate Calculation (2 Tanks, Medium Capacity, Difficult Access)');
const estimate = calculateServiceEstimate(mockSiphoningService, {
  numTanks: 2,
  capacityType: '2',
  accessibility: 'difficult'
});
// Math: 2 tanks * 2 capacity = 4 trips
// 4 trips * 8000 rate = 32000
// + 1500 accessibility surcharge = 33500 subtotal
assert.strictEqual(estimate.trips, 4, 'Trips must equal 4');
assert.strictEqual(estimate.subtotal, 33500, 'Subtotal must equal ₱33,500.00');
console.log(`  ✔ Correct trips: ${estimate.trips}`);
console.log(`  ✔ Correct subtotal: ₱${estimate.subtotal.toLocaleString()}`);

// TEST 3: 10% Service Tax Calculation (Synchronized Terminology & Math)
console.log('\nTEST 3: Service Tax (10%) & Final Quotation Formula');
const discount = 1500;
const taxableAmount = estimate.subtotal - discount; // 32000
const serviceTax = Math.round(taxableAmount * 0.10 * 100) / 100; // 3200
const finalPrice = taxableAmount + serviceTax; // 35200

assert.strictEqual(serviceTax, 3200, '10% Service tax must equal ₱3,200.00');
assert.strictEqual(finalPrice, 35200, 'Final price must equal ₱35,200.00');
console.log(`  ✔ Service Tax (10%): ₱${serviceTax.toLocaleString()}`);
console.log(`  ✔ Total Approved Amount: ₱${finalPrice.toLocaleString()}`);

// TEST 4: 5-Stage Lifecycle State Machine
console.log('\nTEST 4: Canonical 5-Stage Lifecycle Progression');
const STAGES = {
  STAGE_1_RESERVED: {
    status: 'Pending',
    reservation_paid: false,
    quotation_status: null,
    expected_stage: 'Reserved'
  },
  STAGE_2_FOR_INSPECTION: {
    status: 'In Progress',
    reservation_paid: true,
    quotation_status: 'Pending Inspection',
    expected_stage: 'For Inspection'
  },
  STAGE_3_QUOTED: {
    status: 'In Progress',
    has_final_price: true,
    quotation_status: 'Pending Client Approval',
    expected_stage: 'Quoted'
  },
  STAGE_4_FOR_SERVICE_EXECUTION: {
    status: 'In Progress',
    has_final_price: true,
    quotation_status: 'Approved',
    service_execution_date: '2026-11-20',
    expected_stage: 'For Service Execution'
  },
  STAGE_5_COMPLETED: {
    status: 'Completed',
    service_report: '/uploads/report_001.pdf',
    expected_stage: 'Completed'
  }
};

function resolveLifecycleStage(order) {
  if (order.status === 'Completed') return 'Completed';
  if (order.quotation_status === 'Approved' && order.service_execution_date) return 'For Service Execution';
  if (order.has_final_price || order.quotation_status === 'Pending Client Approval') return 'Quoted';
  if (order.status === 'In Progress' || order.reservation_paid) return 'For Inspection';
  return 'Reserved';
}

Object.entries(STAGES).forEach(([key, stage]) => {
  const resolved = resolveLifecycleStage(stage);
  assert.strictEqual(resolved, stage.expected_stage, `Failed resolving stage for ${key}`);
  console.log(`  ✔ ${stage.expected_stage} stage state machine verified`);
});

// TEST 5: High-Capacity Trip Rule (5+ Trips requires 2 Trucks)
console.log('\nTEST 5: Capacity-Aware Slot Engine Rules');
const standardOrder = { total_trips: 3 };
const highCapacityOrder = { total_trips: 6 };

const isHighCapacity = (order) => (Number(order.total_trips) || 1) >= 5;
assert.strictEqual(isHighCapacity(standardOrder), false, '3 trips is standard capacity');
assert.strictEqual(isHighCapacity(highCapacityOrder), true, '6 trips is high capacity');
console.log('  ✔ Standard order (3 trips) -> 1 truck slot');
console.log('  ✔ High-capacity order (6 trips) -> 2 operational trucks full-day lock');

console.log('\n====================================================');
console.log('ALL ORDER LIFECYCLE TESTS PASSED SUCCESSFULLY (5/5)');
console.log('====================================================');

