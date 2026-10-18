// Hayatta kalma modunun saf kuralları (test edilir)
export const SURVIVAL_LEVEL = 5;
export const DAY_LENGTH = 360; // DayNight.CYCLE ile aynı

export const START_HUNGER = 70;
export const START_THIRST = 60;
// 100'den 0'a: açlık ~7 dk, susuzluk ~4.5 dk
export const HUNGER_RATE = 100 / 420;
export const THIRST_RATE = 100 / 270;
export const SPRINT_DRAIN = 1.6;
export const STARVE_DPS = 1;
export const DEHYDRATE_DPS = 1.5;
export const LOW = 25;

export const COOKED_FOOD = 45;
export const COOKED_HEAL = 5;
export const RAW_FOOD = 15;
export const RAW_HARM = 8;
export const SIP = 30;
export const CANTEEN_MAX = 3;
export const COOK_TIME = 2;
export const DRINK_TIME = 1.5;

const clamp100 = (v) => Math.max(0, Math.min(100, v));

// Bir karede açlık/susuzluk düşer; sıfırdaysa can kaybı döner
export function tickNeeds(needs, dt, sprinting = false) {
  const k = sprinting ? SPRINT_DRAIN : 1;
  const hunger = clamp100(needs.hunger - HUNGER_RATE * k * dt);
  const thirst = clamp100(needs.thirst - THIRST_RATE * k * dt);
  let damage = 0;
  let cause = null;
  if (thirst <= 0) {
    damage += DEHYDRATE_DPS * dt;
    cause = 'thirst';
  }
  if (hunger <= 0) {
    damage += STARVE_DPS * dt;
    cause = cause || 'hunger';
  }
  return { hunger, thirst, damage, cause };
}

// Yemek: önce pişmiş et; yalnız çiğ varsa çiğ
export function eat(state) {
  if (state.cooked > 0) {
    return { ...state, cooked: state.cooked - 1, hunger: clamp100(state.hunger + COOKED_FOOD), heal: COOKED_HEAL, ate: 'cooked' };
  }
  if (state.raw > 0) {
    return { ...state, raw: state.raw - 1, hunger: clamp100(state.hunger + RAW_FOOD), heal: -RAW_HARM, ate: 'raw' };
  }
  return { ...state, heal: 0, ate: null };
}

export function sip(state) {
  if (state.canteen <= 0) return { ...state, drank: false };
  return { ...state, canteen: state.canteen - 1, thirst: clamp100(state.thirst + SIP), drank: true };
}

// Geçen süreden gün ve saat (oyun saati: bir gün 24 saat)
export function survivalTime(seconds) {
  const s = Math.max(0, seconds);
  const days = Math.floor(s / DAY_LENGTH);
  const hours = Math.floor(((s % DAY_LENGTH) / DAY_LENGTH) * 24);
  return { days, hours, day: days + 1 };
}

export function formatSurvival(seconds) {
  const { days, hours } = survivalTime(seconds);
  if (days === 0) return hours === 0 ? '1 saatten az' : `${hours} saat`;
  return `${days} gün ${hours} saat`;
}

// Geyik ürkme mesafesi
export function spookRange({ sprinting = false, night = 0, crouch = false } = {}) {
  let r = sprinting ? 35 : 22;
  if (crouch) r *= 0.6;
  return r * (1 - night * 0.35);
}

export const GUNSHOT_SPOOK = 60;

// Rekor: daha uzun süre hayatta kalınca güncellenir
const RECORD_KEY = 'zondi-rekor';

export function loadRecord(storage = globalThis.localStorage) {
  try {
    const raw = storage && storage.getItem(RECORD_KEY);
    const d = raw ? JSON.parse(raw) : null;
    if (!d || !Number.isFinite(d.seconds) || d.seconds < 0) return null;
    return d;
  } catch {
    return null;
  }
}

export function updateRecord(seconds, extra = {}, storage = globalThis.localStorage) {
  const cur = loadRecord(storage);
  if (cur && cur.seconds >= seconds) return { record: cur, isNew: false };
  const record = { seconds, ...extra };
  try {
    if (storage) storage.setItem(RECORD_KEY, JSON.stringify(record));
  } catch {
    // kaydedilemezse yine çalışır
  }
  return { record, isNew: true };
}
