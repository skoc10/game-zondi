// Bölüm ilerlemesi (bir sonraki bölüm ve taşınan eşyalar). Depolama yoksa sessizce çalışmaz.
const KEY = 'zondi-ilerleme';

export const LAST_LEVEL = 4;

// GEÇİCİ: test için tüm bölümler "BÖLÜM SEÇ" menüsünden doğrudan başlatılabilir.
// Testler bitince false yapılacak; bölümler sırayla açılır.
export const LEVEL_SELECT_UNLOCKED = true;

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
