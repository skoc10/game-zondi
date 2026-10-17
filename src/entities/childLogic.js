// Çocuğun takip mantığı ve 2. bölüm görev durumları (Three.js'siz, test edilir).

export const CHILD_FOLLOW_DIST = 2.5;
export const CHILD_WALK = 4.5;
export const CHILD_RUN = 6.5;
export const CHILD_BOARD_DIST = 8;

// Oyuncuya olan mesafeye göre hız: yakınsa durur, uzaklaştıkça hızlanır; panikte koşar
// followDist: sıradaki çocuk biraz daha geride durur
export function followSpeed(dist, panic = false, followDist = CHILD_FOLLOW_DIST) {
  if (dist <= followDist) return 0;
  if (panic) return CHILD_RUN;
  const s = (dist - followDist + 0.5) * 2;
  return Math.min(dist > 8 ? CHILD_RUN : CHILD_WALK, s);
}

// Görüş yoksa oyuncunun bıraktığı izlerden görülebilen en yenisine gider
export function pickBreadcrumb(trail, canSee) {
  for (let i = trail.length - 1; i >= 0; i--) {
    if (canSee(trail[i])) return trail[i];
  }
  return null;
}

// Sıradaki çocuğun takip mesafesi
export function followDistance(order) {
  return CHILD_FOLLOW_DIST + 1.2 * Math.max(0, order);
}

// Araca binebilir mi: koltuk sayısı ve içerideki çocuklar
export function boardingRule(seats, occupied) {
  if (!seats) return { ok: false, reason: 'Bu araçta yolcu yeri yok' };
  if (occupied >= seats) return { ok: false, reason: 'Araçta yer kalmadı' };
  return { ok: true };
}

export function inSafeZone(x, z, zone) {
  return x > zone.minX && x < zone.maxX && z > zone.minZ && z < zone.maxZ;
}

// Çocuk listesinin özeti: [{ state, alive }]
export function rescueStatus(children) {
  const dead = children.find((c) => !c.alive);
  const safe = children.filter((c) => c.state === 'safe').length;
  const withYou = children.filter((c) => c.state === 'following' || c.state === 'inVehicle').length;
  return {
    failed: !!dead,
    safe,
    withYou,
    hiding: children.filter((c) => c.state === 'hiding').length,
    done: !dead && safe === children.length,
  };
}
