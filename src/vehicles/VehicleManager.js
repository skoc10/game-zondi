import * as THREE from 'three';
import { VEHICLE_TYPES } from './vehicleTypes.js';
import { VEHICLE_MODELS, playerAvatar } from './vehicleModels.js';
import { stepGround, stepHeli, stepPlane, ramDamage } from './vehiclePhysics.js';
import { boxFromBase } from '../core/Collision.js';
import { coveredExplosionDamage } from '../core/combat.js';
import { VEHICLE_SPOTS, MAP_HALF } from '../world/World.js';
import { mat } from '../world/materials.js';
import { clamp, damp, angleDiff, rand } from '../core/math.js';

const tmp = new THREE.Vector3();
const tmp2 = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const WRECK = mat('#262626');

class Vehicle {
  constructor(typeKey, x, z, yaw) {
    this.typeKey = typeKey;
    this.spec = VEHICLE_TYPES[typeKey];
    this.parts = VEHICLE_MODELS[typeKey]();
    this.mesh = new THREE.Group();
    this.body = this.parts.group;
    this.mesh.add(this.body);
    this.state = {
      x, y: 0, z, yaw, speed: 0, vy: 0, pitch: 0, roll: 0,
      fuel: this.spec.fuel, onGround: true, throttleSet: 0,
    };
    this.fallVy = 0;
    this.hp = this.spec.hp;
    this.alive = true;
    this.box = null;
    this.rotorSpin = 0;
    this.cooldown = 0;
    this.cooldown2 = 0;
    this.turretYaw = 0;
    this.turretPitch = 0;
    this.smokeT = 0;
    this.fuelWarned = false;
    this.avatar = playerAvatar();
    const [sx, sy, sz] = this.spec.seat;
    this.avatar.position.set(sx, sy, sz);
    this.avatar.visible = false;
    this.body.add(this.avatar);
    this.syncMesh();
  }

  get pos() {
    return new THREE.Vector3(this.state.x, this.state.y, this.state.z);
  }

  get center() {
    return new THREE.Vector3(this.state.x, this.state.y + this.spec.height * 0.5, this.state.z);
  }

  get isAir() {
    return this.spec.kind !== 'ground';
  }

  forward(out = new THREE.Vector3()) {
    return out.set(-Math.sin(this.state.yaw), 0, -Math.cos(this.state.yaw));
  }

  // Gövdenin orta çizgisi boyunca iki uç nokta ve yarıçap
  segment() {
    const s = this.spec;
    const r = this.isAir ? (this.typeKey === 'heli' ? 1.4 : 0.8) : Math.max(0.45, s.width / 2);
    const half = Math.max(0, s.length / 2 - r);
    const fx = -Math.sin(this.state.yaw);
    const fz = -Math.cos(this.state.yaw);
    return {
      ax: this.state.x + fx * half, az: this.state.z + fz * half,
      bx: this.state.x - fx * half, bz: this.state.z - fz * half, r,
    };
  }

  // Bir noktanın araç gövdesine uzaklığı (gövde içi < 0)
  surfaceDist(x, z) {
    const { ax, az, bx, bz, r } = this.segment();
    const vx = bx - ax;
    const vz = bz - az;
    const len2 = vx * vx + vz * vz;
    const t = len2 > 0 ? clamp(((x - ax) * vx + (z - az) * vz) / len2, 0, 1) : 0;
    return Math.hypot(x - (ax + vx * t), z - (az + vz * t)) - r;
  }

  syncMesh() {
    const st = this.state;
    this.mesh.position.set(st.x, st.y, st.z);
    this.mesh.rotation.set(0, st.yaw, 0);
    this.body.rotation.set(st.pitch, 0, st.roll);
  }
}

export class VehicleManager {
  constructor(game, extraSpots = [], includeDefaults = true) {
    this.game = game;
    this.list = [];
    this.current = null;
    this.camYaw = 0;
    this.camPitch = -0.12;
    this.lookIdle = 0;
    this.camPos = new THREE.Vector3();
    this.camInit = false;
    this.vstick = { x: 0, y: 0 };
    this.refueling = false;
    this.boundaryWarned = 0;
    this.headlight = new THREE.SpotLight('#fff3d0', 0, 50, 0.6, 0.5, 1.2);
    game.scene.add(this.headlight);
    game.scene.add(this.headlight.target);
    for (const [type, x, z, yaw] of [...(includeDefaults ? VEHICLE_SPOTS : []), ...extraSpots]) this.spawn(type, x, z, yaw);
  }

  spawn(type, x, z, yaw = 0) {
    const v = new Vehicle(type, x, z, yaw);
    this.game.scene.add(v.mesh);
    this.park(v);
    this.list.push(v);
    return v;
  }

  // Duran araç çarpışma kutusu olur (siper)
  park(v) {
    if (v.box) this.game.collision.remove(v.box);
    const s = v.spec;
    const c = Math.abs(Math.cos(v.state.yaw));
    const sn = Math.abs(Math.sin(v.state.yaw));
    const width = v.typeKey === 'plane' ? 1.6 : v.typeKey === 'heli' ? 2.4 : s.width;
    const length = v.typeKey === 'heli' ? 5.5 : s.length;
    v.box = this.game.collision.add(boxFromBase(
      v.state.x, v.state.y, v.state.z,
      width * c + length * sn, s.height, width * sn + length * c,
      { kind: 'vehicle', ref: v },
    ));
  }

  unpark(v) {
    if (v.box) this.game.collision.remove(v.box);
    v.box = null;
  }

  nearest(pos) {
    let best = null;
    let bd = 2.0;
    for (const v of this.list) {
      if (!v.alive || v === this.current) continue;
      if (Math.abs(pos.y - v.state.y) > 3) continue;
      const d = v.surfaceDist(pos.x, pos.z);
      if (d < bd) {
        bd = d;
        best = v;
      }
    }
    return best;
  }

  enterLabel(v) {
    return `${v.spec.enter} (yakıt %${Math.round((v.state.fuel / v.spec.fuel) * 100)})`;
  }

  enter(v) {
    const g = this.game;
    const p = g.player;
    p.vehicle = v;
    this.current = v;
    this.unpark(v);
    v.avatar.visible = true;
    this.camYaw = 0;
    this.camPitch = v.typeKey === 'tank' ? -0.08 : -0.15;
    this.camInit = false;
    this.vstick.x = 0;
    this.vstick.y = 0;
    p.flashlight.intensity = 0;
    g.audio.startEngine(v.typeKey);
    const help = {
      ground: v.typeKey === 'tank' ? 'Tank: sol tık / RB top atar' : 'Zombileri ez!',
      heli: 'Space/RT yüksel, C/LT alçal · sol tık/RB makineli, sağ tık/LB bomba',
      plane: 'W/RT gaz · fare/sol çubuk ile yönlendir · sol tık/RB bomba',
    }[v.spec.kind];
    g.hud.toast(`${v.spec.name} — ${help}`);
    g.hud.toast(`İnmek için ${g.input.lastDevice === 'pad' ? 'X / □' : 'E'}`);
  }

  canExit(v) {
    const st = v.state;
    if (v.isAir) {
      const ground = this.game.collision.groundHeight(st.x, st.z, 1.2, st.y + 0.01, 0.5);
      return st.y - ground < 3 && st.speed < 5;
    }
    return Math.abs(st.speed) < 7;
  }

  exit(force = false) {
    const g = this.game;
    const v = this.current;
    if (!v) return;
    const p = g.player;
    const st = v.state;
    const fx = -Math.sin(st.yaw);
    const fz = -Math.cos(st.yaw);
    const rx = Math.cos(st.yaw);
    const rz = -Math.sin(st.yaw);
    const side = v.spec.width / 2 + 1.1;
    const back = v.spec.length / 2 + 1.1;
    const candidates = [[-rx * side, -rz * side], [rx * side, rz * side], [-fx * back, -fz * back], [fx * back, fz * back]];
    let spot = null;
    for (const [dx, dz] of candidates) {
      const x = st.x + dx;
      const z = st.z + dz;
      if (!g.collision.blockedAt(x, z, 0.45, 1.8)) {
        spot = [x, z];
        break;
      }
    }
    if (!spot) spot = [st.x + candidates[0][0], st.z + candidates[0][1]];
    const ground = g.collision.groundHeight(spot[0], spot[1], 0.4, st.y + 1, 2);
    p.pos.set(spot[0], ground, spot[1]);
    p.vel.set(0, 0, 0);
    p.yaw = st.yaw + this.camYaw;
    p.pitch = 0;
    p.vehicle = null;
    v.avatar.visible = false;
    this.current = null;
    this.refueling = false;
    g.audio.setPouring(false);
    g.audio.stopEngine();
    this.headlight.intensity = 0;
    if (!force && !v.isAir) st.speed = 0;
    if (v.alive && (st.onGround || !v.isAir)) {
      st.speed = 0;
      this.park(v);
    }
  }

  // Sürücüsüz kalan hava aracı düşer
  fallUnmanned(v, dt) {
    const st = v.state;
    st.vy -= 9.8 * dt;
    st.y += st.vy * dt;
    st.x += -Math.sin(st.yaw) * st.speed * dt;
    st.z += -Math.cos(st.yaw) * st.speed * dt;
    st.speed = damp(st.speed, 0, 0.5, dt);
    const ground = this.game.collision.groundHeight(st.x, st.z, 1, st.y + 0.01, 0.5);
    if (st.y <= ground) {
      st.y = ground;
      st.onGround = true;
      if (st.vy < -6) this.destroy(v);
      else {
        st.vy = 0;
        st.speed = 0;
        this.park(v);
      }
    }
    v.syncMesh();
  }

  damage(v, amount, cause = 'hit') {
    if (!v.alive || amount <= 0) return;
    v.hp -= amount;
    if (v === this.current) {
      this.game.input.rumble(Math.min(1, amount / 40), 0.3, 120);
      this.game.player.hurt = Math.min(0.5, this.game.player.hurt + amount / 200);
    }
    if (v.hp <= 0) this.destroy(v, cause);
  }

  destroy(v) {
    if (!v.alive) return;
    const g = this.game;
    v.alive = false;
    const wasCurrent = v === this.current;
    const st = v.state;
    const ground = g.collision.groundHeight(st.x, st.z, 1, st.y + 0.01, 0.5);
    const highUp = st.y - ground > 4;
    const blast = v.center;
    if (wasCurrent) {
      this.exit(true);
      if (highUp) g.player.takeDamage(35, null);
    }
    for (const c of g.children || []) {
      if (c.vehicle !== v) continue;
      c.leaveVehicle(v);
      c.takeDamage(30, null);
    }
    this.unpark(v);
    v.body.traverse((o) => {
      if (o.isMesh) o.material = WRECK;
    });
    v.avatar.visible = false;
    st.y = ground;
    st.pitch = 0;
    st.roll = 0.15;
    st.speed = 0;
    v.syncMesh();
    this.park(v);
    g.hud.toast(`${v.spec.name} patladı!`);
    g.explosives.explode(blast, 6, 140, { source: 'vehicle' });
  }

  onExplosion(p, radius, damage, occluded) {
    for (const v of this.list) {
      if (!v.alive) continue;
      const c = v.center;
      const d = Math.max(0, c.distanceTo(p) - Math.min(v.spec.width, v.spec.length) / 2);
      if (d >= radius) continue;
      const dmg = coveredExplosionDamage(d, radius, damage, occluded(c)) * v.spec.armor;
      if (v === this.current && v.spec.exposed) this.game.player.takeDamage(dmg * 0.5, p);
      this.damage(v, dmg, 'explosion');
    }
  }

  // Kameranın merkezinden nişan noktası
  aimPoint() {
    const g = this.game;
    const cam = g.camera;
    const o = cam.position;
    const d = cam.getWorldDirection(tmp2).clone();
    const max = 220;
    const wh = g.collision.raycast(o.x, o.y, o.z, d.x, d.y, d.z, max);
    let t = wh ? wh.t : max;
    const zh = g.zombies.raycast(o, d, t);
    if (zh) t = zh.t;
    return o.clone().addScaledVector(d, t);
  }

  controls(s, v) {
    const pad = s.padActive;
    const kind = v.spec.kind;
    if (kind === 'ground') {
      return {
        throttle: pad && (s.rt || s.lt) ? s.rt - s.lt : s.moveY,
        steer: s.moveX, handbrake: s.jumpHeld, ascend: 0, descend: 0, pitch: 0,
      };
    }
    if (kind === 'heli') {
      return {
        throttle: s.moveY, steer: s.moveX, handbrake: false,
        ascend: Math.max(s.jumpHeld ? 1 : 0, s.rt), descend: Math.max(s.descendHeld ? 1 : 0, s.lt), pitch: 0,
      };
    }
    // Uçak: fare sanal bir kumanda kolu gibi; bırakınca ortalanır
    const decay = Math.exp(-2.5 * (1 / 60));
    this.vstick.x = clamp(this.vstick.x * decay + s.lookX * 4, -1, 1);
    this.vstick.y = clamp(this.vstick.y * decay + s.lookY * 4, -1, 1);
    return {
      throttle: pad ? s.rt - s.lt : s.moveY,
      steer: clamp((pad ? s.moveX : s.moveX + this.vstick.x), -1, 1),
      pitch: pad ? -s.moveY : clamp(-this.vstick.y, -1, 1),
      handbrake: false, ascend: 0, descend: 0,
    };
  }

  update(dt, s) {
    const g = this.game;
    for (const v of this.list) {
      v.cooldown -= dt;
      v.cooldown2 -= dt;
      const active = v === this.current;
      v.rotorSpin = damp(v.rotorSpin, active && v.state.fuel > 0 ? 1 : 0, 1.5, dt);
      if (v.parts.rotor) v.parts.rotor.rotation.y += v.rotorSpin * 28 * dt;
      if (v.parts.tailRotor) v.parts.tailRotor.rotation.x += v.rotorSpin * 40 * dt;
      if (v.parts.prop) v.parts.prop.rotation.z += (v.state.throttleSet * 0.8 + v.rotorSpin * 0.2) * 45 * dt;
      for (const w of v.parts.wheels) w.rotation.x -= v.state.speed * dt * 2;
      if (!active && v.alive && v.isAir && !v.state.onGround) this.fallUnmanned(v, dt);
      // Hasarlı araç dumanı
      if (v.alive && v.hp < v.spec.hp * 0.35) {
        v.smokeT -= dt;
        if (v.smokeT <= 0) {
          v.smokeT = v.hp < v.spec.hp * 0.15 ? 0.05 : 0.15;
          const top = v.center.add(new THREE.Vector3(0, v.spec.height * 0.5, 0));
          g.particles.emit({ pos: top, count: 1, colors: ['#424242', '#616161'], speed: 0.5, up: 1.5, life: 1.4, size: 0.4, gravity: -2, drag: 1.5, grow: 2 });
          if (v.hp < v.spec.hp * 0.15) g.particles.emit({ pos: top, count: 1, colors: ['#ff9800', '#ffeb3b'], speed: 0.5, up: 1, life: 0.3, size: 0.25, glow: true, gravity: -1 });
        }
      }
    }
    if (this.current) {
      if (!g.player.alive) this.exit(true);
      else this.drive(dt, s);
    }
  }

  drive(dt, s) {
    const g = this.game;
    const v = this.current;
    const st = v.state;
    const spec = v.spec;
    if (s.interactPressed) {
      if (this.canExit(v)) {
        this.exit();
        return;
      }
      g.hud.toast(v.isAir ? 'Önce yere in!' : 'Önce yavaşla!');
    }
    const c = this.controls(s, v);
    const col = g.collision;
    g.player.hurt = Math.max(0, g.player.hurt - dt * 1.5);

    if (spec.kind === 'ground') {
      stepGround(st, c, spec, dt);
      this.resolveGround(v, dt);
      this.ram(v, dt);
    } else if (spec.kind === 'heli') {
      const groundY = col.groundHeight(st.x, st.z, 1.4, st.y + 0.01, 0.5);
      stepHeli(st, c, spec, dt, groundY);
      st.y = Math.min(st.y, 90);
      this.resolveAir(v, 1.6, 2.6);
    } else {
      const groundY = col.groundHeight(st.x, st.z, 0.8, st.y + 0.01, 0.3);
      const r = stepPlane(st, c, spec, dt, groundY);
      this.planeBoundary(v, dt);
      if (r.crashed) {
        g.hud.banner('DÜŞTÜN!', 2);
        this.destroy(v);
        return;
      }
      if (this.resolveAir(v, 1.0, 2.0) && st.speed > 12) {
        this.destroy(v);
        return;
      }
    }
    if (st.fuel <= 0 && !v.fuelWarned) {
      v.fuelWarned = true;
      g.hud.toast(`${spec.name}: yakıt bitti! Pompada dur ve doldur.`);
    }
    this.weaponsUpdate(v, s, dt);
    this.refuel(v, dt);
    v.syncMesh();

    // Oyuncuyu koltuğa bağla
    const seat = v.avatar.getWorldPosition(tmp);
    g.player.pos.set(seat.x, seat.y - 0.6, seat.z);
    g.player.yaw = st.yaw + this.camYaw;

    // Farlar gece yanar
    const fwd = v.forward(tmp2);
    const night = g.dayNight.night;
    this.headlight.intensity = 80 * night;
    this.headlight.position.set(st.x + fwd.x * spec.length * 0.5, st.y + 1.2, st.z + fwd.z * spec.length * 0.5);
    const down = spec.kind === 'heli' ? -14 : -1.5;
    this.headlight.target.position.set(st.x + fwd.x * 20, st.y + down, st.z + fwd.z * 20);

    g.audio.setEngine(st.rpm || 0, clamp(Math.abs(st.speed) / spec.maxSpeed, 0, 1), st.fuel > 0);
  }

  resolveGround(v, dt) {
    const g = this.game;
    const st = v.state;
    const spec = v.spec;
    const seg = v.segment();
    const h = spec.height;
    this.smashObjects(v, seg);
    const a = { x: seg.ax, y: st.y + 0.3, z: seg.az };
    const b = { x: seg.bx, y: st.y + 0.3, z: seg.bz };
    g.collision.resolveCircle(a, seg.r, h);
    g.collision.resolveCircle(b, seg.r, h);
    const pushX = (a.x - seg.ax + b.x - seg.bx) / 2;
    const pushZ = (a.z - seg.az + b.z - seg.bz) / 2;
    const push = Math.hypot(pushX, pushZ);
    if (push > 0.005) {
      st.x += pushX;
      st.z += pushZ;
      const impact = Math.abs(st.speed);
      if (impact > 8) {
        this.damage(v, (impact - 8) * 6, 'crash');
        g.audio.play('clank', v.pos, 1);
        g.addShake(Math.min(0.8, impact / 25));
      }
      st.speed *= impact > 3 ? 0.35 : 0.9;
    }
    const lim = MAP_HALF;
    if (Math.abs(st.x) > lim || Math.abs(st.z) > lim) {
      st.x = clamp(st.x, -lim, lim);
      st.z = clamp(st.z, -lim, lim);
      st.speed *= 0.5;
    }
    // Alçak engellerin (kaldırım vb.) üstüne çık, boşlukta düş
    const gh = g.collision.groundHeight(st.x, st.z, Math.max(0.4, spec.width / 2), st.y, 0.6);
    if (gh >= st.y) {
      st.y = gh;
      v.fallVy = 0;
    } else {
      v.fallVy -= 20 * dt;
      st.y = Math.max(gh, st.y + v.fallVy * dt);
    }
  }

  // Hızlı araç sandığı parçalar, varili patlatır (duvar gibi durdurmaz)
  smashObjects(v, seg) {
    const g = this.game;
    const st = v.state;
    if (Math.abs(st.speed) < 4) return;
    const r = seg.r + 0.6;
    const hits = [];
    g.collision.query(Math.min(seg.ax, seg.bx) - r, Math.min(seg.az, seg.bz) - r, Math.max(seg.ax, seg.bx) + r, Math.max(seg.az, seg.bz) + r, (b) => {
      const d = b.data;
      if (!d || (d.kind !== 'barrel' && d.kind !== 'crate')) return;
      const cx = (b.minX + b.maxX) / 2;
      const cz = (b.minZ + b.maxZ) / 2;
      if (v.surfaceDist(cx, cz) < 0.6) hits.push(d);
    });
    for (const d of hits) {
      if (d.kind === 'crate') {
        g.breakCrate(d.ref);
        st.speed *= 0.85;
      } else if (d.ref.alive) {
        g.collision.remove(d.ref.box);
        g.explosives.triggerBarrel(d.ref, 0.12);
      }
    }
  }

  // Döner: çarpışma oldu mu
  resolveAir(v, r, h) {
    const g = this.game;
    const st = v.state;
    const p = { x: st.x, y: st.y, z: st.z };
    const hit = g.collision.resolveCircle(p, r, h);
    if (hit) {
      st.x = p.x;
      st.z = p.z;
      if (st.speed > 8) {
        this.damage(v, (st.speed - 8) * 5, 'crash');
        g.audio.play('clank', v.pos, 1);
      }
      st.speed *= 0.4;
    }
    const lim = MAP_HALF + 30;
    st.x = clamp(st.x, -lim, lim);
    st.z = clamp(st.z, -lim, lim);
    return hit;
  }

  planeBoundary(v, dt) {
    const st = v.state;
    if (st.onGround) return;
    const edge = MAP_HALF - 25;
    if (Math.abs(st.x) > edge || Math.abs(st.z) > edge) {
      const target = Math.atan2(st.x, st.z);
      st.yaw += clamp(angleDiff(st.yaw, target), -1, 1) * 1.1 * dt;
      if (performance.now() - this.boundaryWarned > 4000) {
        this.boundaryWarned = performance.now();
        this.game.hud.toast('Harita sınırı — geri dönülüyor');
      }
    }
  }

  ram(v, dt) {
    const g = this.game;
    const st = v.state;
    const spec = v.spec;
    const speed = Math.abs(st.speed);
    const fwd = v.forward(tmp2).clone().multiplyScalar(Math.sign(st.speed) || 1);
    for (const z of g.zombies.list) {
      if (!z.alive) continue;
      z.ramCd = (z.ramCd || 0) - dt;
      const d = v.surfaceDist(z.pos.x, z.pos.z);
      if (d > z.radius + 0.15 || Math.abs(z.pos.y - st.y) > 2) continue;
      if (speed > 2.5 && z.ramCd <= 0) {
        z.ramCd = 0.5;
        const dmg = spec.crush ? 9999 : ramDamage(speed, spec.ram);
        tmp.subVectors(z.pos, v.pos).setY(0).normalize();
        z.knock.addScaledVector(fwd, (speed * 0.8) / z.scale).addScaledVector(tmp, (speed * 0.4) / z.scale);
        const r = g.zombies.damage(z, dmg, 'body', 'vehicle', fwd);
        g.particles.blood(z.chestPos, fwd, 14);
        g.audio.play('hit', z.pos, 1);
        g.input.rumble(0.4, 0.3, 80);
        if (r.killed) g.stats.roadkills++;
        if (!spec.crush) {
          st.speed *= z.typeKey === 'big' ? 0.4 : 0.9;
          this.damage(v, 2 * z.scale * z.scale, 'ram');
        }
      } else {
        // Yavaşken zombi gövdeye girmesin
        tmp.subVectors(z.pos, v.pos).setY(0);
        const len = tmp.length() || 1;
        const push = z.radius + 0.15 - d;
        z.pos.x += (tmp.x / len) * push;
        z.pos.z += (tmp.z / len) * push;
      }
    }
  }

  weaponsUpdate(v, s, dt) {
    const g = this.game;
    const st = v.state;
    const spec = v.spec;
    const fire = s.mouseFire || s.rb;
    if (v.typeKey === 'tank') {
      const aim = this.aimPoint();
      const turretPos = v.parts.turret.getWorldPosition(tmp);
      const dx = aim.x - turretPos.x;
      const dz = aim.z - turretPos.z;
      const targetYaw = Math.atan2(-dx, -dz) - st.yaw;
      v.turretYaw += clamp(angleDiff(v.turretYaw, targetYaw), -1.6 * dt, 1.6 * dt);
      const targetPitch = clamp(Math.atan2(aim.y - turretPos.y - 0.4, Math.hypot(dx, dz)), -0.12, 0.35);
      v.turretPitch = damp(v.turretPitch, targetPitch, 6, dt);
      v.parts.turret.rotation.y = v.turretYaw;
      v.parts.barrel.rotation.x = v.turretPitch;
      if (fire && v.cooldown <= 0) {
        v.cooldown = spec.cannon.interval;
        const q = v.parts.barrel.getWorldQuaternion(new THREE.Quaternion());
        const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(q);
        const tip = v.parts.barrel.getWorldPosition(new THREE.Vector3()).addScaledVector(dir, 4.2);
        g.explosives.fireRocket(tip, dir, 'player', spec.cannon);
        g.particles.emit({ pos: tip, count: 14, colors: ['#ffeb3b', '#ff9800', '#9e9e9e'], speed: 4, life: 0.4, size: 0.3, glow: true, gravity: 0, drag: 3 });
        g.audio.play('cannon');
        g.addShake(0.5);
        g.input.rumble(1, 0.8, 300);
        g.zombies.alert(v.pos, 50);
        st.speed -= 1.5;
      }
    } else if (v.typeKey === 'heli') {
      if (fire && v.cooldown <= 0 && !st.onGround) {
        v.cooldown = spec.gun.interval;
        const nose = v.body.localToWorld(new THREE.Vector3(0, 0.9, -3.6));
        const aim = this.aimPoint();
        const dir = aim.sub(nose).normalize();
        dir.x += rand(-1, 1) * spec.gun.spread;
        dir.y += rand(-1, 1) * spec.gun.spread;
        dir.z += rand(-1, 1) * spec.gun.spread;
        dir.normalize();
        const res = g.weapons.hitscan(nose, dir, spec.gun);
        g.particles.tracer(nose, res.point);
        if (res.hitZombie) g.hud.hitMarker(res.killed);
        g.audio.play('smg', null, 0.7);
        g.zombies.alert(v.pos, 40);
      }
      if (s.secondary && v.cooldown2 <= 0 && !st.onGround) this.dropBomb(v);
    } else if (v.typeKey === 'plane') {
      if ((fire || s.secondary) && v.cooldown2 <= 0 && !st.onGround) this.dropBomb(v);
    }
  }

  dropBomb(v) {
    const g = this.game;
    const st = v.state;
    v.cooldown2 = v.spec.bomb.interval;
    const fwd = v.forward(tmp2);
    const origin = new THREE.Vector3(st.x, st.y - 0.3, st.z);
    const h = Math.cos(st.pitch) * st.speed;
    const vel = new THREE.Vector3(fwd.x * h, st.vy || 0, fwd.z * h);
    g.explosives.dropBomb(origin, vel, v.spec.bomb.radius, v.spec.bomb.damage);
    g.audio.play('throw');
  }

  refuel(v, dt) {
    const g = this.game;
    const st = v.state;
    let near = false;
    if (Math.abs(st.speed) < 0.6 && (st.onGround || !v.isAir) && st.fuel < v.spec.fuel) {
      for (const p of g.world.fuelPoints) {
        if (Math.hypot(p.x - st.x, p.z - st.z) < 7) near = true;
      }
    }
    if (near) {
      st.fuel = Math.min(v.spec.fuel, st.fuel + v.spec.fuel * 0.2 * dt);
      v.fuelWarned = false;
      g.prompt = { text: `Yakıt dolduruluyor %${Math.round((st.fuel / v.spec.fuel) * 100)}`, progress: st.fuel / v.spec.fuel, noKey: true };
    }
    if (near !== this.refueling) {
      this.refueling = near;
      g.audio.setPouring(near);
    }
  }

  updateCamera(dt, s) {
    const g = this.game;
    const v = this.current;
    if (!v) return;
    const st = v.state;
    const spec = v.spec;
    const cam = g.camera;
    const [dist, height] = spec.cam;
    if (spec.kind !== 'plane') {
      this.camYaw -= s.lookX;
      this.camPitch = clamp(this.camPitch - s.lookY, -0.9, 0.45);
      const looking = Math.abs(s.lookX) + Math.abs(s.lookY) > 1e-4;
      this.lookIdle = looking ? 0 : this.lookIdle + dt;
      if (this.lookIdle > 1.5 && v.typeKey !== 'tank') {
        this.camYaw = damp(this.camYaw, 0, 2, dt);
        this.camPitch = damp(this.camPitch, -0.15, 2, dt);
      }
    } else {
      this.camYaw = 0;
      this.camPitch = damp(this.camPitch, -0.12 - st.pitch * 0.5, 4, dt);
    }
    const yaw = st.yaw + this.camYaw;
    const pitch = this.camPitch;
    const target = new THREE.Vector3(st.x, st.y + spec.height * 0.75, st.z);
    const back = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), -Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
    const desired = target.clone().addScaledVector(back, dist).add(new THREE.Vector3(0, height * 0.35, 0));
    // Kamera duvarın içine girmesin
    const dir = desired.clone().sub(target);
    const len = dir.length();
    dir.divideScalar(len);
    const hit = g.collision.raycast(target.x, target.y, target.z, dir.x, dir.y, dir.z, len);
    if (hit) desired.copy(target).addScaledVector(dir, Math.max(1.5, hit.t - 0.4));
    desired.y = Math.max(desired.y, 0.6);
    if (!this.camInit) {
      this.camPos.copy(desired);
      this.camInit = true;
    } else {
      this.camPos.lerp(desired, 1 - Math.exp(-6 * dt));
    }
    const shake = g.shake;
    cam.position.copy(this.camPos).add(new THREE.Vector3((Math.random() - 0.5) * shake * 0.3, (Math.random() - 0.5) * shake * 0.3, 0));
    const look = target.clone().addScaledVector(back, -6).add(new THREE.Vector3(0, 1.2, 0));
    cam.lookAt(look);
    // Hız hissi: hızlandıkça görüş açısı biraz genişler
    const fov = 70 + clamp(Math.abs(st.speed) / spec.maxSpeed, 0, 1) * 8;
    if (Math.abs(cam.fov - fov) > 0.05) {
      cam.fov = damp(cam.fov, fov, 4, dt);
      cam.updateProjectionMatrix();
    }
  }
}
