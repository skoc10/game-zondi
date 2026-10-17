import * as THREE from 'three';
import { boxFromBase } from '../core/Collision.js';
import { World } from './World.js';
import { box, mat, glowMat, part } from './materials.js';

// 4. bölüm (b): uzaylıların ele geçirdiği uzay istasyonu.
// Modüller -Z yönünde dizili: yanaşma → laboratuvar → sera → çekirdek odası.
export const STATION = {
  start: { x: 0, z: -6 },
  rooms: [
    { key: 'dock', name: 'Yanaşma bölmesi', x: 0, z: -10, w: 20, d: 20, h: 6 },
    { key: 'lab', name: 'Laboratuvar', x: 0, z: -50, w: 26, d: 20, h: 6 },
    { key: 'garden', name: 'Sera', x: 0, z: -92, w: 26, d: 24, h: 7 },
    { key: 'core', name: 'Çekirdek odası', x: 0, z: -142, w: 38, d: 36, h: 11 },
  ],
  // Odalar arası koridorlar [z başı, z sonu]
  halls: [[-20, -40], [-60, -80], [-104, -124]],
  hallW: 6,
};

// Sabit ışıklandırma: gece-gündüz yok, aynı arayüz
export class StaticLighting {
  constructor(scene) {
    this.scene = scene;
    this.time = 0;
    this.night = 0;
    this.hemi = new THREE.HemisphereLight('#cfd8ff', '#2a2440', 1.1);
    scene.add(this.hemi);
    scene.background = new THREE.Color('#000005');
    scene.fog = new THREE.Fog('#000005', 80, 420);
  }

  get isNight() {
    return false;
  }

  get phaseTime() {
    return 0;
  }

  // Saat yerine yörüngede geçen süre
  phaseInfo() {
    return { label: 'Yörüngede', remaining: this.time, icon: '✦' };
  }

  reset() {}

  update(dt) {
    this.time += dt;
  }
}

export class SpaceWorld extends World {
  build() {
    this.level = 4;
    this.car = null;
    this.forceFields = [];
    this.buildSky();
    for (const r of STATION.rooms) this.room(r);
    STATION.halls.forEach(([z1, z2]) => this.hall(z1, z2));
    // Odalar arası enerji kalkanlı kapılar (oda temizlenince açılır)
    this.forceField(-40);
    this.forceField(-80);
    this.forceField(-124);
    this.decorate();
  }

  buildSky() {
    // Yıldızlar
    const n = 1500;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(350 + Math.random() * 40);
      pos.set([v.x, v.y, v.z], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const stars = new THREE.Points(geo, new THREE.PointsMaterial({ color: '#ffffff', size: 1.2, sizeAttenuation: false, fog: false }));
    this.root.add(stars);
    // Dünya: okyanus + kıtalar + bulutlar
    const earth = new THREE.Group();
    earth.add(new THREE.Mesh(new THREE.SphereGeometry(90, 40, 24), new THREE.MeshBasicMaterial({ color: '#1565c0', fog: false })));
    const land = new THREE.MeshBasicMaterial({ color: '#43a047', fog: false });
    for (let i = 0; i < 14; i++) {
      const c = new THREE.Mesh(new THREE.SphereGeometry(90.4, 12, 8, Math.random() * 6, 0.5 + Math.random() * 0.6, Math.random() * 2.5, 0.4 + Math.random() * 0.5), land);
      earth.add(c);
    }
    earth.add(new THREE.Mesh(new THREE.SphereGeometry(92, 32, 20), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.18, fog: false })));
    earth.add(new THREE.Mesh(new THREE.SphereGeometry(96, 32, 20), new THREE.MeshBasicMaterial({ color: '#4fc3f7', transparent: true, opacity: 0.12, side: THREE.BackSide, fog: false })));
    earth.position.set(165, -25, -85);
    this.root.add(earth);
    this.earth = earth;
  }

  // Oda: zemin, tavan, duvarlar (kuzey/güney kapı boşlukları, yan duvarlarda pencereler)
  room(r) {
    const { x, z, w, d, h } = r;
    const t = 0.5;
    const metal = '#8a93a5';
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat('#4b5263'));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(x, 0.01, z);
    floor.receiveShadow = true;
    this.root.add(floor);
    // Zemin çizgileri
    for (let i = -w / 2 + 2; i < w / 2; i += 4) {
      const l = new THREE.Mesh(new THREE.PlaneGeometry(0.08, d), mat('#3a4050'));
      l.rotation.x = -Math.PI / 2;
      l.position.set(x + i, 0.02, z);
      this.root.add(l);
    }
    this.block(x, h, z, w + t, 0.4, d + t, '#6b7385');
    // Tavan ışık şeritleri
    for (let i = -d / 2 + 3; i < d / 2; i += 5) {
      const strip = box(w * 0.6, 0.08, 0.3, glowMat('#b3e5fc', 1.6));
      strip.position.set(x, h - 0.05, z + i);
      strip.castShadow = false;
      this.root.add(strip);
    }
    const gap = STATION.hallW;
    // Kuzey (-z) ve güney (+z) duvarları, ortada kapı (ilk odanın güneyi kapalı, son odanın kuzeyi kapalı)
    const first = r.key === 'dock';
    const last = r.key === 'core';
    for (const [wz, open] of [[z - d / 2, !last], [z + d / 2, !first]]) {
      if (open) {
        const seg = (w - gap) / 2;
        this.block(x - gap / 2 - seg / 2, 0, wz, seg, h, t, metal);
        this.block(x + gap / 2 + seg / 2, 0, wz, seg, h, t, metal);
        this.block(x, 3.6, wz, gap, h - 3.6, t, metal);
      } else {
        this.block(x, 0, wz, w, h, t, metal);
      }
    }
    // Doğu ve batı duvarları: pencereli (dışarıda Dünya)
    for (const wx of [x - w / 2, x + w / 2]) {
      const winD = Math.min(8, d - 6);
      const seg = (d - winD) / 2;
      this.block(wx, 0, z - winD / 2 - seg / 2, t, h, seg, metal);
      this.block(wx, 0, z + winD / 2 + seg / 2, t, h, seg, metal);
      this.block(wx, 0, z, t, 1.2, winD, metal);
      this.block(wx, 4.2, z, t, h - 4.2, winD, metal);
      const glass = new THREE.Mesh(new THREE.BoxGeometry(0.1, 3, winD), new THREE.MeshBasicMaterial({ color: '#80d8ff', transparent: true, opacity: 0.12, depthWrite: false }));
      glass.position.set(wx, 2.7, z);
      this.root.add(glass);
      this.collision.add(boxFromBase(wx, 1.2, z, t, 3, winD, { kind: 'static' }));
    }
    const light = new THREE.PointLight('#cfe8ff', 30, Math.max(w, d) * 1.2, 1.4);
    light.position.set(x, h - 1, z);
    this.root.add(light);
  }

  hall(z1, z2) {
    const w = STATION.hallW;
    const len = Math.abs(z2 - z1);
    const cz = (z1 + z2) / 2;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, len), mat('#454b5a'));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0.01, cz);
    this.root.add(floor);
    this.block(-w / 2 - 0.25, 0, cz, 0.5, 4, len, '#7d8698');
    this.block(w / 2 + 0.25, 0, cz, 0.5, 4, len, '#7d8698');
    this.block(0, 4, cz, w + 1, 0.4, len, '#6b7385');
    for (let z = Math.max(z1, z2) - 2; z > Math.min(z1, z2); z -= 4) {
      for (const sx of [-1, 1]) {
        const l = box(0.1, 0.12, 1.4, glowMat('#00e5ff', 1.5));
        l.position.set(sx * (w / 2 - 0.05), 0.3, z);
        l.castShadow = false;
        this.root.add(l);
      }
    }
  }

  forceField(z) {
    const w = STATION.hallW;
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 3.6, 0.2), new THREE.MeshBasicMaterial({ color: '#00e5ff', transparent: true, opacity: 0.35, depthWrite: false }));
    m.position.set(0, 1.8, z);
    this.root.add(m);
    const ff = { mesh: m, z, open: false };
    ff.box = this.collision.add(boxFromBase(0, 0, z, w, 3.6, 0.6, { kind: 'static' }));
    this.forceFields.push(ff);
  }

  openForceField(i) {
    const ff = this.forceFields[i];
    if (!ff || ff.open) return;
    ff.open = true;
    this.root.remove(ff.mesh);
    this.collision.remove(ff.box);
  }

  decorate() {
    const crystal = (x, z, s = 1) => {
      const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.8 * s), glowMat('#e040fb', 1.2));
      c.position.set(x, 0.8 * s, z);
      c.scale.y = 1.8;
      this.root.add(c);
    };
    // Yanaşma bölmesi: kargo sandıkları, uzay mekiği burnu
    this.addCrate(-6, -4, 'ammo', true);
    this.addCrate(6, -16, 'medkit', true);
    this.block(-7, 0, -15, 3, 2, 3, '#455a64');
    // Laboratuvar: masalar, tüpler, uzaylı kristalleri
    for (const dx of [-8, 0, 8]) this.block(dx, 0, -46, 3, 1, 1.4, '#cfd8dc');
    for (const dx of [-9, 9]) {
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 3, 12), glowMat('#e040fb', 0.6));
      tube.position.set(dx, 1.5, -56);
      this.root.add(tube);
      this.collision.add(boxFromBase(dx, 0, -56, 1.6, 3, 1.6, { kind: 'static' }));
    }
    crystal(-10, -42);
    crystal(10, -58, 1.3);
    this.addCrate(10, -42, 'ammo', true);
    // Sera: bitki tarhları (yeşil değil: uzaylı mor sarmaşıklar)
    for (const [dx, dz] of [[-7, -86], [7, -86], [-7, -98], [7, -98]]) {
      this.block(dx, 0, dz, 6, 0.8, 3, '#5d4037');
      for (let k = -2; k <= 2; k++) {
        const plant = box(0.4, 1.2, 0.4, glowMat('#ab47bc', 0.4));
        plant.position.set(dx + k * 1.1, 1.4, dz);
        this.root.add(plant);
      }
    }
    crystal(0, -92, 1.5);
    this.addCrate(-10, -103, 'armor', true);
    this.addCrate(10, -81, 'grenade', true);
    // Çekirdek odası: ortada uzaylı çekirdeği
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(2, 0), glowMat('#ff4081', 1.4));
    core.position.set(0, 7.5, -148);
    this.root.add(core);
    this.alienCore = core;
    this.block(0, 0, -148, 5, 1.5, 5, '#311b92');
    for (const [dx, dz] of [[-12, -132], [12, -132], [-14, -155], [14, -155]]) this.block(dx, 0, dz, 2, 2.5, 2, '#4a148c');
    this.addCrate(-16, -128, 'medkit', true);
    this.addCrate(16, -128, 'ammo', true);
    // Kraliçenin kalkan kristalleri (kalkan direği gibi)
    this.pylons = [];
    this.queenCrystalSpots = [[-11, -144], [11, -144], [0, -136], [-9, -156], [9, -156]];
  }

  // Kraliçe kalkanı için kristal direk
  addCrystalPylon(x, z) {
    const g = new THREE.Group();
    part(g, 0.6, 2.4, 0.6, 0, 1.2, 0, '#4a148c');
    const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.7), glowMat('#ff4081', 2.5));
    orb.position.y = 3;
    g.add(orb);
    g.position.set(x, 0, z);
    this.root.add(g);
    const pylon = { mesh: g, orb, pos: new THREE.Vector3(x, 1.5, z), hp: 150, alive: true };
    pylon.box = this.collision.add(boxFromBase(x, 0, z, 0.8, 3.4, 0.8, { kind: 'pylon', ref: pylon }));
    this.pylons.push(pylon);
    return pylon;
  }
}
