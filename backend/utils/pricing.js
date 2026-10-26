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

module.exports = {
  calculateServiceEstimate,
  calculateStartingPrice,
  calculateOrderTotals
};
