const KEY = 'zondi-ayarlar';
const OLD_KEY = 'benzin-bitmeden-ayarlar';

const DEFAULTS = {
  mouseSens: 1,
  padSens: 1,
  invertY: false,
  vibration: true,
  aimAssist: true,
  aimToggle: false,
  aimKey: 'mouse2',
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

// Nişan için seçilebilen tuşlar
export const AIM_KEYS = [
  ['mouse2', 'Sağ tık'],
  ['KeyZ', 'Z'],
  ['KeyV', 'V'],
  ['KeyX', 'X'],
  ['AltLeft', 'Sol Alt / Option'],
  ['mouse3', 'Fare yan tuşu'],
];

export function aimKeyLabel() {
  const k = AIM_KEYS.find(([v]) => v === settings.aimKey);
  return k ? k[1] : 'Sağ tık';
}

export function saveSettings() {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Kaydedilemezse oyun yine çalışır
  }
}
