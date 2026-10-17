import * as THREE from 'three';
import { ZOMBIE_TYPES, GUNNER_WEAPONS, EXPLODER_BLAST } from './zombieTypes.js';
import { damageZombie } from '../core/combat.js';
import { rayAABB } from '../core/Collision.js';
import { clamp, angleDiff, rand, chance } from '../core/math.js';
import { MAP_HALF } from '../world/World.js';
import { part, mat, glowMat } from '../world/materials.js';
import { WEAPON_MODELS } from '../world/models.js';

const tmp = new THREE.Vector3();

export class Zombie {
  constructor(typeKey, x, z, opts = {}) {
    const t = ZOMBIE_TYPES[typeKey];
    this.typeKey = typeKey;
    this.type = t;
    this.scale = t.scale;
    this.radius = 0.38 * t.scale;
    this.height = 2.15 * t.scale;
    this.pos = new THREE.Vector3(x, 0, z);
    this.vel = new THREE.Vector3();
    this.knock = new THREE.Vector3();
    this.yaw = Math.random() * Math.PI * 2;
    this.health = t.hp;
    this.maxHealth = t.hp;
    this.armor = t.armor || 0;
    this.helmet = t.helmet || 0;
    this.alive = true;
    this.alerted = !!opts.alerted;
    this.weapon = opts.weapon || null;
    this.attackCd = 0;
    this.shootCd = rand(1, 2);
    this.burstLeft = 0;
    this.burstCd = 0;
    this.fuse = -1;
    this.phase = Math.random() * 10;
    this.attackAnim = 0;
    this.wanderTarget = null;
    this.wanderTimer = 0;
    this.stuckTimer = 0;
    this.sidestep = 0;
    this.sideSign = 1;
    this.lastPos = this.pos.clone();
    this.groanTimer = rand(2, 8);
    this.flash = 0;
    this.deadTime = 0;
    this.headless = false;
    this.strafeSign = chance(0.5) ? 1 : -1;
    this.buildMesh();
  }

  buildMesh() {
    const t = this.type;
    const g = new THREE.Group();
    this.skinMat = mat(t.skin).clone();
    const skin = this.skinMat;
    const inner = new THREE.Group();
    g.add(inner);
    this.inner = inner;
    // Bacaklar (kalçadan dönen)
    this.legL = new THREE.Group();
    this.legR = new THREE.Group();
    this.legL.position.set(-0.14, 0.82, 0);
    this.legR.position.set(0.14, 0.82, 0);
    part(this.legL, 0.22, 0.82, 0.26, 0, -0.41, 0, t.pants);
    part(this.legR, 0.22, 0.82, 0.26, 0, -0.41, 0, t.pants);
    inner.add(this.legL, this.legR);
    // Gövde
    const bodyW = t.exploder ? 0.72 : 0.6;
    part(inner, bodyW, 0.75, t.exploder ? 0.48 : 0.36, 0, 1.2, 0, t.cloth);
    part(inner, bodyW * 0.5, 0.2, 0.37, 0.08, 1.0, -0.01, skin); // yırtık gömlek
    // Kollar (omuzdan dönen, öne uzanmış)
    this.armL = new THREE.Group();
    this.armR = new THREE.Group();
    this.armL.position.set(-bodyW / 2 - 0.1, 1.5, 0);
    this.armR.position.set(bodyW / 2 + 0.1, 1.5, 0);
    part(this.armL, 0.18, 0.7, 0.2, 0, -0.33, 0, skin);
    part(this.armR, 0.18, 0.7, 0.2, 0, -0.33, 0, skin);
    inner.add(this.armL, this.armR);
    // Kafa: dikdörtgen kutu
    this.head = new THREE.Group();
    this.head.position.set(0, 1.58, 0);
    inner.add(this.head);
    const hw = t.exploder ? 0.6 : 0.46;
    const hh = t.exploder ? 0.62 : 0.6;
    this.headSize = { w: hw, h: hh };
    const headMat = t.exploder ? glowMat('#b2ff59', 0.5).clone() : skin;
    this.headMat = headMat;
    part(this.head, hw, hh, hw, 0, hh / 2, 0, headMat);
    const eye = glowMat(t.exploder ? '#ff6d00' : '#d4ff00', 1.5);
    part(this.head, 0.09, 0.07, 0.02, -0.11, hh * 0.62, -hw / 2 - 0.01, eye);
    part(this.head, 0.09, 0.07, 0.02, 0.11, hh * 0.62, -hw / 2 - 0.01, eye);
    part(this.head, 0.24, 0.06, 0.02, 0, hh * 0.25, -hw / 2 - 0.01, '#1b3010');
    if (t.exploder) {
      // Şişkin kabarcıklar
      part(this.head, 0.18, 0.18, 0.18, 0.25, hh * 0.7, 0.1, headMat);
      part(this.head, 0.14, 0.14, 0.14, -0.24, hh * 0.4, 0.15, headMat);
    }
    // Zırh parçaları
    if (this.helmet > 0) {
      this.helmetMesh = part(this.head, hw + 0.08, 0.22, hw + 0.08, 0, hh - 0.04, 0, '#5f6b6d');
    }
    if (this.armor > 0) {
      this.vestMesh = part(inner, bodyW + 0.08, 0.6, 0.46, 0, 1.22, 0, '#4a5459');
    }
    // Silah elde
    if (this.weapon) {
      const wm = WEAPON_MODELS[this.weapon]();
      wm.scale.setScalar(1.6);
      wm.position.set(0, -0.62, -0.15);
      wm.rotation.x = Math.PI / 2;
      this.armR.add(wm);
    }
    g.scale.setScalar(this.scale);
    g.position.copy(this.pos);
    this.mesh = g;
  }

  headBox() {
    const s = this.scale;
    const hw = (this.headSize.w / 2 + 0.04) * s;
    const y0 = (1.58 + this.inner.position.y) * s;
    return {
      minX: this.pos.x - hw, maxX: this.pos.x + hw,
      minY: y0, maxY: y0 + this.headSize.h * s + 0.05,
      minZ: this.pos.z - hw, maxZ: this.pos.z + hw,
    };
  }

  bodyBox() {
    const s = this.scale;
    const r = 0.4 * s;
    return {
      minX: this.pos.x - r, maxX: this.pos.x + r,
      minY: this.pos.y, maxY: (1.58 + this.inner.position.y) * s,
      minZ: this.pos.z - r, maxZ: this.pos.z + r,
    };
  }

  get headPos() {
    const b = this.headBox();
    return tmp.set(this.pos.x, (b.minY + b.maxY) / 2, this.pos.z).clone();
  }

  get chestPos() {
    return new THREE.Vector3(this.pos.x, 1.2 * this.scale, this.pos.z);
  }
}

export class ZombieManager {
  constructor(scene, collision, game) {
    this.scene = scene;
    this.collision = collision;
    this.game = game;
    this.list = [];
  }

  get aliveCount() {
    let n = 0;
    for (const z of this.list) if (z.alive) n++;
    return n;
  }

  spawn(typeKey, x, z, opts = {}) {
    if (typeKey === 'gunner' && !opts.weapon) opts.weapon = 'pistol';
    const zb = new Zombie(typeKey, x, z, opts);
    this.scene.add(zb.mesh);
    this.list.push(zb);
    return zb;
  }

  clear() {
    for (const z of this.list) this.scene.remove(z.mesh);
    this.list = [];
  }

  // Ses/olay: yakındaki zombiler oyuncuyu fark eder
  alert(pos, radius) {
    for (const z of this.list) {
      if (z.alive && z.pos.distanceTo(pos) < radius) z.alerted = true;
    }
  }

  // Işın en yakın zombiye çarparsa { zombie, part, t }
  raycast(o, d, maxT) {
    let best = maxT;
    let res = null;
    for (const z of this.list) {
      if (!z.alive) continue;
      // Kaba ön eleme
      tmp.subVectors(z.pos, o);
      const along = tmp.x * d.x + tmp.z * d.z;
      if (along < -3 || along > best + 3) continue;
      if (!z.headless) {
        const th = rayAABB(o.x, o.y, o.z, d.x, d.y, d.z, z.headBox(), best);
        if (th < best) {
          best = th;
          res = { zombie: z, part: 'head', t: th };
        }
      }
      const tb = rayAABB(o.x, o.y, o.z, d.x, d.y, d.z, z.bodyBox(), best);
      if (tb < best) {
        best = tb;
        res = { zombie: z, part: 'body', t: tb };
      }
    }
    return res;
  }

  // cause: 'bullet' | 'melee' | 'explosion'
  damage(z, amount, part, cause = 'bullet', dir = null) {
    if (!z.alive) return { killed: false };
    const hadHelmet = z.helmet > 0;
    const hadArmor = z.armor > 0;
    const r = damageZombie(z, amount, part === 'head' ? 'head' : cause === 'explosion' ? 'blast' : 'body');
    z.health = r.health;
    z.armor = r.armor;
    z.helmet = r.helmet;
    z.alerted = true;
    z.flash = 0.12;
    const fx = this.game.particles;
    if (hadHelmet && z.helmet <= 0 && z.helmetMesh) {
      z.helmetMesh.visible = false;
      fx.emit({ pos: z.headPos, count: 8, colors: ['#5f6b6d', '#9e9e9e'], speed: 4, up: 3, life: 0.8, size: 0.1 });
      this.game.audio.play('clank', z.pos);
    }
    if (hadArmor && z.armor <= 0 && z.vestMesh) {
      z.vestMesh.visible = false;
      fx.emit({ pos: z.chestPos, count: 10, colors: ['#4a5459', '#757575'], speed: 4, up: 2, life: 0.8, size: 0.12 });
      this.game.audio.play('clank', z.pos);
    }
    if (dir && cause !== 'explosion') {
      const k = cause === 'melee' ? 5 : 1.2;
      z.knock.x += dir.x * k / z.scale;
      z.knock.z += dir.z * k / z.scale;
    }
    if (z.health <= 0) {
      this.kill(z, cause, part, r.headshot || part === 'head');
      return { killed: true, headshot: part === 'head' };
    }
    return { killed: false, headshot: r.headshot };
  }

  kill(z, cause, part, headshot) {
    z.alive = false;
    z.deadTime = 0;
    const game = this.game;
    const fx = game.particles;
    if (z.type.exploder && (part === 'head' || cause === 'explosion' || cause === 'self')) {
      // Kafadan vurulan ya da patlamada ölen patlayan zombi yerinde patlar
      this.scene.remove(z.mesh);
      z.removed = true;
      game.explosives.explode(z.headPos, EXPLODER_BLAST.radius, EXPLODER_BLAST.damage, { source: 'exploder' });
    } else if (cause === 'explosion') {
      // Parçalanma
      this.scene.remove(z.mesh);
      z.removed = true;
      fx.emit({ pos: z.chestPos, count: 26, colors: [z.type.skin, z.type.cloth, '#2e7d32', '#76ff03'], speed: 8, up: 5, life: 1.4, size: 0.16 * z.scale, gravity: 16, drag: 0.2 });
      fx.decal(z.pos.x, z.pos.z, 1.2 * z.scale, '#2e5d1f', 0.75);
    } else {
      if (headshot) {
        z.head.visible = false;
        z.headless = true;
        fx.emit({ pos: z.headPos, count: 18, colors: [z.type.skin, '#76ff03', '#2e7d32'], speed: 5, up: 3, life: 0.9, size: 0.1 * z.scale });
        game.audio.play('headshot', z.pos);
      }
      fx.decal(z.pos.x, z.pos.z, 0.9 * z.scale, '#2e5d1f', 0.7);
    }
    game.onZombieKilled(z, cause, headshot);
  }

  update(dt, player, night) {
    const game = this.game;
    const list = this.list;
    const ppos = player.pos;
    const flashOn = player.flashOn && night > 0.5;
    const pf = player.forward();

    for (let i = list.length - 1; i >= 0; i--) {
      const z = list[i];
      if (!z.alive) {
        this.updateDead(z, dt);
        if (z.removed) {
          list.splice(i, 1);
        }
        continue;
      }
      z.flash = Math.max(0, z.flash - dt);
      z.skinMat.emissive.setRGB(z.flash * 6, z.flash * 6, z.flash * 6);

      const dx = ppos.x - z.pos.x;
      const dz = ppos.z - z.pos.z;
      const dist = Math.hypot(dx, dz);

      // Algılama: gündüz uzak, gece yakın; fener ışığı zombileri çeker
      if (!z.alerted && player.alive) {
        let range = 30 - night * 14;
        if (flashOn) {
          const facing = -(pf.x * dx + pf.z * dz) / (dist || 1);
          if (facing > 0.85) range += 22;
        }
        if (player.speed > 6) range += 6;
        if (dist < range) z.alerted = true;
      }
      if (z.alerted && dist > 80) z.alerted = false;
      if (!player.alive) z.alerted = false;

      const t = z.type;
      let speed = t.speed * (1 + night * 0.15);
      let mx = 0;
      let mz = 0;
      let face = null;

      if (z.fuse >= 0) {
        // Patlamak üzere: titre, dur
        z.fuse -= dt;
        z.headMat.emissiveIntensity = 0.5 + Math.abs(Math.sin(z.fuse * 40)) * 3;
        z.inner.position.x = (Math.random() - 0.5) * 0.06;
        if (z.fuse <= 0) {
          this.kill(z, 'self', 'body', false);
          continue;
        }
        speed = 0;
      } else if (z.alerted) {
        mx = dx / (dist || 1);
        mz = dz / (dist || 1);
        face = Math.atan2(dx, dz);
        if (t.ranged && z.weapon) {
          const w = GUNNER_WEAPONS[z.weapon];
          const ideal = z.weapon === 'shotgun' ? 7 : 13;
          const los = dist < w.range && this.collision.lineOfSight(
            z.pos.x, 1.6 * z.scale, z.pos.z, ppos.x, ppos.y + 1.5, ppos.z,
          );
          if (los && dist < ideal + 4) {
            // Mesafe koru ve yana kay
            const back = dist < ideal - 3 ? -0.6 : 0;
            mx = mx * back + -mz * z.strafeSign * 0.5;
            mz = mz * back + (dx / (dist || 1)) * z.strafeSign * 0.5;
            if (Math.random() < dt * 0.3) z.strafeSign *= -1;
          }
          this.updateShooting(z, dt, dist, los, player);
        }
        if (t.exploder && dist < 2.0 && player.alive) {
          z.fuse = 0.7;
          game.audio.play('fuse', z.pos);
        }
        // Yakın saldırı
        const reach = z.radius + 0.4 + 0.75 * Math.max(1, z.scale * 0.8);
        z.attackCd -= dt;
        if (!t.exploder && dist < reach && Math.abs(ppos.y - z.pos.y) < 1.6 * z.scale && player.alive) {
          speed *= 0.2;
          if (z.attackCd <= 0) {
            z.attackCd = t.attackRate;
            z.attackAnim = 1;
            player.takeDamage(t.damage * (1 + night * 0.2), z.pos);
            game.onPlayerHit(t.damage);
            if (t.knockback) player.push(dx, dz, t.knockback);
          }
        }
      } else {
        // Dolaşma
        z.wanderTimer -= dt;
        if (!z.wanderTarget || z.wanderTimer <= 0) {
          z.wanderTarget = new THREE.Vector3(z.pos.x + rand(-12, 12), 0, z.pos.z + rand(-12, 12));
          z.wanderTimer = rand(3, 8);
        }
        const wx = z.wanderTarget.x - z.pos.x;
        const wz = z.wanderTarget.z - z.pos.z;
        const wd = Math.hypot(wx, wz);
        if (wd > 0.8) {
          mx = wx / wd;
          mz = wz / wd;
        }
        speed *= 0.3;
      }

      // Takılma: duvara sürtünüyorsa bir süre yana kay
      if (z.sidestep > 0) {
        z.sidestep -= dt;
        const sx = -mz * z.sideSign;
        const sz = mx * z.sideSign;
        mx = mx * 0.3 + sx;
        mz = mz * 0.3 + sz;
      }

      // Ayrılma (sürü üst üste binmesin)
      for (let j = 0; j < list.length; j++) {
        const o = list[j];
        if (o === z || !o.alive) continue;
        const ox = z.pos.x - o.pos.x;
        const oz = z.pos.z - o.pos.z;
        const min = z.radius + o.radius + 0.1;
        const d2 = ox * ox + oz * oz;
        if (d2 < min * min && d2 > 1e-6) {
          const d = Math.sqrt(d2);
          const push = (min - d) / min;
          mx += (ox / d) * push * 1.5;
          mz += (oz / d) * push * 1.5;
        }
      }

      const ml = Math.hypot(mx, mz);
      if (ml > 1) {
        mx /= ml;
        mz /= ml;
      }
      z.vel.x = mx * speed;
      z.vel.z = mz * speed;
      z.pos.x += (z.vel.x + z.knock.x) * dt;
      z.pos.z += (z.vel.z + z.knock.z) * dt;
      z.knock.multiplyScalar(Math.max(0, 1 - 8 * dt));
      this.collision.resolveCircle(z.pos, z.radius, z.height);
      z.pos.x = clamp(z.pos.x, -MAP_HALF, MAP_HALF);
      z.pos.z = clamp(z.pos.z, -MAP_HALF, MAP_HALF);

      // Takılma algılama
      z.stuckTimer += dt;
      if (z.stuckTimer > 0.8) {
        const moved = z.pos.distanceTo(z.lastPos);
        if (z.alerted && moved < speed * 0.8 * 0.35 && dist > 2.5 && speed > 0.5) {
          z.sidestep = rand(0.8, 1.6);
          z.sideSign = chance(0.5) ? 1 : -1;
        }
        z.lastPos.copy(z.pos);
        z.stuckTimer = 0;
      }

      // Yönelme
      const targetYaw = face !== null && (dist < 20 || t.ranged) ? face : (ml > 0.1 ? Math.atan2(mx, mz) : z.yaw);
      z.yaw += angleDiff(z.yaw, targetYaw) * Math.min(1, dt * 8);

      // Animasyon
      const moveSpeed = Math.hypot(z.vel.x, z.vel.z);
      z.phase += dt * (2 + moveSpeed * 2.2) / Math.sqrt(z.scale);
      const swing = Math.sin(z.phase) * Math.min(0.8, moveSpeed * 0.25);
      z.legL.rotation.x = swing;
      z.legR.rotation.x = -swing;
      z.attackAnim = Math.max(0, z.attackAnim - dt * 3);
      const armBase = t.ranged && z.alerted ? -Math.PI / 2 : -1.35;
      z.armL.rotation.x = armBase + Math.sin(z.phase * 0.5) * 0.12 + z.attackAnim * 0.9;
      z.armR.rotation.x = (t.ranged && z.alerted ? -Math.PI / 2 : armBase - Math.sin(z.phase * 0.5) * 0.12) + z.attackAnim * 0.9;
      z.inner.rotation.z = Math.sin(z.phase * 0.5) * 0.06;
      z.head.rotation.z = Math.sin(z.phase * 0.3) * 0.15;
      if (t.exploder && z.fuse < 0) z.headMat.emissiveIntensity = 0.4 + Math.sin(z.phase * 2) * 0.25;

      z.mesh.position.copy(z.pos);
      // Model ileri yönü -Z olduğu için yaw + PI
      z.mesh.rotation.y = z.yaw + Math.PI;

      // İnilti
      z.groanTimer -= dt;
      if (z.groanTimer <= 0) {
        z.groanTimer = rand(4, 10);
        if (dist < 35) game.audio.play('groan', z.pos, 0.6, t.pitch);
      }
    }
  }

  updateShooting(z, dt, dist, los, player) {
    const w = GUNNER_WEAPONS[z.weapon];
    z.shootCd -= dt;
    if (z.burstLeft > 0) {
      z.burstCd -= dt;
      if (z.burstCd <= 0) {
        z.burstLeft--;
        z.burstCd = w.burstGap || 0.1;
        this.fireAt(z, w, dist, player);
      }
      return;
    }
    if (los && z.shootCd <= 0 && player.alive) {
      z.shootCd = rand(w.interval[0], w.interval[1]);
      z.burstLeft = (w.burst || 1) - 1;
      z.burstCd = w.burstGap || 0.1;
      this.fireAt(z, w, dist, player);
    }
  }

  fireAt(z, w, dist, player) {
    const game = this.game;
    const muzzle = new THREE.Vector3(z.pos.x, 1.45 * z.scale, z.pos.z);
    const target = player.center.add(new THREE.Vector3(0, 0.4, 0));
    const dir = target.clone().sub(muzzle).normalize();
    muzzle.addScaledVector(dir, 0.7);
    z.attackAnim = 0.4;
    if (w.rocket) {
      game.explosives.fireRocket(muzzle, dir, 'enemy');
      game.audio.play('rocket', z.pos);
      return;
    }
    game.audio.play('enemyShot', z.pos, z.weapon === 'shotgun' ? 1.2 : 0.8);
    game.particles.emit({ pos: muzzle, count: 4, colors: ['#ffeb3b', '#ff9800'], speed: 2, life: 0.08, size: 0.08, glow: true, gravity: 0 });
    // İsabet şansı: mesafe ve oyuncunun hızı düşürür
    const hitChance = clamp(w.accuracy * (1 - dist / (w.range * 1.6)) - player.speed * 0.035, 0.08, 0.9);
    const hit = Math.random() < hitChance;
    const end = target.clone();
    if (!hit) end.add(new THREE.Vector3(rand(-1.2, 1.2), rand(-0.5, 1), rand(-1.2, 1.2)));
    game.particles.tracer(muzzle, end, '#ff8a65');
    if (hit) {
      player.takeDamage(w.damage, z.pos);
      game.onPlayerHit(w.damage);
    }
  }

  updateDead(z, dt) {
    if (z.removed) return;
    z.deadTime += dt;
    const k = Math.min(1, z.deadTime / 0.4);
    z.inner.rotation.x = -k * Math.PI / 2;
    z.inner.position.y = k * 0.2;
    z.legL.rotation.x *= 0.9;
    z.legR.rotation.x *= 0.9;
    if (z.deadTime > 4) z.mesh.position.y = -(z.deadTime - 4) * 0.8;
    if (z.deadTime > 5.5) {
      this.scene.remove(z.mesh);
      z.removed = true;
    }
  }
}
