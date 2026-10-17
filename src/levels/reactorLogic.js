// 3. bölümün saf kuralları (test edilir)
export const BOMB_TIME = 90;
export const SAFE_DIST = 140;
export const PLANT_TIME = 3;

// Patlama anında oyuncu kurtuldu mu
export function survivesNuke(distToCore) {
  return distToCore >= SAFE_DIST;
}

// Boss çağırma eşikleri: canın %50 ve %25'inin altına inince birer kez
export function summonWaves(prevFrac, frac) {
  let n = 0;
  for (const t of [0.5, 0.25]) if (prevFrac > t && frac <= t) n++;
  return n;
}

export function reactorStage({ bossAlive, planted, nuked }) {
  if (nuked) return 'done';
  if (planted) return 'escape';
  if (bossAlive) return 'boss';
  return 'plant';
}
