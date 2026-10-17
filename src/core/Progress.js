// Bölüm ilerlemesi (bir sonraki bölüm ve taşınan eşyalar). Depolama yoksa sessizce çalışmaz.
const KEY = 'zondi-ilerleme';

export function loadProgress(storage = globalThis.localStorage) {
  try {
    const raw = storage && storage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object' || data.level !== 2) return null;
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
