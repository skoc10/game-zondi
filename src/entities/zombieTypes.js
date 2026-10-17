import { HIT } from '../core/combat.js';

// Zombi türleri tablosu. Hepsi yeşil, kafaları dikdörtgen kutu.
// bodyHits/headHits: tabanca/levye ile kaç vuruşta öldüğü. Can = bodyHits × HIT.
// Kask ve yelek ayrıca birer vuruş yutar.
export const ZOMBIE_TYPES = {
  small: {
    name: 'Küçük', bodyHits: 1, headHits: 1, speed: 5.0, scale: 0.62, damage: 6, attackRate: 0.7,
    skin: '#9ccc65', cloth: '#558b2f', pants: '#33691e', pitch: 1.7,
  },
  normal: {
    name: 'Normal', bodyHits: 2, headHits: 1, speed: 2.8, scale: 1, damage: 11, attackRate: 1.0,
    skin: '#6aa84f', cloth: '#38761d', pants: '#274e13', pitch: 1,
  },
  big: {
    name: 'Büyük', bodyHits: 3, headHits: 2, speed: 1.9, scale: 1.8, damage: 26, attackRate: 1.5, knockback: 11,
    skin: '#4b7f32', cloth: '#2e5a1c', pants: '#1b3a10', pitch: 0.55,
  },
  gunner: {
    name: 'Silahlı', bodyHits: 2, headHits: 1, speed: 2.6, scale: 1, damage: 9, attackRate: 1.0, ranged: true,
    skin: '#7cb342', cloth: '#3d5c1f', pants: '#2a3f14', pitch: 0.9,
  },
  armored: {
    name: 'Zırhlı', bodyHits: 2, headHits: 1, armor: HIT, helmet: HIT, speed: 2.5, scale: 1.05, damage: 12, attackRate: 1.0,
    skin: '#689f38', cloth: '#2e4d14', pants: '#1f3a0d', pitch: 0.8,
  },
  soldier: {
    name: 'Asker', bodyHits: 2, headHits: 1, armor: HIT, helmet: HIT, speed: 2.7, scale: 1.05, damage: 12, attackRate: 1.0, ranged: true,
    skin: '#7cb342', cloth: '#5b6b3a', pants: '#4a5530', pitch: 0.85, gear: '#3f4a22',
  },
  // 3. bölüm: çılgın bilim insanları (yeşil değil; zombiler onlara saldırmaz)
  scientist: {
    name: 'Bilim insanı', bodyHits: 2, headHits: 1, speed: 3.0, scale: 1, damage: 8, attackRate: 1.0, ranged: true, human: true,
    skin: '#f1c27d', cloth: '#eceff1', pants: '#37474f', pitch: 1, gear: '#263238',
  },
  chemist: {
    name: 'Kimyager', bodyHits: 2, headHits: 1, speed: 2.8, scale: 1, damage: 8, attackRate: 1.0, ranged: true, human: true,
    skin: '#e0ac69', cloth: '#c5e1a5', pants: '#37474f', pitch: 1, gear: '#263238',
  },
  drKaos: {
    name: 'Dr. Kaos', bodyHits: 12, headHits: 6, speed: 2.4, scale: 1.2, damage: 15, attackRate: 1.0, ranged: true, human: true, boss: true,
    skin: '#f1c27d', cloth: '#fafafa', pants: '#4a148c', pitch: 0.8, gear: '#6a1b9a',
  },
  // 4. bölüm: uzay istasyonunu ele geçiren uzaylılar (mor/camgöbeği, yeşil değil)
  alien: {
    name: 'Uzaylı', bodyHits: 2, headHits: 1, speed: 3.4, scale: 1.05, damage: 10, attackRate: 0.9, ranged: true, alien: true,
    skin: '#7e57c2', cloth: '#311b92', pants: '#1a237e', pitch: 2.2, gear: '#00e5ff',
  },
  alienDrone: {
    name: 'Uzaylı drone', bodyHits: 1, headHits: 1, speed: 5.5, scale: 0.75, damage: 0, attackRate: 1.0, exploder: true, alien: true, flying: true, blast: { radius: 4, damage: 38 },
    skin: '#26c6da', cloth: '#006064', pants: '#004d40', pitch: 2.6, gear: '#ff4081',
  },
  alienQueen: {
    name: 'Uzaylı Kraliçe', bodyHits: 20, headHits: 8, speed: 2.1, scale: 2.3, damage: 30, attackRate: 1.3, ranged: true, alien: true, boss: true, knockback: 12,
    skin: '#ab47bc', cloth: '#4a148c', pants: '#311b92', pitch: 0.7, gear: '#ff4081',
  },
  exploder: {
    name: 'Patlayan', bodyHits: 2, headHits: 1, speed: 3.2, scale: 1.0, damage: 0, attackRate: 1.0, exploder: true,
    skin: '#aed581', cloth: '#689f38', pants: '#33691e', pitch: 1.3,
  },
};

for (const t of Object.values(ZOMBIE_TYPES)) {
  t.hp = t.bodyHits * HIT;
  t.headMult = t.bodyHits / t.headHits;
}

// Silahlı zombilerin kullandığı silahlar (oyuncuya ateş)
export const GUNNER_WEAPONS = {
  pistol: { damage: 7, interval: [1.3, 2.1], burst: 1, range: 28, accuracy: 0.6 },
  shotgun: { damage: 16, interval: [1.9, 2.7], burst: 1, range: 13, accuracy: 0.75 },
  smg: { damage: 4, interval: [2.0, 2.8], burst: 5, burstGap: 0.1, range: 26, accuracy: 0.4 },
  rocket: { damage: 0, interval: [4, 5.5], burst: 1, range: 38, rocket: true },
  laser: { damage: 8, interval: [0.9, 1.6], burst: 2, burstGap: 0.15, range: 34, accuracy: 0.55, laser: true },
  flask: { damage: 0, interval: [2.6, 3.8], burst: 1, range: 20, flask: true },
  alienLaser: { damage: 7, interval: [1.1, 1.8], burst: 2, burstGap: 0.14, range: 36, accuracy: 0.5, laser: true, color: '#e040fb' },
  queenLaser: { damage: 12, interval: [1.4, 2.0], burst: 5, burstGap: 0.1, range: 45, accuracy: 0.6, laser: true, color: '#ff4081' },
  bossLaser: { damage: 10, interval: [1.2, 1.8], burst: 4, burstGap: 0.12, range: 40, accuracy: 0.6, laser: true },
};

export const EXPLODER_BLAST = { radius: 5, damage: 95 };
