import * as THREE from 'three';
import { BOX_GEO } from '../world/materials.js';

const CAP = 700;
const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpE = new THREE.Euler();
const tmpS = new THREE.Vector3();
const tmpP = new THREE.Vector3();
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

// Küp parçacıklar (kutu dünyasına uygun). İki havuz: ışıktan etkilenen ve parlayan.
class Pool {
  constructor(scene, material) {
    this.mesh = new THREE.InstancedMesh(BOX_GEO, material, CAP);
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const c = new THREE.Color();
    for (let i = 0; i < CAP; i++) {
      this.mesh.setMatrixAt(i, ZERO);
      this.mesh.setColorAt(i, c);
    }
    scene.add(this.mesh);
    this.items = [];
    this.free = [];
    for (let i = CAP - 1; i >= 0; i--) this.free.push(i);
  }

  spawn(p) {
    let idx = this.free.pop();
    if (idx === undefined) {
      const old = this.items.shift();
      idx = old.idx;
    }
    p.idx = idx;
    this.mesh.setColorAt(idx, p.color);
    this.items.push(p);
  }

  update(dt) {
    const items = this.items;
    for (let i = items.length - 1; i >= 0; i--) {
      const p = items[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.mesh.setMatrixAt(p.idx, ZERO);
        this.free.push(p.idx);
        items.splice(i, 1);
        continue;
      }
      p.vel.y -= p.gravity * dt;
      p.vel.multiplyScalar(Math.max(0, 1 - p.drag * dt));
      p.pos.addScaledVector(p.vel, dt);
      if (p.pos.y < p.size * 0.5) {
        p.pos.y = p.size * 0.5;
        p.vel.y *= -0.3;
        p.vel.x *= 0.6;
        p.vel.z *= 0.6;
      }
      p.rot += p.spin * dt;
      const k = p.life / p.maxLife;
      const s = p.size * (p.grow ? 1 + (1 - k) * p.grow : Math.min(1, k * 3));
      tmpS.set(s, s, s);
      tmpQ.setFromEuler(tmpE.set(p.rot, p.rot * 0.7, 0));
      tmpM.compose(p.pos, tmpQ, tmpS);
      this.mesh.setMatrixAt(p.idx, tmpM);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

export class Particles {
  constructor(scene) {
    this.scene = scene;
    this.lit = new Pool(scene, new THREE.MeshLambertMaterial({ color: '#ffffff' }));
    this.glow = new Pool(scene, new THREE.MeshBasicMaterial({ color: '#ffffff', fog: false }));
    this.tracers = [];
    const tracerMat = new THREE.MeshBasicMaterial({ color: '#ffe082', transparent: true, opacity: 0.9, fog: false });
    for (let i = 0; i < 24; i++) {
      const m = new THREE.Mesh(BOX_GEO, tracerMat.clone());
      m.visible = false;
      scene.add(m);
      this.tracers.push({ mesh: m, life: 0 });
    }
    this.tracerIdx = 0;
    this.decals = [];
    this.decalIdx = 0;
    const decalGeo = new THREE.CircleGeometry(1, 14);
    for (let i = 0; i < 50; i++) {
      const m = new THREE.Mesh(decalGeo, new THREE.MeshLambertMaterial({
        color: '#111', transparent: true, opacity: 0.7, depthWrite: false,
        polygonOffset: true, polygonOffsetFactor: -2,
      }));
      m.rotation.x = -Math.PI / 2;
      m.visible = false;
      m.receiveShadow = true;
      scene.add(m);
      this.decals.push(m);
    }
  }

  // opts: pos, count, colors[], speed, up, spread, life, size, gravity, drag, glow, grow, dir
  emit(o) {
    const pool = o.glow ? this.glow : this.lit;
    const colors = o.colors || ['#ffffff'];
    for (let i = 0; i < (o.count || 10); i++) {
      const v = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5)
        .normalize()
        .multiplyScalar((o.speed || 4) * (0.4 + Math.random() * 0.8));
      if (o.dir) v.addScaledVector(o.dir, (o.dirSpeed || 0) * (0.6 + Math.random() * 0.6));
      v.y += (o.up || 0) * (0.5 + Math.random());
      const life = (o.life || 0.8) * (0.6 + Math.random() * 0.8);
      pool.spawn({
        pos: tmpP.copy(o.pos).add(new THREE.Vector3(
          (Math.random() - 0.5) * (o.spread || 0),
          (Math.random() - 0.5) * (o.spread || 0),
          (Math.random() - 0.5) * (o.spread || 0),
        )).clone(),
        vel: v,
        life,
        maxLife: life,
        size: (o.size || 0.1) * (0.6 + Math.random() * 0.8),
        gravity: o.gravity ?? 9.8,
        drag: o.drag ?? 0.5,
        color: new THREE.Color(colors[Math.floor(Math.random() * colors.length)]),
        rot: Math.random() * 6,
        spin: (Math.random() - 0.5) * 12,
        grow: o.grow || 0,
      });
    }
  }

  blood(pos, dir, amount = 10) {
    this.emit({ pos, count: amount, colors: ['#4caf50', '#2e7d32', '#76ff03', '#1b5e20'], speed: 3, up: 1.5, dir, dirSpeed: 2, life: 0.7, size: 0.09 });
  }

  sparks(pos, normalish) {
    this.emit({ pos, count: 6, colors: ['#ffd54f', '#ffb300', '#fff'], speed: 4, up: 1, dir: normalish, dirSpeed: 2, life: 0.25, size: 0.04, glow: true });
    this.emit({ pos, count: 4, colors: ['#8d8d8d', '#6d6d6d'], speed: 1.5, up: 1, life: 0.5, size: 0.07, gravity: 2 });
  }

  explosion(pos, radius) {
    const s = radius / 6;
    this.emit({ pos, count: Math.round(40 * s), colors: ['#ffeb3b', '#ff9800', '#ff5722', '#fff3e0'], speed: 9 * s, up: 3, life: 0.5, size: 0.35 * s, glow: true, gravity: -1, drag: 3, grow: 1.5 });
    this.emit({ pos, count: Math.round(22 * s), colors: ['#424242', '#616161', '#303030'], speed: 3 * s, up: 3, life: 1.8, size: 0.6 * s, gravity: -2.5, drag: 1.5, grow: 2 });
    this.emit({ pos, count: Math.round(18 * s), colors: ['#3e2723', '#212121', '#5d4037'], speed: 10 * s, up: 6, life: 1.4, size: 0.14, gravity: 18, drag: 0.3 });
  }

  tracer(from, to, color = '#ffe082') {
    const t = this.tracers[this.tracerIdx++ % this.tracers.length];
    const len = from.distanceTo(to);
    t.mesh.position.copy(from).lerp(to, 0.5);
    t.mesh.lookAt(to);
    t.mesh.scale.set(0.025, 0.025, len);
    t.mesh.material.color.set(color);
    t.mesh.material.opacity = 0.9;
    t.mesh.visible = true;
    t.life = 0.06;
  }

  decal(x, z, size, color = '#111', opacity = 0.7) {
    const m = this.decals[this.decalIdx++ % this.decals.length];
    m.position.set(x, 0.035 + (this.decalIdx % 10) * 0.001, z);
    m.scale.setScalar(size);
    m.rotation.z = Math.random() * 6;
    m.material.color.set(color);
    m.material.opacity = opacity;
    m.visible = true;
  }

  update(dt) {
    this.lit.update(dt);
    this.glow.update(dt);
    for (const t of this.tracers) {
      if (t.life <= 0) continue;
      t.life -= dt;
      t.mesh.material.opacity = Math.max(0, t.life / 0.06);
      if (t.life <= 0) t.mesh.visible = false;
    }
  }
}
