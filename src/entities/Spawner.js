import { pickWeighted, rand, chance } from '../core/math.js';
import { MAP_HALF, CAR_POS } from '../world/World.js';
import { BASE, VILLAGE, BARRICADE_Z } from '../world/regions.js';

// Zombi doğurucu: zamanla zorlaşır, gece iki kat hızlı.
export class Spawner {
  constructor(zombies, collision) {
    this.zombies = zombies;
    this.collision = collision;
    this.reset();
  }

  reset() {
    this.timer = 4;
    this.elapsed = 0;
    this.firstGunner = false;
  }

  typeWeights(night, nearBase = false) {
    const e = this.elapsed;
    const w = [['normal', 10], ['small', e > 20 ? 4 : 1]];
    // Askeri üs çevresinde asker ve zırhlı zombiler çoğalır
    if (nearBase) w.push(['soldier', 7], ['armored', 3]);
    if (e > 25) w.push(['gunner', 3]);
    if (e > 50) w.push(['exploder', 2.5]);
    if (e > 80) w.push(['armored', 2 + night * 2]);
    if (e > 100) w.push(['big', 1 + night * 2.5]);
    return w;
  }

  soldierWeapon() {
    return pickWeighted([['smg', 55], ['shotgun', 30], ['rocket', this.elapsed > 90 ? 15 : 3]]);
  }

  gunnerWeapon() {
    const e = this.elapsed;
    const w = [['pistol', 55], ['shotgun', e > 60 ? 25 : 5], ['smg', e > 90 ? 18 : 0]];
    if (e > 150) w.push(['rocket', 6]);
    return pickWeighted(w);
  }

  // Oyuncunun 35–140 m çevresinde alana eşit dağılmış bir nokta; her bölgeye sınırlı zombi
  findSpot(player, night, minD = 35, maxD = 140) {
    const cellCap = night > 0.5 ? 2 : 1;
    for (let i = 0; i < 30; i++) {
      const a = rand(0, Math.PI * 2);
      const d = Math.sqrt(rand(minD * minD, maxD * maxD));
      const x = player.pos.x - Math.sin(a) * d;
      const z = player.pos.z - Math.cos(a) * d;
      if (Math.abs(x) > MAP_HALF - 2 || Math.abs(z) > MAP_HALF - 2) continue;
      if (Math.hypot(x - CAR_POS.x, z - CAR_POS.z) < 25) continue;
      // Yakındaysa oyuncunun görüş alanında doğmasın
      if (d < 60) {
        const fx = -Math.sin(player.yaw);
        const fz = -Math.cos(player.yaw);
        if (((x - player.pos.x) * fx + (z - player.pos.z) * fz) / d > 0.3) continue;
      }
      if (this.collision.blockedAt(x, z, 0.8, 2)) continue;
      if (this.zombies.countNear(x, z, 30) >= cellCap) continue;
      return { x, z, d };
    }
    return null;
  }

  spawnOne(player, night, typeKey = null) {
    // Oyuncunun yanı kalabalıksa sadece uzağa doğur
    const crowded = this.zombies.countNear(player.pos.x, player.pos.z, 40) >= (night > 0.5 ? 10 : 6);
    const spot = this.findSpot(player, night, crowded ? 70 : 35);
    if (!spot) return null;
    const nearBase = Math.hypot(player.pos.x - BASE.x, player.pos.z - BASE.z) < BASE.half + 60;
    const type = typeKey || pickWeighted(this.typeWeights(night, nearBase));
    // Çoğu zombi kendi bölgesinde dolaşır; gece bir kısmı avlanır
    const wantAlert = spot.d < 70 && (night > 0.5 ? chance(0.4) : chance(0.05));
    const opts = { alerted: wantAlert && this.zombies.canChase(), spawned: true };
    if (type === 'gunner') opts.weapon = this.gunnerWeapon();
    if (type === 'soldier') opts.weapon = this.soldierWeapon();
    // Küçükler ikili gelir
    if (type === 'small' && chance(0.5)) this.zombies.spawn('small', spot.x + rand(-2, 2), spot.z + rand(-2, 2), opts);
    return this.zombies.spawn(type, spot.x, spot.z, opts);
  }

  // Başlangıçta haritaya serpiştirilmiş zombiler
  populate() {
    const z = this.zombies;
    // Erken silah bulmak için yakında tabancalı bir zombi
    z.spawn('gunner', 9, -24, { weapon: 'pistol' });
    z.spawn('normal', -12, 10);
    z.spawn('normal', 13, -14);
    z.spawn('small', -8, -30);
    const spots = [
      [24, -48, 'normal'], [30, -36, 'gunner'], [-50, 40, 'normal'], [-58, 35, 'normal'],
      [-60, -66, 'normal'], [-38, -22, 'small'], [48, 26, 'normal'], [68, -18, 'gunner'],
      [-22, 70, 'normal'], [5, -80, 'normal'], [-80, 10, 'normal'], [80, 60, 'normal'],
      [40, -90, 'exploder'], [-70, -40, 'normal'], [20, 80, 'normal'],
    ];
    // Köy, barikat ve askeri üs
    const bx = BASE.x;
    const bz = BASE.z;
    spots.push(
      [VILLAGE.x + 20, VILLAGE.z, 'normal'], [VILLAGE.x - 5, VILLAGE.z + 6, 'normal'], [VILLAGE.x - 25, VILLAGE.z - 4, 'gunner'],
      [VILLAGE.x + 8, VILLAGE.z - 10, 'small'], [VILLAGE.x - 30, VILLAGE.z + 10, 'exploder'], [VILLAGE.x - 15, VILLAGE.z - 30, 'normal'],
      [4, BARRICADE_Z - 6, 'normal'], [-6, BARRICADE_Z + 10, 'soldier'], [10, BARRICADE_Z + 12, 'normal'],
      [bx - 30, bz, 'soldier'], [bx, bz - 20, 'soldier'], [bx + 20, bz + 10, 'soldier'], [bx + 10, bz + 30, 'armored'],
      [bx - 20, bz + 30, 'normal'], [bx + 5, bz + 5, 'big'],
      [120, -80, 'normal'], [170, -80, 'normal'], [-60, 150, 'normal'], [-120, -120, 'normal'], [150, 88, 'normal'],
    );
    for (const [x, zz, type] of spots) {
      const opts = {};
      if (type === 'gunner') opts.weapon = chance(0.6) ? 'pistol' : 'shotgun';
      if (type === 'soldier') opts.weapon = chance(0.6) ? 'smg' : 'shotgun';
      z.spawn(type, x, zz, opts);
    }
  }

  update(dt, player, night) {
    this.elapsed += dt;
    this.timer -= dt;
    this.zombies.chaseCap = night > 0.5 ? 12 : 8;
    // Uzakta kalmış, doğurucunun getirdiği zombileri temizle
    this.cleanupTimer = (this.cleanupTimer || 0) - dt;
    if (this.cleanupTimer <= 0) {
      this.cleanupTimer = 2;
      this.zombies.despawnFar(player.pos, 170);
    }
    if (this.timer > 0 || !player.alive || this.disabled) return;
    const difficulty = Math.min(1, this.elapsed / 600);
    // Sınır oyuncunun 150 m çevresini sayar; zombiler bu alana yayılır
    const maxActive = Math.min(34, Math.round((14 + difficulty * 8) * (1 + night * 0.5)));
    const interval = (night > 0.5 ? 1.0 : 1.8) * (1 - difficulty * 0.3);
    this.timer = interval * rand(0.7, 1.3);
    if (this.zombies.countNear(player.pos.x, player.pos.z, 150) >= maxActive) return;
    // İlk silahlı zombiyi garanti et
    if (!this.firstGunner && this.elapsed > 30) {
      this.firstGunner = true;
      this.spawnOne(player, night, 'gunner');
      return;
    }
    this.spawnOne(player, night);
  }
}
