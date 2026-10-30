/**
 * Backend Pricing Calculator Utility
 * Single source of truth for all service estimate and trip calculations.
 */

/**
 * Calculate the estimate and trips for a single service given its pricing configuration and user inputs.
 *
 * @param {Object} serviceConfig - { pricing_mode, rate, fixed_fee, fields, base_price, name }
 * @param {Object} inputs - e.g. { numTanks: '2', capacityType: '2', accessibility: 'difficult' }
 * @returns {Object} { subtotal, trips, isInspectionOnly, ratePortion, surcharges, fixedFee, breakdown }
 */
function calculateServiceEstimate(serviceConfig, inputs = {}) {
  if (!serviceConfig) {
    return { subtotal: 0, trips: 1, isInspectionOnly: false, ratePortion: 0, surcharges: 0, fixedFee: 0, breakdown: [] };
  }

  const fields = Array.isArray(serviceConfig.fields) ? serviceConfig.fields : [];

  // Fallback for legacy services with no fields and no rate, but having base_price
  if (!serviceConfig.rate && fields.length === 0) {
    const fallbackPrice = parseFloat(serviceConfig.base_price || 0);
    return {
      subtotal: fallbackPrice,
      trips: 1,
      isInspectionOnly: false,
      ratePortion: fallbackPrice,
      surcharges: 0,
      fixedFee: 0,
      breakdown: [{ label: 'Fixed Base Price', amount: fallbackPrice }]
    };
  }

  const rate = parseFloat(serviceConfig.rate || 0);
  const fixedFee = parseFloat(serviceConfig.fixed_fee || 0);

  let numberMultiplierTotal = 1;
  let multiplierFactorTotal = 1;
  let totalSurcharges = 0;

  let tripsMultiplier = 1;
  let hasTripCountingField = false;

  const breakdown = [];

  fields.forEach(field => {
    const rawVal = inputs[field.key];

    if (field.type === 'number') {
      const parsed = parseFloat(rawVal !== undefined && rawVal !== '' ? rawVal : (field.default ?? 1));
      const val = isNaN(parsed) ? 1 : Math.max(0, parsed);
      numberMultiplierTotal *= val;

      if (field.counts_toward_trips) {
        tripsMultiplier *= Math.max(1, val);
        hasTripCountingField = true;
      }
    } else if (field.type === 'multiplier') {
      const selectedVal = rawVal !== undefined && rawVal !== '' ? String(rawVal) : String(field.default ?? field.options?.[0]?.value ?? '');
      const opt = (field.options || []).find(o => String(o.value) === selectedVal) || field.options?.[0];
      const factor = opt && !isNaN(parseFloat(opt.factor)) ? parseFloat(opt.factor) : 1;
      multiplierFactorTotal *= factor;

      if (field.counts_toward_trips) {
        tripsMultiplier *= Math.max(1, factor);
        hasTripCountingField = true;
      }
    } else if (field.type === 'surcharge') {
      const selectedVal = rawVal !== undefined && rawVal !== '' ? String(rawVal) : String(field.default ?? field.options?.[0]?.value ?? '');
      const opt = (field.options || []).find(o => String(o.value) === selectedVal) || field.options?.[0];
      const surcharge = opt && !isNaN(parseFloat(opt.amount)) ? parseFloat(opt.amount) : 0;
      totalSurcharges += surcharge;

      if (surcharge > 0 && opt) {
        breakdown.push({ label: `${field.label}: ${opt.label}`, amount: surcharge });
      }
    }
  });

  const ratePortion = rate * numberMultiplierTotal * multiplierFactorTotal;
  const subtotal = Math.max(0, ratePortion + totalSurcharges + fixedFee);
  const trips = hasTripCountingField ? Math.max(1, Math.ceil(tripsMultiplier)) : 1;

  return {
    subtotal,
    trips,
    isInspectionOnly: false,
    ratePortion,
    surcharges: totalSurcharges,
    fixedFee,
    breakdown
  };
}

/**
 * Calculate the starting price of a service based on its default values.
 *
 * @param {Object} serviceConfig
 * @returns {Number}
 */
function calculateStartingPrice(serviceConfig) {
  if (!serviceConfig) return 0;

  const defaults = {};
  (serviceConfig.fields || []).forEach(f => {
    if (f.default !== undefined) {
      defaults[f.key] = f.default;
    } else if (f.options && f.options.length > 0) {
      defaults[f.key] = f.options[0].value;
    } else if (f.type === 'number') {
      defaults[f.key] = f.min || 1;
    }
  });

  return calculateServiceEstimate(serviceConfig, defaults).subtotal;
}

/**
 * Calculate totals across multiple services.
 *
 * @param {Array<Object>} servicesList - Array of service models or snapshot objects
 * @param {Object} estimateInputs - Inputs keyed by service ID
 * @returns {Object} { totalEstimate, totalTrips, hasInspectionOnly, details: {} }
 */
function calculateOrderTotals(servicesList = [], estimateInputs = {}) {
  let totalEstimate = 0;
  let totalTrips = 0;
  let hasInspectionOnly = false;
  const details = {};

  servicesList.forEach(service => {
    const sId = service._id ? String(service._id) : (service.id ? String(service.id) : '');
    const inputs = estimateInputs[sId] || (service._id && estimateInputs[service._id]) || (service.id && estimateInputs[service.id]) || {};
    const result = calculateServiceEstimate(service, inputs);

    totalEstimate += result.subtotal;
    totalTrips += result.trips;
    if (result.isInspectionOnly) {
      hasInspectionOnly = true;
    }
    if (sId) {
      details[sId] = result;
    }
  });

  return {
    totalEstimate,
    totalTrips: Math.max(1, totalTrips),
    hasInspectionOnly,
    details
  };
}

function parseNumericAmount(val) {
  if (typeof val === 'number') return Number.isFinite(val) ? val : 0;
  if (val === null || val === undefined || val === '') return 0;
  const cleaned = String(val).replace(/[₱,\s]/g, '').replace(/^PHP/i, '').trim();
  const parsed = parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Deduplicate raw Order documents by order_id so multi-service bookings count once,
 * while preserving individual legacy/seeded records that lack an order_id.
 */
function groupOrdersByOrderId(rawOrders = []) {
  const groupedMap = new Map();

  rawOrders.forEach((order, idx) => {
    const groupKey = order.order_id
      ? String(order.order_id)
      : String(order._id || order.id || `legacy_${idx}`);

    const svcName = (order.service_id && typeof order.service_id === 'object' && order.service_id.name)
      ? order.service_id.name
      : (order.service_name || order.service_type || 'Service');

    const sId = (order.service_id && typeof order.service_id === 'object')
      ? String(order.service_id._id || order.service_id.id || '')
      : (order.service_id ? String(order.service_id) : '');

    if (!groupedMap.has(groupKey)) {
      groupedMap.set(groupKey, {
        ...order,
        id: order.id || order._id,
        first_id: order.id || order._id,
        services: [order],
        service_names: [svcName],
        service_ids: sId ? [sId] : []
      });
    } else {
      const existing = groupedMap.get(groupKey);
      existing.services.push(order);
      if (svcName && !existing.service_names.includes(svcName)) {
        existing.service_names.push(svcName);
      }
      if (sId && !existing.service_ids.includes(sId)) {
        existing.service_ids.push(sId);
      }
      if (order.status === 'Completed' && existing.status !== 'Completed') {
        existing.status = 'Completed';
      }
      if (order.final_payment_status === 'Paid') {
        existing.final_payment_status = 'Paid';
      }
      if (order.has_final_price && !existing.has_final_price) {
        existing.has_final_price = true;
        existing.final_price = order.final_price;
      }
      if (order.service_report_pdf_url && !existing.service_report_pdf_url) {
        existing.service_report_pdf_url = order.service_report_pdf_url;
      }
      if (order.truck_team && !existing.truck_team) {
        existing.truck_team = order.truck_team;
      }
      if (order.service_execution_date && !existing.service_execution_date) {
        existing.service_execution_date = order.service_execution_date;
        existing.service_execution_time_slot = order.service_execution_time_slot || existing.service_execution_time_slot;
      }
      if (order.quotation_status && (!existing.quotation_status || existing.quotation_status === 'Pending Inspection')) {
        existing.quotation_status = order.quotation_status;
      }
    }
  });

  return Array.from(groupedMap.values()).map(o => ({
    ...o,
    id: o.first_id,
    service_name: o.service_names.join(', ')
  }));
}

/**
 * Single source of truth for Actual Collected Cash Revenue (incl. 10% tax) per grouped order:
 * - Pending / Cancelled: ₱0
 * - In Progress: ₱1,100 (paid ₱1,000 reservation + 10% tax)
 * - Completed:
 *   - Phase-2 quoted order (has_final_price === true):
 *     - final_payment_status === 'Paid': Math.max(1100, final_price * 1.1)
 *     - awaiting final payment: ₱1,100 (reservation collected so far)
 *   - Legacy / dummy Completed order (!has_final_price):
 *     - stored price + tax_amount
 */
function calculateOrderCollectedRevenue(order) {
  if (!order || order.status === 'Pending' || order.status === 'Cancelled') {
    return 0;
  }

  if (order.status === 'In Progress') {
    return 1100;
  }

  if (order.status === 'Completed') {
    if (order.has_final_price) {
      if (order.final_payment_status === 'Paid') {
        const finalPrice = parseNumericAmount(order.final_price);
        return Math.max(1100, finalPrice * 1.1);
      }
      return 1100;
    }

    const legacyPrice = parseNumericAmount(order.price);
    const legacyTax = parseNumericAmount(order.tax_amount);
    return legacyPrice + legacyTax;
  }

  return 0;
}

function buildServiceFieldBreakdown(serviceConfig, inputs = {}, justifications = {}) {
  const fields = Array.isArray(serviceConfig?.fields) ? serviceConfig.fields : [];
  const rate = (!serviceConfig?.rate && fields.length === 0)
    ? parseFloat(serviceConfig?.base_price || 0)
    : parseFloat(serviceConfig?.rate || 0);
  const fixedFee = parseFloat(serviceConfig?.fixed_fee || 0);

  if (fields.length === 0) {
    const flatTotal = Math.max(0, rate + fixedFee);
    return {
      items: [
        {
          key: '_base',
          label: 'Base Service Rate',
          displayValue: 'Standard Assessment',
          amount: flatTotal,
          formulaNote: null,
          justification: null,
          isDelta: false
        }
      ],
      subtotal: flatTotal
    };
  }

  const hasMultiplicative = fields.some(f => f.type === 'number' || f.type === 'multiplier');
  const items = [];

  if (!hasMultiplicative && rate > 0) {
    items.push({
      key: '_base_rate',
      label: 'Base Service Rate',
      displayValue: 'Standard Rate',
      amount: rate,
      formulaNote: null,
      justification: null,
      isDelta: false
    });
  }

  let runningRate = rate;
  let appliedFirstMultiplicative = false;
  const formattedBaseRate = rate.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  fields.forEach(field => {
    const rawVal = inputs ? inputs[field.key] : undefined;
    const justification = justifications ? (justifications[field.key] || null) : null;

    if (field.type === 'number') {
      const parsed = parseFloat(rawVal !== undefined && rawVal !== '' ? rawVal : (field.default ?? 1));
      const val = Number.isNaN(parsed) ? 1 : Math.max(0, parsed);
      const nextRunning = runningRate * val;

      if (!appliedFirstMultiplicative) {
        items.push({
          key: field.key,
          label: field.label,
          displayValue: String(val),
          amount: nextRunning,
          formulaNote: rate > 0 ? `${val} × PHP ${formattedBaseRate} base rate` : null,
          justification,
          isDelta: false
        });
        appliedFirstMultiplicative = true;
      } else {
        const delta = nextRunning - runningRate;
        items.push({
          key: field.key,
          label: field.label,
          displayValue: String(val),
          amount: delta,
          formulaNote: val !== 1 ? `×${val} quantity factor` : '×1 (Standard — included)',
          justification,
          isDelta: true
        });
      }
      runningRate = nextRunning;
    } else if (field.type === 'multiplier') {
      const selectedVal = rawVal !== undefined && rawVal !== ''
        ? String(rawVal)
        : String(field.default ?? field.options?.[0]?.value ?? '');
      const opt = (field.options || []).find(o => String(o.value) === selectedVal) || field.options?.[0];
      const factor = opt && !Number.isNaN(parseFloat(opt.factor)) ? parseFloat(opt.factor) : 1;
      const displayValue = opt ? opt.label : selectedVal;
      const nextRunning = runningRate * factor;

      if (!appliedFirstMultiplicative) {
        items.push({
          key: field.key,
          label: field.label,
          displayValue,
          amount: nextRunning,
          formulaNote: rate > 0
            ? (factor !== 1 ? `PHP ${formattedBaseRate} base × ${factor}` : 'Base rate (×1)')
            : null,
          justification,
          isDelta: false
        });
        appliedFirstMultiplicative = true;
      } else {
        const delta = nextRunning - runningRate;
        items.push({
          key: field.key,
          label: field.label,
          displayValue,
          amount: delta,
          formulaNote: factor !== 1 ? `×${factor} rate multiplier` : '×1 (Standard — no extra charge)',
          justification,
          isDelta: true
        });
      }
      runningRate = nextRunning;
    } else if (field.type === 'surcharge') {
      const selectedVal = rawVal !== undefined && rawVal !== ''
        ? String(rawVal)
        : String(field.default ?? field.options?.[0]?.value ?? '');
      const opt = (field.options || []).find(o => String(o.value) === selectedVal) || field.options?.[0];
      const surcharge = opt && !Number.isNaN(parseFloat(opt.amount)) ? parseFloat(opt.amount) : 0;
      const displayValue = opt ? opt.label : selectedVal;

      items.push({
        key: field.key,
        label: field.label,
        displayValue,
        amount: surcharge,
        formulaNote: surcharge > 0 ? 'Add-on surcharge' : 'No surcharge',
        justification,
        isDelta: true
      });
    }
  });

  if (fixedFee > 0) {
    items.push({
      key: '_fixed_fee',
      label: 'Fixed Service Fee',
      displayValue: 'Flat Service Fee',
      amount: fixedFee,
      formulaNote: null,
      justification: null,
      isDelta: true
    });
  }

  const subtotal = Math.max(0, items.reduce((sum, it) => sum + it.amount, 0));
  return { items, subtotal };
}

module.exports = {
  calculateServiceEstimate,
  calculateStartingPrice,
  calculateOrderTotals,
  parseNumericAmount,
  groupOrdersByOrderId,
  calculateOrderCollectedRevenue,
  buildServiceFieldBreakdown
};
