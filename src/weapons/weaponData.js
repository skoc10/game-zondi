// Silah ve eşya tablosu: yeni silah eklemek = yeni satır.
export const WEAPONS = {
  crowbar: { name: 'Levye', kind: 'melee', damage: 35, interval: 0.5, range: 2.5 },
  pistol: {
    name: 'Tabanca', kind: 'hitscan', damage: 26, pellets: 1, interval: 0.2, auto: false,
    mag: 12, maxReserve: 96, spread: 0.012, reload: 1.1, recoil: 0.03, range: 120, sound: 'pistol',
  },
  shotgun: {
    name: 'Pompalı', kind: 'hitscan', damage: 14, pellets: 9, interval: 0.85, auto: false,
    mag: 6, maxReserve: 36, spread: 0.075, reload: 1.9, recoil: 0.09, range: 40, falloff: 14, sound: 'shotgun',
  },
  smg: {
    name: 'Makineli', kind: 'hitscan', damage: 17, pellets: 1, interval: 0.085, auto: true,
    mag: 30, maxReserve: 180, spread: 0.03, reload: 1.6, recoil: 0.018, range: 100, sound: 'smg',
  },
  rocket: {
    name: 'Roketatar', kind: 'rocket', damage: 190, radius: 6.5, interval: 1.0, auto: false,
    mag: 1, maxReserve: 8, reload: 1.7, recoil: 0.12, speed: 34, sound: 'rocket',
  },
  throwable: { name: 'Fırlatılabilir', kind: 'throw' },
  tnt: { name: 'TNT', kind: 'place', fuse: 3, radius: 8.5, damage: 270, max: 5 },
  c4: { name: 'C4', kind: 'c4', radius: 7, damage: 240, max: 5 },
};

export const GUNS = ['pistol', 'shotgun', 'smg', 'rocket'];

// Eşya çubuğu sırası (1–8 tuşları)
export const SLOTS = ['crowbar', 'pistol', 'shotgun', 'smg', 'rocket', 'throwable', 'tnt', 'c4'];

export const THROWABLES = {
  grenade: { name: 'Bomba', fuse: 2.2, radius: 6, damage: 170, max: 6, impact: false },
  head: { name: 'Zombi Kafası', fuse: 0, radius: 5.5, damage: 180, max: 4, impact: true },
};

export const ITEM_MAX = { grenade: 6, head: 4, tnt: 5, c4: 5 };

// Zombiden düşen silahın içindeki mermi [min, max]
export const DROP_AMMO = { pistol: [8, 16], shotgun: [4, 9], smg: [18, 36], rocket: [1, 3] };

// Mermi kutusundan gelen miktar
export const BOX_AMMO = { pistol: 16, shotgun: 8, smg: 40, rocket: 2 };
