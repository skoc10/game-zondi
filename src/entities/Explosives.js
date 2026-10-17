import * as THREE from 'three';
import { coveredExplosionDamage } from '../core/combat.js';
import { WEAPONS, THROWABLES } from '../weapons/weaponData.js';
import { grenadeModel, zombieHeadModel, tntModel, c4Model, rocketProjectileModel } from '../world/models.js';
import { clamp } from '../core/math.js';

const BARREL = { radius: 6, damage: 150 };
const GRAVITY = 18;
const tmpDir = new THREE.Vector3();

export class Explosives {
  constructor(scene, game) {
    this.scene = scene;
    this.game = game;
    this.projectiles = [];
    this.placed = [];
    this.pending = [];
    this.lights = [];
    for (let i = 0; i < 4; i++) {
      const l = new THREE.PointLight('#ffb74d', 0, 30, 1.4);
      scene.add(l);
      this.lights.push({ light: l, life: 0 });
    }
    this.lightIdx = 0;
  }

  clear() {
    for (const p of this.projectiles) this.scene.remove(p.mesh);
    for (const p of this.placed) this.scene.remove(p.mesh);
    this.projectiles = [];
    this.placed = [];
    this.pending = [];
  }

  get c4Count() {
    return this.placed.filter((p) => p.kind === 'c4').length;
  }

  // Merkezi patlama: hasar, zincirleme, ışık, parçacık, sarsıntı, ses
  explode(pos, radius, damage, opts = {}) {
    const g = this.game;
    const p = pos.clone();
    const col = g.collision;
    // Duvar arkasındaki hedef korunur
    const occluded = (t) => !col.lineOfSight(p.x, p.y + 0.5, p.z, t.x, t.y, t.z);
    // Zombiler
    for (const z of g.zombies.list) {
      if (!z.alive) continue;
      const chest = z.chestPos;
      const d = Math.max(0, chest.distanceTo(p) - z.radius);
      if (d >= radius) continue;
      const hidden = occluded(chest);
      const dmg = coveredExplosionDamage(d, radius, damage, hidden);
      if (dmg <= 0) continue;
      if (!hidden) {
        tmpDir.subVectors(z.pos, p).setY(0).normalize();
        z.knock.addScaledVector(tmpDir, (12 * (1 - d / radius)) / z.scale);
      }
      g.zombies.damage(z, dmg, 'body', 'explosion');
    }
    // Oyuncu (biraz affedici)
    const pl = g.player;
    if (pl.alive && !pl.vehicle) {
      const c = pl.center;
      const d = c.distanceTo(p);
      if (d < radius) {
        const hidden = occluded(c);
        const dmg = coveredExplosionDamage(d, radius, damage, hidden) * 0.5;
        if (dmg > 0) {
          pl.takeDamage(dmg, p);
          if (!hidden) pl.push(pl.pos.x - p.x, pl.pos.z - p.z, 10 * (1 - d / radius));
          g.onPlayerHit(dmg);
        }
      }
    }
    if (g.vehicles) g.vehicles.onExplosion(p, radius, damage, occluded);
    // Zincirleme: variller, TNT, C4, sandıklar
    for (const b of g.world.barrels) {
      if (!b.alive || b.fuse >= 0) continue;
      const d = Math.hypot(b.pos.x - p.x, b.pos.z - p.z);
      if (d < radius * 1.05) b.fuse = 0.12 + d * 0.025;
    }
    for (const pl2 of this.placed) {
      if (pl2.triggered) continue;
      if (pl2.mesh.position.distanceTo(p) < radius) {
        pl2.triggered = true;
        pl2.fuse = 0.15;
      }
    }
    for (const c of g.world.crates) {
      if (c.alive && Math.hypot(c.pos.x - p.x, c.pos.z - p.z) < radius * 0.8) g.breakCrate(c);
    }
    // Yerdeki zombi kafaları da patlar
    for (const pk of g.pickups.list.slice()) {
      if (pk.type === 'head' && pk.pos.distanceTo(p) < radius * 0.8) {
        g.pickups.remove(pk);
        this.pending.push({ t: 0.15, pos: pk.pos.clone().setY(0.5), radius: THROWABLES.head.radius, damage: THROWABLES.head.damage });
      }
    }
    // Görsel
    const L = this.lights[this.lightIdx++ % this.lights.length];
    L.light.position.set(p.x, p.y + 1.5, p.z);
    L.light.intensity = 220 * (radius / 6);
    L.light.distance = radius * 6;
    L.life = 0.5;
    L.max = L.light.intensity;
    g.particles.explosion(p, radius);
    g.particles.decal(p.x, p.z, radius * 0.45, '#141414', 0.8);
    const dist = g.player.pos.distanceTo(p);
    g.addShake(clamp(1.3 - dist / (radius * 3.5), 0, 1.2));
    g.input.rumble(clamp(1 - dist / 40, 0.15, 1), 0.8, 350);
    g.audio.play('explosion', p);
    g.zombies.alert(p, 45);
    g.stats.explosions++;
  }

  // Varil vurulunca
  triggerBarrel(barrel, delay = 0.05) {
    if (barrel.alive && barrel.fuse < 0) barrel.fuse = delay;
  }

  throw(kind, origin, dir) {
    const info = THROWABLES[kind];
    const mesh = kind === 'head' ? zombieHeadModel() : grenadeModel();
    mesh.scale.setScalar(kind === 'head' ? 0.9 : 1.4);
    mesh.position.copy(origin);
    this.scene.add(mesh);
    const vel = dir.clone().multiplyScalar(17).add(new THREE.Vector3(0, 3.5, 0));
    this.projectiles.push({
      kind, mesh, pos: origin.clone(), vel, fuse: info.fuse, impact: info.impact,
      radius: info.radius, damage: info.damage, gravity: true, life: 8, owner: 'player',
      spin: new THREE.Vector3(Math.random() * 8, Math.random() * 8, 0),
    });
  }

  // opts: { speed, radius, damage } — tank topu bunlarla ateşlenir
  fireRocket(origin, dir, owner = 'player', opts = {}) {
    const w = WEAPONS.rocket;
    const mesh = rocketProjectileModel();
    if (opts.radius) mesh.scale.setScalar(1.6);
    mesh.position.copy(origin);
    mesh.lookAt(origin.clone().sub(dir));
    this.scene.add(mesh);
    const speed = opts.speed ?? (owner === 'enemy' ? 17 : w.speed);
    this.projectiles.push({
      kind: 'rocket', mesh, pos: origin.clone(), vel: dir.clone().multiplyScalar(speed),
      impact: true, radius: opts.radius ?? (owner === 'enemy' ? 4.5 : w.radius),
      damage: opts.damage ?? (owner === 'enemy' ? 70 : w.damage),
      gravity: false, life: 5, owner, fuse: 0,
    });
  }

  // Uçak/helikopter bombası: aracın hızıyla düşer, çarpınca patlar
  dropBomb(origin, vel, radius, damage) {
    const mesh = grenadeModel();
    mesh.scale.set(3, 4, 3);
    mesh.position.copy(origin);
    this.scene.add(mesh);
    this.projectiles.push({
      kind: 'bomb', mesh, pos: origin.clone(), vel: vel.clone(), impact: true,
      radius, damage, gravity: true, life: 12, owner: 'player', fuse: 0,
    });
  }

  placeTNT(pos) {
    const mesh = tntModel();
    mesh.scale.setScalar(1.6);
    mesh.position.copy(pos).setY(pos.y + 0.3);
    this.scene.add(mesh);
    const w = WEAPONS.tnt;
    this.placed.push({ kind: 'tnt', mesh, fuse: w.fuse, triggered: true, radius: w.radius, damage: w.damage, spark: 0 });
    this.game.audio.play('fuse', pos);
  }

  placeC4(pos, normal) {
    const mesh = c4Model();
    mesh.scale.setScalar(1.6);
    mesh.position.copy(pos).addScaledVector(normal, 0.08);
    mesh.lookAt(mesh.position.clone().add(normal));
    mesh.rotateX(Math.PI / 2);
    this.scene.add(mesh);
    const w = WEAPONS.c4;
    this.placed.push({ kind: 'c4', mesh, fuse: -1, triggered: false, radius: w.radius, damage: w.damage, blink: 0 });
    this.game.audio.play('beep', pos);
  }

  detonateC4() {
    let i = 0;
    for (const p of this.placed) {
      if (p.kind === 'c4' && !p.triggered) {
        p.triggered = true;
        p.fuse = 0.05 + i * 0.08;
        i++;
      }
    }
    if (i > 0) this.game.audio.play('beep', null, 1.5);
    return i;
  }

  update(dt) {
    const g = this.game;
    // Bekleyen patlamalar
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const e = this.pending[i];
      e.t -= dt;
      if (e.t <= 0) {
        this.pending.splice(i, 1);
        this.explode(e.pos, e.radius, e.damage);
      }
    }
    // Variller
    for (const b of g.world.barrels) {
      if (!b.alive || b.fuse < 0) continue;
      b.fuse -= dt;
      if (Math.random() < dt * 30) g.particles.emit({ pos: b.pos.clone().setY(1.1), count: 2, colors: ['#ffeb3b', '#ff9800'], speed: 2, up: 2, life: 0.3, size: 0.1, glow: true, gravity: -2 });
      if (b.fuse <= 0) {
        g.world.removeBarrel(b);
        this.explode(b.pos.clone().setY(0.6), BARREL.radius, BARREL.damage, { source: 'barrel' });
      }
    }
    // Yerleştirilmiş
    for (let i = this.placed.length - 1; i >= 0; i--) {
      const p = this.placed[i];
      if (p.kind === 'c4') {
        p.blink += dt;
        const led = p.mesh.getObjectByName('led');
        if (led) led.visible = Math.sin(p.blink * 8) > 0;
      }
      if (p.kind === 'tnt') {
        p.spark -= dt;
        if (p.spark <= 0) {
          p.spark = 0.03;
          const top = p.mesh.position.clone().setY(p.mesh.position.y + 0.45);
          g.particles.emit({ pos: top, count: 2, colors: ['#ffeb3b', '#fff', '#ff9800'], speed: 1.5, up: 1.5, life: 0.25, size: 0.05, glow: true, gravity: 2 });
        }
      }
      if (p.triggered) {
        p.fuse -= dt;
        if (p.fuse <= 0) {
          this.placed.splice(i, 1);
          this.scene.remove(p.mesh);
          this.explode(p.mesh.position, p.radius, p.damage, { source: p.kind });
        }
      }
    }
    // Mermiler / fırlatılanlar
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;
      if (p.gravity) p.vel.y -= GRAVITY * dt;
      const step = p.vel.length() * dt;
      const dir = p.vel.clone().normalize();
      let boom = null;

      // Dünya çarpışması
      const hit = g.collision.raycast(p.pos.x, p.pos.y, p.pos.z, dir.x, dir.y, dir.z, step + 0.15);
      if (hit) {
        const hp = p.pos.clone().addScaledVector(dir, Math.max(0, hit.t - 0.1));
        if (p.impact) boom = hp;
        else {
          // Bomba seker
          p.pos.copy(hp);
          if (hit.ground) {
            p.vel.y = Math.abs(p.vel.y) * 0.35;
            p.vel.x *= 0.6;
            p.vel.z *= 0.6;
          } else {
            const b = hit.box;
            const e = 0.05;
            if (Math.abs(hp.x - b.minX) < 0.2 + e || Math.abs(hp.x - b.maxX) < 0.2 + e) p.vel.x *= -0.4;
            else if (Math.abs(hp.z - b.minZ) < 0.2 + e || Math.abs(hp.z - b.maxZ) < 0.2 + e) p.vel.z *= -0.4;
            else p.vel.y = Math.abs(p.vel.y) * 0.3;
          }
          if (p.vel.length() > 2) g.audio.play('clank', p.pos, 0.3);
        }
      } else {
        p.pos.addScaledVector(p.vel, dt);
      }
      // Zombi isabeti (çarpınca patlayanlar)
      if (!boom && p.impact && p.owner === 'player') {
        const zh = g.zombies.raycast(p.pos, dir, step + 0.3);
        if (zh) boom = p.pos.clone().addScaledVector(dir, zh.t);
      }
      // Düşman roketi oyuncuya
      if (!boom && p.owner === 'enemy' && p.pos.distanceTo(g.player.center) < (g.player.vehicle ? 2.2 : 0.9)) boom = p.pos.clone();
      if (!boom && p.fuse > 0) {
        p.fuse -= dt;
        if (p.fuse <= 0) boom = p.pos.clone();
      }
      if (!boom && p.life <= 0) boom = p.pos.clone();

      p.mesh.position.copy(p.pos);
      if (p.spin) {
        p.mesh.rotation.x += p.spin.x * dt;
        p.mesh.rotation.y += p.spin.y * dt;
      }
      if (p.kind === 'rocket') {
        g.particles.emit({ pos: p.pos.clone().addScaledVector(dir, -0.4), count: 2, colors: ['#9e9e9e', '#bdbdbd'], speed: 0.5, life: 0.7, size: 0.18, gravity: -1, drag: 2, grow: 1.5 });
        g.particles.emit({ pos: p.pos.clone().addScaledVector(dir, -0.35), count: 1, colors: ['#ffb300'], speed: 0.5, life: 0.1, size: 0.12, glow: true, gravity: 0 });
      }
      if (p.kind === 'head' && Math.random() < 0.5) {
        g.particles.emit({ pos: p.pos.clone(), count: 1, colors: ['#b2ff59'], speed: 0.3, life: 0.3, size: 0.06, glow: true, gravity: 0 });
      }
      if (boom) {
        this.projectiles.splice(i, 1);
        this.scene.remove(p.mesh);
        boom.y = Math.max(boom.y, 0.3);
        this.explode(boom, p.radius, p.damage, { source: p.kind });
      }
    }
    // Patlama ışıkları söner
    for (const L of this.lights) {
      if (L.life <= 0) continue;
      L.life -= dt;
      L.light.intensity = Math.max(0, (L.life / 0.5) ** 2 * L.max);
    }
  }
}
