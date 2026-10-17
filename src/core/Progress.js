// Bölüm ilerlemesi (bir sonraki bölüm ve taşınan eşyalar). Depolama yoksa sessizce çalışmaz.
const KEY = 'zondi-ilerleme';

export const LAST_LEVEL = 4;

const UNLOCK_KEY = 'zondi-acik';

export function loadProgress(storage = globalThis.localStorage) {
  try {
    const raw = storage && storage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object' || !Number.isInteger(data.level)) return null;
    if (data.level < 2 || data.level > LAST_LEVEL) return null;
    return data;
  } catch {
    return null;
  }
}

export function saveProgress(data, storage = globalThis.localStorage) {
  try {
    if (storage) storage.setItem(KEY, JSON.stringify(data));
  } catch {
    // Kaydedilemezse oyun yine çalışır
  }
}

// Bölüm kilitleri: bölüm bitirildikçe sıradaki açılır; 1. bölüm hep açık.
// space: 4. bölümde fırlatmadan sonraki uzay istasyonu
export function loadUnlocked(storage = globalThis.localStorage) {
  let level = 1;
  let space = false;
  try {
    const raw = storage && storage.getItem(UNLOCK_KEY);
    const d = raw ? JSON.parse(raw) : null;
    if (d && Number.isInteger(d.level)) level = Math.max(1, Math.min(LAST_LEVEL, d.level));
    if (d && d.space === true) space = true;
  } catch {
    // bozuk kayıt: sadece 1. bölüm
  }
  // Eski oyuncular: kayıtlı ilerlemedeki bölüm de açık sayılır
  const prog = loadProgress(storage);
  if (prog) {
    level = Math.max(level, prog.level);
    if (prog.level === LAST_LEVEL && prog.sub === 'space') space = true;
  }
  return { level, space: space && level >= LAST_LEVEL };
}

export function unlockLevel(level, space = false, storage = globalThis.localStorage) {
  const cur = loadUnlocked(storage);
  const next = { level: Math.max(cur.level, Math.min(LAST_LEVEL, level)), space: cur.space || space };
  try {
    if (storage) storage.setItem(UNLOCK_KEY, JSON.stringify(next));
  } catch {
    // kaydedilemezse oyun yine çalışır
  }
  return next;
}

export function isUnlocked(level, sub = null, storage = globalThis.localStorage) {
  const u = loadUnlocked(storage);
  if (sub === 'space') return u.space;
  return level <= u.level;
}
