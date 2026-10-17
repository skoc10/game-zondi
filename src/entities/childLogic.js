// Çocuğun takip mantığı ve 2. bölüm görev durumları (Three.js'siz, test edilir).

export const CHILD_FOLLOW_DIST = 2.5;
export const CHILD_WALK = 4.5;
export const CHILD_RUN = 6.5;
export const CHILD_BOARD_DIST = 8;

// Oyuncuya olan mesafeye göre hız: yakınsa durur, uzaklaştıkça hızlanır; panikte koşar
export function followSpeed(dist, panic = false) {
  if (dist <= CHILD_FOLLOW_DIST) return 0;
  if (panic) return CHILD_RUN;
  const s = (dist - CHILD_FOLLOW_DIST + 0.5) * 2;
  return Math.min(dist > 8 ? CHILD_RUN : CHILD_WALK, s);
}

// Görüş yoksa oyuncunun bıraktığı izlerden görülebilen en yenisine gider
export function pickBreadcrumb(trail, canSee) {
  for (let i = trail.length - 1; i >= 0; i--) {
    if (canSee(trail[i])) return trail[i];
  }
  return null;
}

// Hangi araçlara binebilir; koltuk yoksa neden
export function boardingRule(vehicleType) {
  if (vehicleType === 'plane') return { ok: false, reason: 'Deniz uçağa sığmıyor' };
  return { ok: true };
}

export function inSafeZone(x, z, zone) {
  return x > zone.minX && x < zone.maxX && z > zone.minZ && z < zone.maxZ;
}

// Görevin aşaması (HUD ve telsiz için)
export function rescueStage({ barricadeBroken, childState, childAlive, childSafe }) {
  if (!childAlive) return 'failed';
  if (childSafe) return 'done';
  if (childState === 'hiding') return barricadeBroken ? 'reach' : 'school';
  return 'escort';
}
