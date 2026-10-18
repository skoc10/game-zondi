import * as THREE from 'three';
import { part } from '../world/materials.js';
import { rayAABB } from '../core/Collision.js';
import { clamp, damp, angleDiff, rand, chance } from '../core/math.js';
import { MAP_HALF } from '../world/World.js';
import { spookRange, GUNSHOT_SPOOK } from '../levels/survivalLogic.js';

const DEER_HP = 60;
const RADIUS = 0.5;
const GRAZE_SPEED = 1.3;
const FLEE_SPEED = 9.5;
// Geyik sürülerinin otladığı meralar
export const MEADOWS = [
  [-115, 82], [-60, -118], [150, 22], [-178, 122], [60, 132], [-30, 200], [120, -10], [-170, -80],
];

const tmp = new THREE.Vector3();

function deerModel(stag) {
  const g = new THREE.Group();
  const inner = new THREE.Group();
  g.add(inner);
  const coat = '#8d5a2b';
  const belly = '#e8d3b0';
  part(inner, 0.5, 0.5, 1.25, 0, 1.05, 0, coat);
  part(inner, 0.42, 0.12, 1.0, 0, 0.8, 0, belly);
  part(inner, 0.16, 0.2, 0.1, 0, 1.2, 0.64, '#f5f5f5');
  const legs = [];
  for (const [x, z] of [[-0.17, -0.48], [0.17, -0.48], [-0.17, 0.48], [0.17, 0.48]]) {
    const leg = new THREE.Group();
    leg.position.set(x, 0.85, z);
    part(leg, 0.1, 0.85, 0.1, 0, -0.42, 0, '#6d4322');
    part(leg, 0.11, 0.08, 0.13, 0, -0.84, -0.01, '#2b1d10');
    inner.add(leg);
    legs.push(leg);
  }
  // Boyun ve baş (otlarken eğilir)
  const neck = new THREE.Group();
  neck.position.set(0, 1.2, -0.55);
  part(neck, 0.22, 0.55, 0.22, 0, 0.25, -0.05, coat);
  const head = new THREE.Group();
  head.position.set(0, 0.55, -0.1);
  part(head, 0.24, 0.24, 0.42, 0, 0, -0.1, coat);
  part(head, 0.14, 0.12, 0.1, 0, -0.04, -0.34, '#3b2a1a');
  part(head, 0.05, 0.05, 0.02, -0.1, 0.05, -0.2, '#111');
  part(head, 0.05, 0.05, 0.02, 0.1, 0.05, -0.2, '#111');
  part(head, 0.08, 0.16, 0.04, -0.15, 0.17, 0.05, coat);
  part(head, 0.08, 0.16, 0.04, 0.15, 0.17, 0.05, coat);
  if (stag) {
    for (const s of [-1, 1]) {
      part(head, 0.05, 0.4, 0.05, s * 0.1, 0.32, 0.02, '#d7c4a3');
      part(head, 0.22, 0.04, 0.04, s * 0.2, 0.42, 0.02, '#d7c4a3');
      part(head, 0.04, 0.2, 0.04, s * 0.3, 0.52, 0.02, '#d7c4a3');
    }
  }
  neck.add(head);
  inner.add(neck);
  return { group: g, inner, legs, neck, head };
}

export class Deer {
  constructor(x, z, herd, stag = false) {
    this.pos = new THREE.Vector3(x, 0, z);
    this.yaw = rand(0, Math.PI * 2);
    this.herd = herd;
    this.stag = stag;
    this.hp = DEER_HP;
    this.alive = true;
    this.state = 'graze';
    this.target = null;
    this.timer = rand(1, 4);
    this.fleeTime = 0;
    this.fleeDir = new THREE.Vector3();
    this.phase = rand(0, 6);
    this.deadTime = 0;
    this.removed = false;
    this.speed = 0;
    this.knock = new THREE.Vector3();
    const m = deerModel(stag);
    this.mesh = m.group;
    this.parts = m;
    this.mesh.position.copy(this.pos);
  }

  get center() {
    return tmp.set(this.pos.x, 1.05, this.pos.z).clone();
  }

  bodyBox() {
    // Dönüşten bağımsız kaba kutu (gövde uzun olduğu için biraz geniş)
    const h = 0.55;
    return { minX: this.pos.x - h, maxX: this.pos.x + h, minY: 0.15, maxY: 1.35, minZ: this.pos.z - h, maxZ: this.pos.z + h };
  }

  headPos() {
    this.mesh.updateMatrixWorld(true);
    return this.parts.head.getWorldPosition(new THREE.Vector3());
  }

  headBox() {
    const p = this.headPos();
    const h = 0.2;
    return { minX: p.x - h, maxX: p.x + h, minY: p.y - h, maxY: p.y + h, minZ: p.z - h, maxZ: p.z + h };
  }
}

export class AnimalManager {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.respawnTimer = 60;
    this.herdId = 0;
  }

  spawnHerd(cx, cz, n) {
    const herd = { id: this.herdId++, x: cx, z: cz };
    const made = [];
    for (let i = 0, k = 0; i < n && k < 40; k++) {
      const x = cx + rand(-8, 8);
      const z = cz + rand(-8, 8);
      if (this.game.collision.blockedAt(x, z, RADIUS + 0.2, 1.5)) continue;
      made.push(this.spawn(x, z, herd, i === 0 && n > 2));
      i++;
    }
    return made;
  }

  spawn(x, z, herd, stag = false) {
    const d = new Deer(x, z, herd || { id: this.herdId++, x, z }, stag);
    this.game.scene.add(d.mesh);
    this.list.push(d);
    return d;
  }

  get aliveCount() {
    return this.list.filter((d) => d.alive).length;
  }

  // Başlangıç sürüleri
  populate(playerPos, count = 3) {
    const spots = MEADOWS.filter(([x, z]) => Math.hypot(x - playerPos.x, z - playerPos.z) > 60);
    for (let i = 0; i < count && spots.length; i++) {
      const [x, z] = spots.splice(Math.floor(Math.random() * spots.length), 1)[0];
      this.spawnHerd(x, z, i === 0 ? 4 : 3);
    }
  }

  spook(d, from) {
    if (!d.alive) return;
    if (d.state !== 'flee') this.game.audio.play('deer', d.pos, 0.8);
    d.state = 'flee';
    d.fleeTime = rand(5, 8);
    d.fleeDir.set(d.pos.x - from.x, 0, d.pos.z - from.z);
    if (d.fleeDir.lengthSq() < 0.01) d.fleeDir.set(rand(-1, 1), 0, rand(-1, 1));
    d.fleeDir.normalize();
    // Sürünün geri kalanı da kaçar
    for (const o of this.list) {
      if (o === d || !o.alive || o.herd !== d.herd || o.state === 'flee') continue;
      if (o.pos.distanceTo(d.pos) < 30) {
        o.state = 'flee';
        o.fleeTime = rand(5, 8);
        o.fleeDir.copy(d.fleeDir);
      }
    }
  }

  onGunshot(pos) {
    for (const d of this.list) {
      if (d.alive && d.state !== 'flee' && d.pos.distanceTo(pos) < GUNSHOT_SPOOK) this.spook(d, pos);
    }
  }

  raycast(o, dir, maxT) {
    let best = maxT;
    let res = null;
    for (const d of this.list) {
      if (!d.alive) continue;
      tmp.subVectors(d.pos, o);
      const along = tmp.x * dir.x + tmp.z * dir.z;
      if (along < -3 || along > best + 3) continue;
      const th = rayAABB(o.x, o.y, o.z, dir.x, dir.y, dir.z, d.headBox(), best);
      if (th < best) {
        best = th;
        res = { deer: d, part: 'head', t: th };
      }
      const tb = rayAABB(o.x, o.y, o.z, dir.x, dir.y, dir.z, d.bodyBox(), best);
      if (tb < best) {
        best = tb;
        res = { deer: d, part: 'body', t: tb };
      }
    }
    return res;
  }

  // Kafadan tek vuruş, gövdeden iki
  damage(d, amount, part = 'body', cause = 'bullet', dir = null) {
    if (!d.alive) return { killed: false };
    const g = this.game;
    d.hp -= part === 'head' ? amount * 2.5 : amount;
    g.particles.emit({ pos: part === 'head' ? d.headPos() : d.center, count: 8, colors: ['#b71c1c', '#d32f2f', '#7f0000'], speed: 3, up: 1.5, life: 0.6, size: 0.08 });
    if (dir && cause !== 'explosion') d.knock.addScaledVector(tmp.set(dir.x, 0, dir.z).normalize(), 1.5);
    if (d.hp <= 0) {
      this.kill(d, cause);
      return { killed: true, headshot: part === 'head' };
    }
    this.spook(d, g.player.pos);
    return { killed: false };
  }

  kill(d, cause) {
    const g = this.game;
    d.alive = false;
    d.deadTime = 0;
    g.audio.play('deer', d.pos, 0.6, 0.7);
    g.particles.decal(d.pos.x, d.pos.z, 1.1, '#5d0f0f', 0.7);
    if (g.onDeerKilled) g.onDeerKilled(d, cause);
  }

  onExplosion(p, radius, damage) {
    for (const d of this.list) {
      if (!d.alive) continue;
      const dist = d.center.distanceTo(p);
      if (dist < radius) this.damage(d, damage * (1 - dist / radius) + 10, 'body', 'explosion');
      else if (dist < radius * 4) this.spook(d, p);
    }
  }

  update(dt, player, night) {
    const g = this.game;
    const col = g.collision;
    const ppos = player.pos;
    const spookR = spookRange({ sprinting: player.speed > 6, night });
    for (let i = this.list.length - 1; i >= 0; i--) {
      const d = this.list[i];
      if (!d.alive) {
        d.deadTime += dt;
        d.parts.inner.rotation.z = damp(d.parts.inner.rotation.z, Math.PI / 2, 6, dt);
        d.parts.inner.position.y = damp(d.parts.inner.position.y, 0.35, 6, dt);
        if (d.deadTime > 20) {
          g.scene.remove(d.mesh);
          this.list.splice(i, 1);
        }
        continue;
      }
      const dp = Math.hypot(ppos.x - d.pos.x, ppos.z - d.pos.z);
      if (player.alive && d.state !== 'flee' && dp < spookR) this.spook(d, ppos);

      let speed = 0;
      let headDown = 0;
      if (d.state === 'flee') {
        d.fleeTime -= dt;
        // Oyuncu yakınsa sürekli ondan uzağa yönelir
        if (dp < 40) {
          tmp.set(d.pos.x - ppos.x, 0, d.pos.z - ppos.z).normalize();
          d.fleeDir.lerp(tmp, Math.min(1, dt * 2)).normalize();
        }
        speed = FLEE_SPEED;
        d.target = null;
        if (d.fleeTime <= 0 && dp > 35) {
          d.state = 'graze';
          d.herd.x = d.pos.x;
          d.herd.z = d.pos.z;
          d.timer = rand(2, 5);
        }
      } else {
        d.timer -= dt;
        if (d.state === 'graze') {
          headDown = 1;
          if (d.timer <= 0) {
            d.state = 'walk';
            d.target = new THREE.Vector3(d.herd.x + rand(-10, 10), 0, d.herd.z + rand(-10, 10));
            d.timer = rand(3, 6);
          }
        } else {
          speed = GRAZE_SPEED;
          if (!d.target || d.timer <= 0 || Math.hypot(d.target.x - d.pos.x, d.target.z - d.pos.z) < 1) {
            d.state = 'graze';
            d.timer = rand(3, 8);
            speed = 0;
          }
        }
      }
      // Yön
      let wantYaw = d.yaw;
      if (d.state === 'flee') wantYaw = Math.atan2(-d.fleeDir.x, -d.fleeDir.z);
      else if (d.state === 'walk' && d.target) wantYaw = Math.atan2(-(d.target.x - d.pos.x), -(d.target.z - d.pos.z));
      d.yaw += clamp(angleDiff(d.yaw, wantYaw), -4 * dt, 4 * dt);
      d.speed = damp(d.speed, speed, 5, dt);
      const fx = -Math.sin(d.yaw);
      const fz = -Math.cos(d.yaw);
      const ox = d.pos.x;
      const oz = d.pos.z;
      d.pos.x += (fx * d.speed + d.knock.x) * dt;
      d.pos.z += (fz * d.speed + d.knock.z) * dt;
      d.knock.multiplyScalar(Math.max(0, 1 - 6 * dt));
      col.resolveCircle(d.pos, RADIUS, 1.4);
      d.pos.y = 0;
      // Takılınca yön değiştir
      if (d.speed > 2 && Math.hypot(d.pos.x - ox, d.pos.z - oz) < d.speed * dt * 0.3) {
        const a = rand(-2, 2);
        d.fleeDir.set(Math.sin(d.yaw + Math.PI + a), 0, Math.cos(d.yaw + Math.PI + a));
      }
      const lim = MAP_HALF - 3;
      if (Math.abs(d.pos.x) > lim || Math.abs(d.pos.z) > lim) {
        d.pos.x = clamp(d.pos.x, -lim, lim);
        d.pos.z = clamp(d.pos.z, -lim, lim);
        d.fleeDir.set(-Math.sign(d.pos.x) * 0.7, 0, -Math.sign(d.pos.z) * 0.7).normalize();
      }
      // Görünüm: koşarken sıçrama, bacak salınımı, otlarken baş eğik
      d.phase += dt * (d.speed > 4 ? 12 : 5) * (d.speed > 0.2 ? 1 : 0);
      const sw = Math.sin(d.phase) * Math.min(1, d.speed / 3) * 0.7;
      d.parts.legs[0].rotation.x = sw;
      d.parts.legs[3].rotation.x = sw;
      d.parts.legs[1].rotation.x = -sw;
      d.parts.legs[2].rotation.x = -sw;
      d.parts.inner.position.y = d.speed > 4 ? Math.abs(Math.sin(d.phase)) * 0.25 : 0;
      d.parts.neck.rotation.x = damp(d.parts.neck.rotation.x, headDown ? -1.25 : 0, 4, dt);
      if (d.state === 'flee' && chance(dt * 2)) g.audio.play('hooves', d.pos, 0.5);
      d.mesh.position.copy(d.pos);
      d.mesh.rotation.y = d.yaw;
    }

    // Nüfus: azalınca uzakta yeni sürü
    this.respawnTimer -= dt;
    if (this.respawnTimer <= 0) {
      this.respawnTimer = 60;
      if (this.aliveCount < 6) {
        const spots = MEADOWS.filter(([x, z]) => Math.hypot(x - ppos.x, z - ppos.z) > 100);
        if (spots.length) {
          const [x, z] = spots[Math.floor(Math.random() * spots.length)];
          this.spawnHerd(x, z, 2 + Math.floor(Math.random() * 3));
        }
      }
    }
  }

  // Kayıt
  serialize() {
    return this.list.filter((d) => d.alive).map((d) => ({ x: Math.round(d.pos.x * 10) / 10, z: Math.round(d.pos.z * 10) / 10, hp: d.hp, stag: d.stag, herd: d.herd.id }));
  }

  restore(list) {
    this.clear();
    const herds = new Map();
    for (const s of list || []) {
      if (!herds.has(s.herd)) herds.set(s.herd, { id: this.herdId++, x: s.x, z: s.z });
      const d = this.spawn(s.x, s.z, herds.get(s.herd), !!s.stag);
      if (Number.isFinite(s.hp)) d.hp = s.hp;
    }
  }

  clear() {
    for (const d of this.list) this.game.scene.remove(d.mesh);
    this.list = [];
  }
}
