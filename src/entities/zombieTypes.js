// Zombi türleri tablosu. Hepsi yeşil, kafaları dikdörtgen kutu.
export const ZOMBIE_TYPES = {
  small: {
    name: 'Küçük', hp: 30, speed: 5.0, scale: 0.62, damage: 6, attackRate: 0.7,
    skin: '#9ccc65', cloth: '#558b2f', pants: '#33691e', pitch: 1.7,
  },
  normal: {
    name: 'Normal', hp: 60, speed: 2.8, scale: 1, damage: 11, attackRate: 1.0,
    skin: '#6aa84f', cloth: '#38761d', pants: '#274e13', pitch: 1,
  },
  big: {
    name: 'Büyük', hp: 320, speed: 1.9, scale: 1.8, damage: 26, attackRate: 1.5, knockback: 11,
    skin: '#4b7f32', cloth: '#2e5a1c', pants: '#1b3a10', pitch: 0.55,
  },
  gunner: {
    name: 'Silahlı', hp: 60, speed: 2.6, scale: 1, damage: 9, attackRate: 1.0, ranged: true,
    skin: '#7cb342', cloth: '#3d5c1f', pants: '#2a3f14', pitch: 0.9,
  },
  armored: {
    name: 'Zırhlı', hp: 80, armor: 70, helmet: 45, speed: 2.5, scale: 1.05, damage: 12, attackRate: 1.0,
    skin: '#689f38', cloth: '#2e4d14', pants: '#1f3a0d', pitch: 0.8,
  },
  exploder: {
    name: 'Patlayan', hp: 40, speed: 3.2, scale: 1.0, damage: 0, attackRate: 1.0, exploder: true,
    skin: '#aed581', cloth: '#689f38', pants: '#33691e', pitch: 1.3,
  },
};

// Silahlı zombilerin kullandığı silahlar (oyuncuya ateş)
export const GUNNER_WEAPONS = {
  pistol: { damage: 7, interval: [1.3, 2.1], burst: 1, range: 28, accuracy: 0.6 },
  shotgun: { damage: 16, interval: [1.9, 2.7], burst: 1, range: 13, accuracy: 0.75 },
  smg: { damage: 4, interval: [2.0, 2.8], burst: 5, burstGap: 0.1, range: 26, accuracy: 0.4 },
  rocket: { damage: 0, interval: [4, 5.5], burst: 1, range: 38, rocket: true },
};

export const EXPLODER_BLAST = { radius: 5, damage: 95 };
