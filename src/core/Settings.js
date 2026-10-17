const KEY = 'zondi-ayarlar';
const OLD_KEY = 'benzin-bitmeden-ayarlar';

const DEFAULTS = {
  mouseSens: 1,
  padSens: 1,
  invertY: false,
  vibration: true,
  aimAssist: true,
  aimToggle: false,
  volume: 0.8,
  music: 0.5,
};

function load() {
  try {
    const raw = localStorage.getItem(KEY) || localStorage.getItem(OLD_KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    // Gizli pencere vb. — varsayılanlarla devam
  }
  return { ...DEFAULTS };
}

export const settings = load();

export function saveSettings() {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Kaydedilemezse oyun yine çalışır
  }
}
