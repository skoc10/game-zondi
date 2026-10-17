import { pickWeighted, rand, chance } from '../core/math.js';
import { MAP_HALF, CAR_POS } from '../world/World.js';

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

  typeWeights(night) {
    const e = this.elapsed;
    const w = [['normal', 10], ['small', e > 20 ? 4 : 1]];
    if (e > 25) w.push(['gunner', 3]);
    if (e > 50) w.push(['exploder', 2.5]);
    if (e > 80) w.push(['armored', 2 + night * 2]);
    if (e > 100) w.push(['big', 1 + night * 2.5]);
    return w;
  }

  gunnerWeapon() {
    const e = this.elapsed;
    const w = [['pistol', 55], ['shotgun', e > 60 ? 25 : 5], ['smg', e > 90 ? 18 : 0]];
    if (e > 150) w.push(['rocket', 6]);
    return pickWeighted(w);
  }

  findSpot(player, minD = 28, maxD = 50) {
    for (let i = 0; i < 25; i++) {
      // Tercihen oyuncunun görüşü dışında (arkada / yanlarda)
      const behind = player.yaw + Math.PI + rand(-1.9, 1.9);
      const a = i < 15 ? behind : rand(0, Math.PI * 2);
      const d = rand(minD, maxD);
      const x = player.pos.x - Math.sin(a) * d;
      const z = player.pos.z - Math.cos(a) * d;
      if (Math.abs(x) > MAP_HALF - 2 || Math.abs(z) > MAP_HALF - 2) continue;
      if (Math.hypot(x - CAR_POS.x, z - CAR_POS.z) < 10) continue;
      if (this.collision.blockedAt(x, z, 0.8, 2)) continue;
      return { x, z };
    }
    return null;
  }

  spawnOne(player, night, typeKey = null) {
    const spot = this.findSpot(player);
    if (!spot) return null;
    let type = typeKey || pickWeighted(this.typeWeights(night));
    const opts = { alerted: night > 0.5 ? chance(0.7) : chance(0.15) };
    if (type === 'gunner') opts.weapon = this.gunnerWeapon();
    if (type === 'small' && chance(0.5)) {
      // Küçükler sürü halinde
      for (let i = 0; i < 2; i++) this.zombies.spawn('small', spot.x + rand(-2, 2), spot.z + rand(-2, 2), opts);
    }
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
    for (const [x, zz, type] of spots) {
      z.spawn(type, x, zz, type === 'gunner' ? { weapon: chance(0.6) ? 'pistol' : 'shotgun' } : {});
    }
  }

  update(dt, player, night) {
    this.elapsed += dt;
    this.timer -= dt;
    if (this.timer > 0 || !player.alive) return;
    const difficulty = Math.min(1, this.elapsed / 600);
    const maxAlive = Math.min(42, Math.round((12 + difficulty * 14) * (1 + night * 0.7)));
    const interval = (night > 0.5 ? 1.3 : 3.2) * (1 - difficulty * 0.45);
    this.timer = interval * rand(0.7, 1.3);
    if (this.zombies.aliveCount >= maxAlive) return;
    // İlk silahlı zombiyi garanti et
    if (!this.firstGunner && this.elapsed > 30) {
      this.firstGunner = true;
      this.spawnOne(player, night, 'gunner');
      return;
    }
    this.spawnOne(player, night);
  }
}
