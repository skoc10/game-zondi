// Gamepad API "standard" düzeni (Xbox / PlayStation / genel kollar).
export const BTN = {
  A: 0, B: 1, X: 2, Y: 3,
  LB: 4, RB: 5, LT: 6, RT: 7,
  BACK: 8, START: 9, L3: 10, R3: 11,
  UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15,
};

export const STICK_DEADZONE = 0.18;
export const TRIGGER_THRESHOLD = 0.35;

// Dairesel ölü bölge; kalan aralığı 0..1'e yeniden ölçekler.
export function radialDeadzone(x, y, dz = STICK_DEADZONE) {
  const m = Math.hypot(x, y);
  if (m < dz) return [0, 0];
  const n = Math.min(1, (m - dz) / (1 - dz));
  return [(x / m) * n, (y / m) * n];
}

// Küçük çubuk hareketlerinde hassas nişan için üssel eğri.
export function lookCurve(v, exp = 1.8) {
  return Math.sign(v) * Math.pow(Math.abs(v), exp);
}

function pressed(b) {
  if (!b) return false;
  return typeof b === 'object' ? b.pressed || b.value > 0.5 : b > 0.5;
}

function value(b) {
  if (!b) return 0;
  return typeof b === 'object' ? b.value : b;
}

// Ham Gamepad nesnesini sade bir duruma çevirir.
export function readPad(gp) {
  const axes = gp.axes || [];
  const [lx, ly] = radialDeadzone(axes[0] || 0, axes[1] || 0);
  const [rx, ry] = radialDeadzone(axes[2] || 0, axes[3] || 0);
  const buttons = [];
  for (let i = 0; i < 17; i++) buttons.push(pressed(gp.buttons[i]));
  const lt = value(gp.buttons[BTN.LT]);
  const rt = value(gp.buttons[BTN.RT]);
  buttons[BTN.LT] = lt > TRIGGER_THRESHOLD;
  buttons[BTN.RT] = rt > TRIGGER_THRESHOLD;
  const active = lx !== 0 || ly !== 0 || rx !== 0 || ry !== 0 || buttons.some(Boolean);
  return { lx, ly, rx, ry, lt, rt, buttons, active };
}

export function getActivePad() {
  if (typeof navigator === 'undefined' || !navigator.getGamepads) return null;
  const pads = navigator.getGamepads();
  for (const p of pads) if (p && p.connected) return p;
  return null;
}

export function isPlayStation(gp) {
  return !!gp && /054c|playstation|dualsense|dualshock/i.test(gp.id);
}

export function rumble(gp, strong, weak, ms) {
  const act = gp && gp.vibrationActuator;
  if (!act || !act.playEffect) return;
  act.playEffect('dual-rumble', {
    startDelay: 0,
    duration: ms,
    strongMagnitude: Math.min(1, strong),
    weakMagnitude: Math.min(1, weak),
  }).catch(() => {});
}

// HUD'daki tuş ipuçları
const GLYPHS = {
  xbox: { interact: 'X', fire: 'RT', reload: 'B', jump: 'A', flashlight: 'Y', detonate: '▲ D-pad', pause: 'Start' },
  ps: { interact: '□', fire: 'R2', reload: '○', jump: '✕', flashlight: '△', detonate: '▲ D-pad', pause: 'Options' },
  kbm: { interact: 'E', fire: 'Sol Tık', reload: 'R', jump: 'Space', flashlight: 'F', detonate: 'G', pause: 'Esc' },
};

export function glyph(action, device, ps = false) {
  const set = device === 'pad' ? (ps ? GLYPHS.ps : GLYPHS.xbox) : GLYPHS.kbm;
  return set[action] || action;
}
