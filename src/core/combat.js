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

// Bir "vuruş": tabanca mermisi, levye darbesi, makineli mermisi. Zombi canları bunun katı.
export const HIT = 30;

// Oyuncu %20 daha dayanıklı: gelen hasar 1.2'ye bölünür
export const PLAYER_TOUGHNESS = 1.2;

// part: 'head' | 'body' | 'blast'
// Kask ilk kafa vuruşunu, yelek ilk gövde vuruşunu tamamen yutar (+1 vuruş).
// Patlamada yelek hasarın yarısını emer. headMult türe göre (gövde vuruşu / kafa vuruşu).
export function damageZombie(state, amount, part, headMult = HEADSHOT_MULT) {
  let { health, armor, helmet } = state;
  let headshot = false;
  if (part === 'head') {
    if (helmet > 0) {
      helmet = Math.max(0, helmet - amount);
      amount = 0;
    } else {
      amount *= headMult;
      headshot = true;
    }
  } else if (armor > 0) {
    if (part === 'blast') {
      const used = Math.min(armor, amount * 0.5);
      armor -= used;
      amount -= used;
    } else {
      armor = Math.max(0, armor - amount);
      amount = 0;
    }
  }
  health = Math.max(0, health - amount);
  return { health, armor, helmet, headshot };
}

// Duvar arkasındaki hedef patlamadan çok az etkilenir.
export const COVER_MULT = 0.2;

export function coveredExplosionDamage(dist, radius, damage, occluded) {
  return explosionDamage(dist, radius, damage) * (occluded ? COVER_MULT : 1);
}
