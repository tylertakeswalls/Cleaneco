const crypto = require('crypto');
const Setting = require('../models/Setting');

const SETTING_KEY = 'truck_teams';
const DEFAULT_TEAM_NAMES = ['Truck Team 1', 'Truck Team 2'];

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

module.exports = {
  normalizeTruckTeams,
  validateTruckTeams,
  getTruckTeams,
  saveTruckTeams,
  countAvailableTrucks
};
