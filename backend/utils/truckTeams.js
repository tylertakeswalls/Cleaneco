const crypto = require('crypto');
const Setting = require('../models/Setting');

const SETTING_KEY = 'truck_teams';
const DEFAULT_TEAM_NAMES = ['Truck Team 1', 'Truck Team 2'];
const STANDARD_SLOTS = ['Morning', 'Afternoon', 'Evening'];

const newTruckId = () => `truck-${crypto.randomBytes(4).toString('hex')}`;

/**
 * Converts any stored truck list into the current shape: { id, name, status }.
 * Older data stored trucks as plain name strings; those become "available" trucks.
 * Returns { teams, migrated } where `migrated` is true if the input needed changes.
 */
const normalizeTruckTeams = (raw) => {
  let migrated = false;
  const list = Array.isArray(raw) ? raw : [];

  const teams = list
    .map((entry) => {
      if (typeof entry === 'string') {
        migrated = true;
        return { id: newTruckId(), name: entry.trim(), status: 'available' };
      }
      if (entry && typeof entry === 'object' && typeof entry.name === 'string') {
        const status = entry.status === 'unavailable' ? 'unavailable' : 'available';
        if (!entry.id || status !== entry.status) migrated = true;
        return { id: entry.id || newTruckId(), name: entry.name.trim(), status };
      }
      migrated = true;
      return null;
    })
    .filter((team) => team && team.name);

  return { teams, migrated };
};

/**
 * Validates a truck list submitted by an admin. Returns an error message, or null if valid.
 */
const validateTruckTeams = (teams) => {
  const seen = new Set();
  for (const team of teams) {
    const key = team.name.toLowerCase();
    if (seen.has(key)) return `Duplicate truck team name: "${team.name}"`;
    seen.add(key);
  }
  return null;
};

const saveTruckTeams = async (teams) => {
  await Setting.findOneAndUpdate(
    { key_name: SETTING_KEY },
    { value: JSON.stringify(teams) },
    { upsert: true }
  );
};

/**
 * Loads truck teams from Settings, creating defaults if none exist and
 * persisting the new shape the first time old string-based data is read.
 */
const getTruckTeams = async () => {
  const setting = await Setting.findOne({ key_name: SETTING_KEY });

  if (!setting) {
    const { teams } = normalizeTruckTeams(DEFAULT_TEAM_NAMES);
    await saveTruckTeams(teams);
    return teams;
  }

  let parsed = [];
  try {
    parsed = JSON.parse(setting.value);
  } catch {
    parsed = [];
  }

  const { teams, migrated } = normalizeTruckTeams(parsed);
  if (migrated) await saveTruckTeams(teams);
  return teams;
};

const countAvailableTrucks = (teams) => teams.filter((team) => team.status === 'available').length;

/**
 * Splits a single or paired truck_team string (e.g. "Truck Team 1 & Truck Team 2")
 * into deduplicated individual truck names.
 */
const parseAssignedTrucks = (truckTeamStr) => {
  if (!truckTeamStr || typeof truckTeamStr !== 'string') return [];
  const seen = new Set();
  const result = [];
  for (const part of truckTeamStr.split(/[,&]/)) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(trimmed);
    }
  }
  return result;
};

const toDateKey = (dateVal) => {
  if (!dateVal) return '';
  if (typeof dateVal === 'string') {
    const trimmed = dateVal.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
  }
  const d = new Date(dateVal);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
};

const isWholeDayExecution = (slot, totalTrips) =>
  (Number(totalTrips) || 1) >= 5 || String(slot || '').trim().toLowerCase() === 'whole day';

const executionSlotsOverlap = (slotA, tripsA, slotB, tripsB) => {
  if (isWholeDayExecution(slotA, tripsA) || isWholeDayExecution(slotB, tripsB)) {
    return true;
  }
  if (!slotA || !slotB) return false;
  return String(slotA).trim().toLowerCase() === String(slotB).trim().toLowerCase();
};

/**
 * Computes per-slot truck usage on a target YYYY-MM-DD execution date (excluding excludeOrderId).
 * - Each 5+ trip (Whole Day) order consumes 2 trucks across Morning, Afternoon, and Evening.
 * - Each <5 trip order consumes 1 truck in its specific slot.
 */
const computeDateTruckUsage = async ({ Order, targetDate, excludeOrderId = null, availableTruckCount = 0 }) => {
  const targetKey = toDateKey(targetDate);
  const baseDay = new Date(`${targetKey}T00:00:00.000Z`);
  const minWindow = new Date(baseDay.getTime() - 24 * 60 * 60 * 1000);
  const maxWindow = new Date(baseDay.getTime() + 48 * 60 * 60 * 1000);

  const matchQuery = {
    status: { $nin: ['Cancelled'] },
    service_execution_date: { $gte: minWindow, $lte: maxWindow }
  };
  if (excludeOrderId) {
    matchQuery.order_id = { $ne: excludeOrderId };
  }

  const docs = await Order.find(matchQuery)
    .select('order_id service_execution_date service_execution_time_slot total_trips')
    .lean();

  const seenOrders = new Set();
  let wholeDayOrders = 0;
  const slotExecutions = { Morning: 0, Afternoon: 0, Evening: 0 };

  for (const doc of docs) {
    const groupKey = doc.order_id || String(doc._id);
    if (seenOrders.has(groupKey)) continue;
    if (toDateKey(doc.service_execution_date) !== targetKey) continue;
    seenOrders.add(groupKey);

    if (isWholeDayExecution(doc.service_execution_time_slot, doc.total_trips)) {
      wholeDayOrders += 1;
    } else if (STANDARD_SLOTS.includes(doc.service_execution_time_slot)) {
      slotExecutions[doc.service_execution_time_slot] += 1;
    }
  }

  const wholeDayTrucksUsed = wholeDayOrders > 0 ? availableTruckCount : 0;
  const trucksLeft = {};
  for (const slot of STANDARD_SLOTS) {
    trucksLeft[slot] = wholeDayOrders > 0 ? 0 : Math.max(0, availableTruckCount - slotExecutions[slot]);
  }

  const minTrucksLeft = Math.min(trucksLeft.Morning, trucksLeft.Afternoon, trucksLeft.Evening);
  const maxTrucksLeft = Math.max(trucksLeft.Morning, trucksLeft.Afternoon, trucksLeft.Evening);
  const totalExecutions = wholeDayOrders + slotExecutions.Morning + slotExecutions.Afternoon + slotExecutions.Evening;

  return {
    wholeDayOrders,
    wholeDayTrucksUsed,
    slotExecutions,
    trucksLeft,
    minTrucksLeft,
    maxTrucksLeft,
    hasAnyExecution: totalExecutions > 0,
    isAllTrucksLockedFullDay: wholeDayOrders > 0
  };
};

/**
 * Finds any schedule conflicts for `truckNames` on `execDate` + `execSlot` (excluding `excludeOrderId`).
 */
const findTruckScheduleConflicts = async ({
  Order,
  excludeOrderId = null,
  execDate,
  execSlot,
  totalTrips = 1,
  truckNames = []
}) => {
  const targetKey = toDateKey(execDate);
  if (!targetKey || !Array.isArray(truckNames) || truckNames.length === 0) return [];

  const baseDay = new Date(`${targetKey}T00:00:00.000Z`);
  const minWindow = new Date(baseDay.getTime() - 24 * 60 * 60 * 1000);
  const maxWindow = new Date(baseDay.getTime() + 48 * 60 * 60 * 1000);

  const query = {
    status: { $nin: ['Cancelled'] },
    service_execution_date: { $gte: minWindow, $lte: maxWindow },
    truck_team: { $nin: [null, ''] }
  };
  if (excludeOrderId) {
    query.order_id = { $ne: excludeOrderId };
  }

  const candidates = await Order.find(query)
    .select('order_id service_execution_date service_execution_time_slot total_trips truck_team status')
    .lean();

  const requestedByLower = new Map();
  for (const name of truckNames) {
    requestedByLower.set(name.toLowerCase(), name);
  }

  const seenOrderIds = new Set();
  const conflicts = [];

  for (const other of candidates) {
    const groupKey = other.order_id || String(other._id);
    if (seenOrderIds.has(groupKey)) continue;
    if (toDateKey(other.service_execution_date) !== targetKey) continue;
    seenOrderIds.add(groupKey);

    if (!executionSlotsOverlap(execSlot, totalTrips, other.service_execution_time_slot, other.total_trips)) {
      continue;
    }

    const otherTrucks = parseAssignedTrucks(other.truck_team);
    for (const oTruck of otherTrucks) {
      const matchName = requestedByLower.get(oTruck.toLowerCase());
      if (matchName) {
        conflicts.push({
          truckName: matchName,
          conflictingOrderId: other.order_id || groupKey,
          conflictingSlot: isWholeDayExecution(other.service_execution_time_slot, other.total_trips)
            ? 'Whole Day'
            : (other.service_execution_time_slot || 'Scheduled')
        });
      }
    }
  }

  return conflicts;
};

module.exports = {
  normalizeTruckTeams,
  validateTruckTeams,
  getTruckTeams,
  saveTruckTeams,
  countAvailableTrucks,
  parseAssignedTrucks,
  toDateKey,
  isWholeDayExecution,
  executionSlotsOverlap,
  computeDateTruckUsage,
  findTruckScheduleConflicts
};
