// Three.js'ten bağımsız, test edilebilir hasar kuralları.

export const PLAYER_ARMOR_ABSORB = 0.6;
export const HEADSHOT_MULT = 2;

// Oyuncu zırhı hasarın bir kısmını emer, kalan can'dan düşer.
export function applyPlayerDamage(health, armor, amount, absorb = PLAYER_ARMOR_ABSORB) {
  const toArmor = Math.min(armor, amount * absorb);
  return {
    health: Math.max(0, health - (amount - toArmor)),
    armor: armor - toArmor,
  };
}

// Merkezde tam hasar, kenarda %25; yarıçap dışında sıfır.
export function explosionDamage(dist, radius, damage) {
  if (dist >= radius) return 0;
  return damage * (1 - 0.75 * (dist / radius));
}

// part: 'head' | 'body' | 'blast' | 'melee'
// Kask kafayı, yelek gövdeyi korur; patlamada yelek hasarın yarısını emer.
export function damageZombie(state, amount, part) {
  let { health, armor, helmet } = state;
  let headshot = false;
  if (part === 'head') {
    if (helmet > 0) {
      const used = Math.min(helmet, amount);
      helmet -= used;
      amount -= used;
    } else {
      amount *= HEADSHOT_MULT;
      headshot = true;
    }
  } else if (armor > 0) {
    const share = part === 'blast' ? amount * 0.5 : amount;
    const used = Math.min(armor, share);
    armor -= used;
    amount -= used;
  }
  health = Math.max(0, health - amount);
  return { health, armor, helmet, headshot };
}
