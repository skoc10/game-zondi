import * as THREE from 'three';
import { part } from '../world/materials.js';
import { clamp, damp, angleDiff, rand } from '../core/math.js';
import { MAP_HALF } from '../world/World.js';
import { followSpeed, followDistance, pickBreadcrumb, boardingRule, CHILD_BOARD_DIST } from './childLogic.js';

// Kurtarılacak çocuk. Renkli yağmurluk (zombilerden ayırt edilsin diye yeşil değil).
export class Child {
  constructor(game, x, z, opts = {}) {
    this.game = game;
    this.name = opts.name || 'Deniz';
    this.coat = opts.coat || '#fdd835';
    this.pitch = opts.pitch || 1;
    this.order = 0;
    this.pos = new THREE.Vector3(x, 0, z);
    this.yaw = 0;
    this.state = 'hiding'; // hiding | following | inVehicle | dead | safe
    this.health = 80;
    this.maxHealth = 80;
    this.radius = 0.3;
    this.vehicle = null;
    this.trail = [];
    this.trailTimer = 0;
    this.phase = 0;
    this.cryTimer = 2;
    this.hurt = 0;
    this.farWarned = 0;
    this.stuck = 0;
    this.sideSign = 1;
    this.lastPos = this.pos.clone();
    this.buildMesh();
  }

  buildMesh() {
    const g = new THREE.Group();
    const inner = new THREE.Group();
    g.add(inner);
    this.inner = inner;
    this.legL = new THREE.Group();
    this.legR = new THREE.Group();
    this.legL.position.set(-0.09, 0.5, 0);
    this.legR.position.set(0.09, 0.5, 0);
    part(this.legL, 0.14, 0.5, 0.16, 0, -0.25, 0, '#1e3a6e');
    part(this.legR, 0.14, 0.5, 0.16, 0, -0.25, 0, '#1e3a6e');
    inner.add(this.legL, this.legR);
    this.bodyMat = part(inner, 0.4, 0.45, 0.26, 0, 0.73, 0, this.coat).material.clone();
    inner.children[inner.children.length - 1].material = this.bodyMat;
    this.armL = new THREE.Group();
    this.armR = new THREE.Group();
    this.armL.position.set(-0.26, 0.93, 0);
    this.armR.position.set(0.26, 0.93, 0);
    part(this.armL, 0.11, 0.42, 0.12, 0, -0.2, 0, this.coat);
    part(this.armR, 0.11, 0.42, 0.12, 0, -0.2, 0, this.coat);
    inner.add(this.armL, this.armR);
    part(inner, 0.3, 0.3, 0.3, 0, 1.12, 0, '#f1c27d');
    part(inner, 0.32, 0.12, 0.32, 0, 1.3, 0.02, '#4e342e');
    part(inner, 0.05, 0.05, 0.02, -0.07, 1.14, -0.155, '#222');
    part(inner, 0.05, 0.05, 0.02, 0.07, 1.14, -0.155, '#222');
    g.position.copy(this.pos);
    this.mesh = g;
    this.game.scene.add(g);
  }

  get alive() {
    return this.state !== 'dead';
  }

  // Zombiler hedef alabilir mi (yaya ve hayatta)
  get targetable() {
    return this.state === 'hiding' || this.state === 'following';
  }

  get center() {
    return new THREE.Vector3(this.pos.x, this.pos.y + 0.75, this.pos.z);
  }

  follow() {
    this.state = 'following';
    this.trail = [];
  }

  takeDamage(amount, fromPos) {
    if (!this.alive || this.state === 'safe' || amount <= 0) return;
    this.health = Math.max(0, this.health - amount);
    this.hurt = 0.25;
    this.game.audio.play('child', this.pos, 1, this.pitch * 1.2);
    if (this.health <= 0) {
      this.state = 'dead';
      if (this.vehicle) this.detach();
      this.game.onChildDied(this);
    } else if (fromPos && this.state === 'following') {
      // Vurulunca oyuncuya doğru sıçrar
      this.panicTime = 1;
    }
  }

  // seat: araçtaki kaçıncı yolcu (0 = ön koltuk)
  attachTo(v, seat = 0) {
    this.vehicle = v;
    this.state = 'inVehicle';
    const [sx, sy, sz] = v.spec.seat;
    this.mesh.position.set(0, 0, 0);
    this.mesh.rotation.set(0, 0, 0);
    if (v.typeKey === 'motorcycle') this.mesh.position.set(0, sy - 0.05, sz + 0.55);
    else if (seat === 0) this.mesh.position.set(-sx, sy - 0.3, sz);
    else this.mesh.position.set(seat === 1 ? -0.45 : 0.45, sy - 0.3, sz + 1.1);
    this.inner.position.y = 0;
    this.legL.rotation.x = -1.3;
    this.legR.rotation.x = -1.3;
    v.body.add(this.mesh);
  }

  detach() {
    const v = this.vehicle;
    if (!v) return;
    v.body.remove(this.mesh);
    this.game.scene.add(this.mesh);
    this.vehicle = null;
  }

  leaveVehicle(v) {
    this.detach();
    const st = v.state;
    const rx = Math.cos(st.yaw);
    const rz = -Math.sin(st.yaw);
    const side = v.spec.width / 2 + 1;
    this.pos.set(st.x + rx * side, 0, st.z + rz * side);
    this.legL.rotation.x = 0;
    this.legR.rotation.x = 0;
    if (this.alive) this.state = 'following';
    this.trail = [];
  }

  update(dt) {
    const g = this.game;
    const p = g.player;
    this.hurt = Math.max(0, this.hurt - dt);
    this.bodyMat.emissive.setRGB(this.hurt * 4, 0, 0);

    if (this.state === 'dead') {
      this.inner.rotation.x = damp(this.inner.rotation.x, -Math.PI / 2, 8, dt);
      return;
    }
    if (this.state === 'inVehicle') {
      // Oyuncu inerse o da iner
      if (p.vehicle !== this.vehicle) this.leaveVehicle(this.vehicle);
      else {
        const wp = this.mesh.getWorldPosition(new THREE.Vector3());
        this.pos.set(wp.x, 0, wp.z);
        return;
      }
    }
    if (this.state === 'safe') {
      this.animate(dt, 0);
      return;
    }

    // Ağlama/imdat sesi
    this.cryTimer -= dt;
    const pd = Math.hypot(p.pos.x - this.pos.x, p.pos.z - this.pos.z);
    if (this.cryTimer <= 0) {
      this.cryTimer = this.state === 'hiding' ? rand(4, 7) : rand(8, 14);
      if (pd < 45) g.audio.play('child', this.pos, this.state === 'hiding' ? 0.9 : 0.5, 1);
    }

    if (this.state === 'hiding') {
      // Sıranın arkasında çömelmiş, titriyor
      this.inner.position.y = -0.25;
      this.inner.rotation.x = 0.25;
      this.inner.position.x = Math.sin(performance.now() / 60) * 0.01;
      return;
    }
    this.inner.position.y = damp(this.inner.position.y, 0, 8, dt);
    this.inner.rotation.x = damp(this.inner.rotation.x, 0, 8, dt);

    // Oyuncu araçtaysa yakındaysa biner (koltuk varsa)
    if (p.vehicle) {
      const kids = g.children || [];
      const occupied = kids.filter((c) => c.vehicle === p.vehicle).length;
      const rule = boardingRule(p.vehicle.spec.seats || 0, occupied);
      const vd = p.vehicle.surfaceDist(this.pos.x, this.pos.z);
      if (rule.ok && vd < CHILD_BOARD_DIST) {
        this.attachTo(p.vehicle, occupied);
        g.hud.toast(`${this.name} araca bindi`);
        return;
      }
      if (!rule.ok && vd < CHILD_BOARD_DIST && performance.now() - (this.ruleWarned || 0) > 4000) {
        this.ruleWarned = performance.now();
        g.hud.toast(`${this.name}: ${rule.reason}`);
      }
    }

    // Oyuncunun izi
    this.trailTimer -= dt;
    if (this.trailTimer <= 0) {
      this.trailTimer = 0.4;
      const last = this.trail[this.trail.length - 1];
      if (!last || Math.hypot(last.x - p.pos.x, last.z - p.pos.z) > 1) {
        this.trail.push({ x: p.pos.x, z: p.pos.z });
        if (this.trail.length > 80) this.trail.shift();
      }
    }

    // Yakındaki zombiden panik
    let panic = false;
    for (const z of g.zombies.list) {
      if (z.alive && Math.abs(z.pos.x - this.pos.x) < 4 && Math.abs(z.pos.z - this.pos.z) < 4 && z.pos.distanceTo(this.pos) < 4) {
        panic = true;
        break;
      }
    }
    if (this.panicTime > 0) {
      this.panicTime -= dt;
      panic = true;
    }

    // Hedef: oyuncuyu görüyorsa doğrudan, görmüyorsa izden
    const col = g.collision;
    const see = (t) => col.lineOfSight(this.pos.x, 0.8, this.pos.z, t.x, 0.8, t.z);
    let target = { x: p.pos.x, z: p.pos.z };
    if (!see(target)) {
      const crumb = pickBreadcrumb(this.trail, see);
      if (crumb) target = crumb;
    }
    const dx = target.x - this.pos.x;
    const dz = target.z - this.pos.z;
    const td = Math.hypot(dx, dz) || 1;
    const speed = followSpeed(pd, panic, followDistance(this.order));
    let mx = speed > 0 ? dx / td : 0;
    let mz = speed > 0 ? dz / td : 0;
    // Takılırsa yana kay; uzun süre ilerleyemezse oyuncunun arkasına geçer
    this.stuck += dt;
    if (this.stuck > 0.8) {
      if (speed > 1 && this.pos.distanceTo(this.lastPos) < speed * 0.8 * 0.3) {
        this.sidestep = rand(0.6, 1.2);
        this.sideSign = Math.random() < 0.5 ? 1 : -1;
        this.blockedTime = (this.blockedTime || 0) + this.stuck;
      } else {
        this.blockedTime = 0;
      }
      this.lastPos.copy(this.pos);
      this.stuck = 0;
    }
    if (this.blockedTime > 5 && pd > 12) {
      this.blockedTime = 0;
      this.catchUp();
    }
    if (this.sidestep > 0) {
      this.sidestep -= dt;
      const sx = -mz * this.sideSign;
      const sz = mx * this.sideSign;
      mx = mx * 0.3 + sx;
      mz = mz * 0.3 + sz;
    }
    this.pos.x += mx * speed * dt;
    this.pos.z += mz * speed * dt;
    col.resolveCircle(this.pos, this.radius, 1.3);
    this.pos.x = clamp(this.pos.x, -MAP_HALF, MAP_HALF);
    this.pos.z = clamp(this.pos.z, -MAP_HALF, MAP_HALF);
    if (speed > 0.1) this.yaw += angleDiff(this.yaw, Math.atan2(mx, mz)) * Math.min(1, dt * 10);

    // Çok geride kalırsa uyarı
    if (pd > 25 && performance.now() - this.farWarned > 6000) {
      this.farWarned = performance.now();
      g.radio.say(this.name, 'Bekle beni! Çok hızlısın!');
    }
    this.animate(dt, speed);
  }

  // Oyuncunun arkasında boş bir yere geç (yol bulamadığında)
  catchUp() {
    const g = this.game;
    const p = g.player;
    for (const back of [2.5, 3.5, 1.8]) {
      for (const side of [0, 1.2, -1.2]) {
        const x = p.pos.x + Math.sin(p.yaw) * back + Math.cos(p.yaw) * side;
        const z = p.pos.z + Math.cos(p.yaw) * back - Math.sin(p.yaw) * side;
        if (!g.collision.blockedAt(x, z, 0.35, 1.3)) {
          this.pos.set(x, 0, z);
          this.trail = [];
          return;
        }
      }
    }
  }

  animate(dt, speed) {
    this.phase += dt * (3 + speed * 3);
    const sw = Math.sin(this.phase) * Math.min(0.9, speed * 0.25);
    this.legL.rotation.x = sw;
    this.legR.rotation.x = -sw;
    this.armL.rotation.x = -sw;
    this.armR.rotation.x = sw;
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.yaw + Math.PI;
  }

  remove() {
    this.detach();
    this.game.scene.remove(this.mesh);
  }
}
