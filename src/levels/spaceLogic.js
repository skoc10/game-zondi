// 4. bölümün saf kuralları (test edilir)
export const DEFEND_TIME = 60;
export const CONSOLE_HP = 300;
export const SPACE_GRAVITY = 7;
export const SPACE_THROW_GRAVITY = 7;
export const LAUNCH_TIME = 7;

export function launchStage({ started, defendLeft, boarded }) {
  if (boarded) return 'launch';
  if (!started) return 'reach';
  if (defendLeft > 0) return 'defend';
  return 'board';
}

// Savunma dalgaları: sayım ilerledikçe sıklaşır ve büyür
export function defenseWave(defendLeft) {
  const p = 1 - Math.max(0, defendLeft) / DEFEND_TIME;
  return { interval: 4 - p * 1.8, count: 2 + Math.round(p * 3) };
}

// Kraliçe aşamaları: %66 ve %33 eşikleri
export const QUEEN_THRESHOLDS = [2 / 3, 1 / 3];
export const PHASE_CRYSTALS = { 1: 2, 2: 3, 3: 0 };

export function queenPhase(frac) {
  if (frac > QUEEN_THRESHOLDS[0]) return 1;
  if (frac > QUEEN_THRESHOLDS[1]) return 2;
  return 3;
}

// Zıplama yüksekliği v²/2g
export function jumpHeight(jump, gravity) {
  return (jump * jump) / (2 * gravity);
}

export function roomCleared(enemies) {
  return enemies.length > 0 && enemies.every((z) => !z.alive);
}
