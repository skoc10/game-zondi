import * as THREE from 'three';
import { boxFromBase } from '../core/Collision.js';
import { mulberry32 } from '../core/math.js';
import { box, mat, glowMat, part, BOX_GEO } from './materials.js';
import { buildFacility } from './facility.js';
import { buildLaunchSite } from './launchSite.js';
import { buildVillage, buildBarricade, buildMilitaryBase, buildRunway, buildHideoutBarricades, buildSafeCamp, road, CLEAR_ZONES, BASE, RUNWAY } from './regions.js';

export const MAP_HALF = 225; // Oynanabilir alan ±225 m

// Kaçış için gereken benzin bidonu sayısı.
// GEÇİCİ: 2. bölümü hızlı test etmek için 1. Test bitince 5'e geri alınacak.
export const GAS_REQUIRED = 1;

// Benzin bidonlarının yerleri (ad, konum)
export const GAS_SPOTS = [
  { name: 'Benzinlik', x: 24, z: -38 },
  { name: 'Ambar', x: -58, z: 47 },
  { name: 'Köy', x: -150, z: 6 },
  { name: 'Askeri üs hangarı', x: BASE.x + 22, z: BASE.z + 26 },
  { name: 'Kuzey barikatı', x: -11, z: 166 },
];

// Sürülebilir araçların başlangıç yerleri (tür, x, z, yön)
export const VEHICLE_SPOTS = [
  ['motorcycle', 5.5, 6, 0],
  ['pickup', 14, -40, Math.PI / 2],
  ['pickup', -42, 30, 0],
  ['jeep', -140, 26, Math.PI / 2],
  ['jeep', BASE.x - 30, BASE.z - 4, Math.PI / 2],
  ['tank', BASE.x - 4, BASE.z - 22, Math.PI / 2],
  ['heli', BASE.x - 22, BASE.z + 22, Math.PI / 2],
  ['plane', RUNWAY.x2 - 12, RUNWAY.z, Math.PI / 2],
];

export const CAR_POS = { x: 0, z: 0 };
export const PLAYER_START = { x: 2.8, z: 1.2, yaw: 0 };

export class World {
  // level 2: kaçış arabası yerine sürülebilir sedan (VehicleManager), okul barikatı, güvenli kamp
  constructor(scene, collision, level = 1) {
    this.level = level;
    this.barricades = [];
    this.turrets = [];
    this.scene = scene;
    this.collision = collision;
    this.rng = mulberry32(1337);
    this.barrels = [];
    this.crates = [];
    // Araç yakıtı doldurulabilen pompalar
    this.fuelPoints = [new THREE.Vector3(20.6, 0, -47.5), new THREE.Vector3(20.6, 0, -42.5)];
    this.root = new THREE.Group();
    scene.add(this.root);
    this.build();
  }

  // Alt-merkez konumlu blok; collide=true ise çarpışma kutusu da ekler.
  block(x, y, z, w, h, d, material, collide = true, parent = this.root) {
    const m = box(w, h, d, material);
    m.position.set(x, y + h / 2, z);
    parent.add(m);
    if (collide) this.collision.add(boxFromBase(x, y, z, w, h, d, { kind: 'static', mesh: m }));
    return m;
  }

  build() {
    this.buildGround();
    this.buildRoads();
    if (this.level === 1) this.buildCar();
    else this.car = null;
    this.buildGasStation();
    this.buildBarn();
    this.house(-60, -70, 10, 8, 3.4, 'e', '#c9b79c', '#5d4037');
    this.house(-38, -28, 9, 8, 3.4, 'e', '#a1887f', '#3e2723');
    this.house(48, 32, 10, 9, 3.4, 'w', '#b0bec5', '#455a64');
    this.house(71, -12, 9, 8, 3.4, 'w', '#d7ccc8', '#6d4c41');
    this.house(-20, 76, 5, 5, 2.8, 's', '#8d6e63', '#4e342e');
    this.buildWrecks();
    buildVillage(this);
    buildBarricade(this);
    if (this.level === 2) buildHideoutBarricades(this);
    // Güvenli kamp 2. bölümden itibaren kurulu
    if (this.level >= 2) buildSafeCamp(this);
    buildMilitaryBase(this);
    buildRunway(this);
    buildFacility(this);
    buildLaunchSite(this);
    this.buildBarrels();
    this.buildCrates();
    this.buildTrees();
    this.buildRocks();
  }

  buildGround() {
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(720, 720), mat('#4a6b2f'));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.root.add(ground);
    // Toprak lekeleri
    const dirt = mat('#6b5a3a');
    for (let i = 0; i < 140; i++) {
      const s = 4 + this.rng() * 10;
      const p = new THREE.Mesh(new THREE.PlaneGeometry(s, s * (0.6 + this.rng() * 0.8)), dirt);
      p.rotation.x = -Math.PI / 2;
      p.rotation.z = this.rng() * Math.PI;
      p.position.set((this.rng() - 0.5) * 440, 0.01, (this.rng() - 0.5) * 440);
      p.receiveShadow = true;
      this.root.add(p);
    }
  }

  buildRoads() {
    road(this, 0, -240, 0, 240, 9);
    const side = new THREE.Mesh(new THREE.PlaneGeometry(36, 12), mat('#2e2e2e'));
    side.rotation.x = -Math.PI / 2;
    side.position.set(22, 0.021, -45);
    side.receiveShadow = true;
    this.root.add(side);
  }

  carModel(bodyColor, rusty = false) {
    const g = new THREE.Group();
    const dark = '#1c1c1c';
    part(g, 2.0, 0.75, 4.4, 0, 0.75, 0, bodyColor);
    part(g, 1.8, 0.65, 2.2, 0, 1.45, 0.3, rusty ? '#5d4037' : bodyColor);
    part(g, 1.82, 0.5, 0.06, 0, 1.47, -0.8, rusty ? '#263238' : '#90caf9');
    part(g, 1.82, 0.45, 0.06, 0, 1.47, 1.42, rusty ? '#263238' : '#90caf9');
    for (const [x, z] of [[-0.95, -1.4], [0.95, -1.4], [-0.95, 1.4], [0.95, 1.4]]) {
      part(g, 0.3, 0.7, 0.7, x, 0.35, z, dark);
    }
    if (!rusty) {
      part(g, 0.4, 0.18, 0.06, -0.6, 0.85, -2.21, glowMat('#fff8e1', 0.6));
      part(g, 0.4, 0.18, 0.06, 0.6, 0.85, -2.21, glowMat('#fff8e1', 0.6));
      part(g, 0.35, 0.15, 0.06, -0.65, 0.9, 2.21, glowMat('#d50000', 0.5));
      part(g, 0.35, 0.15, 0.06, 0.65, 0.9, 2.21, glowMat('#d50000', 0.5));
    }
    return g;
  }

  buildCar() {
    const car = this.carModel('#1e5aa8');
    // Arıza: kaput açık
    const hood = part(car, 1.9, 0.08, 1.3, 0, 1.55, -1.75, '#1e5aa8');
    hood.rotation.x = -0.9;
    hood.position.set(0, 1.65, -1.55);
    car.position.set(CAR_POS.x, 0, CAR_POS.z);
    this.root.add(car);
    this.car = { mesh: car, pos: new THREE.Vector3(CAR_POS.x, 0, CAR_POS.z) };
    this.collision.add(boxFromBase(CAR_POS.x, 0, CAR_POS.z, 2.0, 1.8, 4.4, { kind: 'car' }));
  }

  // İçine girilebilen ev: 4 duvar, kapı boşluğu, çatı, pencereler
  house(x, z, w, d, h, door, wallColor, roofColor, doorWidth = 2.2) {
    const t = 0.35;
    const doorH = Math.min(2.5, h - 0.4);
    const wall = mat(wallColor);
    const walls = {
      n: { cx: x, cz: z - d / 2, len: w, alongX: true },
      s: { cx: x, cz: z + d / 2, len: w, alongX: true },
      w: { cx: x - w / 2, cz: z, len: d, alongX: false },
      e: { cx: x + w / 2, cz: z, len: d, alongX: false },
    };
    for (const [side, s] of Object.entries(walls)) {
      const sx = s.alongX ? 1 : 0;
      const sz = s.alongX ? 0 : 1;
      if (side === door) {
        const seg = (s.len - doorWidth) / 2;
        const off = doorWidth / 2 + seg / 2;
        this.block(s.cx - sx * off, 0, s.cz - sz * off, s.alongX ? seg : t, h, s.alongX ? t : seg, wall);
        this.block(s.cx + sx * off, 0, s.cz + sz * off, s.alongX ? seg : t, h, s.alongX ? t : seg, wall);
        this.block(s.cx, doorH, s.cz, s.alongX ? doorWidth : t, h - doorH, s.alongX ? t : doorWidth, wall);
      } else {
        this.block(s.cx, 0, s.cz, s.alongX ? s.len + t : t, h, s.alongX ? t : s.len + t, wall);
        // Pencere (sadece görsel)
        const win = glowMat('#1a2a3a', 0.1);
        const wx = s.alongX ? 0 : (side === 'w' ? -1 : 1) * 0.2;
        const wz = s.alongX ? (side === 'n' ? -1 : 1) * 0.2 : 0;
        const wm = box(s.alongX ? 1.4 : 0.05, 1.0, s.alongX ? 0.05 : 1.4, win);
        wm.position.set(s.cx + wx, 1.5, s.cz + wz);
        this.root.add(wm);
      }
    }
    // Çatı (düz plaka + sırt)
    this.block(x, h, z, w + 0.9, 0.3, d + 0.9, roofColor);
    const ridge = box(w * 0.6, 0.9, d + 0.9, mat(roofColor));
    ridge.position.set(x, h + 0.75, z);
    this.root.add(ridge);
    // Zemin döşemesi
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat('#5d4e3c'));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(x, 0.025, z);
    floor.receiveShadow = true;
    this.root.add(floor);
  }

  buildGasStation() {
    // Dükkan
    this.house(36, -52, 12, 8, 4, 'w', '#eceff1', '#c62828', 2.6);
    // Kanopi
    for (const [px, pz] of [[17, -49], [27, -49], [17, -41], [27, -41]]) {
      this.block(px, 0, pz, 0.5, 4.5, 0.5, '#eeeeee');
    }
    const canopy = box(13, 0.5, 11, mat('#c62828'));
    canopy.position.set(22, 4.75, -45);
    this.root.add(canopy);
    const under = box(12.5, 0.05, 10.5, glowMat('#fffde7', 0.25));
    under.position.set(22, 4.48, -45);
    under.castShadow = false;
    this.root.add(under);
    // Pompalar
    for (const pz of [-47.5, -42.5]) {
      this.block(22, 0, pz, 1.4, 0.25, 2.6, '#9e9e9e');
      this.block(22, 0.25, pz, 0.7, 1.6, 0.6, '#d32f2f');
      const screen = box(0.72, 0.3, 0.3, glowMat('#00e5ff', 0.7));
      screen.position.set(22, 1.5, pz);
      this.root.add(screen);
    }
    // Tabela
    this.block(8, 0, -52, 0.4, 7, 0.4, '#616161');
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 96;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#c62828';
    ctx.fillRect(0, 0, 256, 96);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 54px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('BENZİN', 128, 50);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(4, 1.5, 0.3),
      [mat('#8e1b1b'), mat('#8e1b1b'), mat('#8e1b1b'), mat('#8e1b1b'),
        new THREE.MeshLambertMaterial({ map: tex, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.35 }),
        new THREE.MeshLambertMaterial({ map: tex, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.35 })],
    );
    sign.rotation.y = Math.PI / 2;
    sign.position.set(8, 7.4, -52);
    sign.castShadow = true;
    this.root.add(sign);
  }

  buildBarn() {
    this.house(-55, 42, 18, 14, 7, 'e', '#8e2a1e', '#3e2723', 5);
    // Saman balyaları
    const hay = '#d4b24c';
    this.block(-61, 0, 38, 2.2, 1.1, 1.2, hay);
    this.block(-61, 1.1, 38, 2.2, 1.1, 1.2, hay);
    this.block(-60, 0, 36.2, 2.2, 1.1, 1.2, hay);
    this.block(-50, 0, 47, 1.2, 1.1, 2.2, hay);
    // Çit
    const post = '#6d4c41';
    const fence = (x1, z1, x2, z2) => {
      const len = Math.hypot(x2 - x1, z2 - z1);
      const alongX = Math.abs(x2 - x1) > Math.abs(z2 - z1);
      this.block((x1 + x2) / 2, 0.45, (z1 + z2) / 2, alongX ? len : 0.12, 0.12, alongX ? 0.12 : len, post, false);
      this.block((x1 + x2) / 2, 0.9, (z1 + z2) / 2, alongX ? len : 0.12, 0.12, alongX ? 0.12 : len, post, false);
      this.collision.add(boxFromBase((x1 + x2) / 2, 0, (z1 + z2) / 2, alongX ? len : 0.3, 1.0, alongX ? 0.3 : len, { kind: 'fence' }));
      const n = Math.floor(len / 2.5);
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        this.block(x1 + (x2 - x1) * t, 0, z1 + (z2 - z1) * t, 0.18, 1.2, 0.18, post, false);
      }
    };
    fence(-75, 26, -35, 26);
    fence(-75, 26, -75, 60);
    fence(-75, 60, -35, 60);
    fence(-35, 26, -35, 37);
    fence(-35, 49, -35, 60);
  }

  buildWrecks() {
    const wrecks = [
      [-3, 32, 0.1, '#6d4c41'], [3.5, -30, -0.15, '#455a64'], [-2.5, 70, 3.1, '#5d4037'],
      [3.3, -86, 0.05, '#4e342e'], [55, 22, 1.4, '#37474f'], [-28, -60, 0.6, '#3e2723'],
    ];
    for (const [x, z, rot, color] of wrecks) {
      const car = this.carModel(color, true);
      car.position.set(x, 0, z);
      car.rotation.y = rot;
      this.root.add(car);
      // Döndürülmüş arabayı kaba bir AABB ile kapla
      const c = Math.abs(Math.cos(rot));
      const s = Math.abs(Math.sin(rot));
      const w = 2.0 * c + 4.4 * s;
      const d = 2.0 * s + 4.4 * c;
      this.collision.add(boxFromBase(x, 0, z, w, 1.8, d, { kind: 'static' }));
    }
  }

  addBarrel(x, z) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.1, 12), mat('#c62828'));
    body.position.y = 0.55;
    body.castShadow = true;
    body.receiveShadow = true;
    g.add(body);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.43, 0.43, 0.12, 12), mat('#ffeb3b'));
    band.position.y = 0.75;
    g.add(band);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.03, 12), mat('#7f1010'));
    top.position.y = 1.11;
    g.add(top);
    g.position.set(x, 0, z);
    this.root.add(g);
    const barrel = { mesh: g, pos: new THREE.Vector3(x, 0, z), hp: 20, alive: true, fuse: -1 };
    barrel.box = this.collision.add(boxFromBase(x, 0, z, 0.85, 1.1, 0.85, { kind: 'barrel', ref: barrel }));
    this.barrels.push(barrel);
    return barrel;
  }

  buildBarrels() {
    const spots = [
      [30, -39], [30.9, -40.1], [29.8, -40.6], [39, -45], [39.9, -46], [39.2, -47.2],
      [-44, 35], [-44.9, 35.8], [6, -8], [6.9, -8.7], [6, 20], [-6, -15], [7, 55],
      [64, -6], [64.8, -6.8], [-33, -24], [45, 38], [-14, 74], [10, -70], [-8, 95],
      [-125, 13], [-125.8, 13.9], [-160, 30.5], [-190, 40], [20, -150], [21, -151], [90, -150],
      [110, 90], [-100, 130], [-40, -150], [180, 60], [70, -95], [71, -96],
    ];
    for (const [x, z] of spots) this.addBarrel(x, z);
  }

  // military: yeşil askeri sandık, daha iyi eşya çıkar
  addCrate(x, z, loot = null, military = false) {
    const g = new THREE.Group();
    const body = military ? '#4b5320' : '#8d6e3f';
    const trim = military ? '#2f3514' : '#5d4325';
    part(g, 1.1, 1.1, 1.1, 0, 0.55, 0, body);
    part(g, 1.14, 0.12, 1.14, 0, 0.12, 0, trim);
    part(g, 1.14, 0.12, 1.14, 0, 0.98, 0, trim);
    part(g, 0.12, 1.12, 1.14, 0, 0.55, 0, military ? '#e0c341' : trim);
    g.position.set(x, 0, z);
    g.rotation.y = this.rng() * 0.3;
    this.root.add(g);
    const crate = { mesh: g, pos: new THREE.Vector3(x, 0, z), hp: military ? 45 : 30, alive: true, loot, military };
    crate.box = this.collision.add(boxFromBase(x, 0, z, 1.1, 1.1, 1.1, { kind: 'crate', ref: crate }));
    this.crates.push(crate);
    return crate;
  }

  buildCrates() {
    this.addCrate(-3.6, 4, 'grenade');
    const spots = [
      [27, -37], [37, -50], [-59, 45], [-50, 38], [-62, -72], [-40, -30], [50, 34], [73, -14],
      [-20, 77], [10, 60], [-12, -60], [15, -95], [-80, 0], [80, 40], [60, -70], [-30, 100],
      [40, 90], [-90, -40], [90, -90], [-95, 80], [25, 10], [-15, 20],
      [-120, 40], [-152, 30], [-185, 12], [-168, -10], [-130, 0], [8, 172], [-16, 150],
      [120, 60], [170, 92], [-200, 150], [-95, -130], [60, 180], [200, 30], [-60, -190],
      [100, -40], [-110, -100], [140, -40], [30, 200],
    ];
    for (const [x, z] of spots) this.addCrate(x, z);
  }

  isFree(x, z, r) {
    if (Math.abs(x) < 7) return false; // yol
    if (Math.hypot(x - CAR_POS.x, z - CAR_POS.z) < 14) return false;
    if (x > 2 && x < 45 && z > -60 && z < -30) return false; // benzinlik
    if (x > -78 && x < -32 && z > 23 && z < 63) return false; // çiftlik
    for (const [a, b, c, d] of CLEAR_ZONES) if (x > a && x < c && z > b && z < d) return false;
    return !this.collision.blockedAt(x, z, r + 1.5, 3);
  }

  buildTrees() {
    const trunks = [];
    const leaves = [];
    const tryPlace = (x, z, collide) => {
      if (!this.isFree(x, z, 1)) return;
      const s = 0.8 + this.rng() * 0.7;
      trunks.push([x, z, s]);
      leaves.push([x, z, s]);
      if (collide) this.collision.add(boxFromBase(x, 0, z, 0.6 * s, 4, 0.6 * s, { kind: 'tree' }));
    };
    for (let i = 0; i < 650; i++) tryPlace((this.rng() - 0.5) * 440, (this.rng() - 0.5) * 440, true);
    // Kenar ormanı (duvar görevi görür)
    for (let i = 0; i < 760; i++) {
      const a = this.rng() * Math.PI * 2;
      const side = Math.floor(this.rng() * 4);
      const t = (this.rng() - 0.5) * 490;
      const depth = MAP_HALF + 2 + this.rng() * 18;
      const x = side === 0 ? depth : side === 1 ? -depth : t;
      const z = side === 2 ? depth : side === 3 ? -depth : t;
      if (Math.abs(x) < 6 && Math.abs(z) > MAP_HALF - 5) continue;
      void a;
      trunks.push([x, z, 1 + this.rng() * 0.6]);
      leaves.push([x, z, 1 + this.rng() * 0.6]);
    }
    const trunkMesh = new THREE.InstancedMesh(BOX_GEO, mat('#4e342e'), trunks.length);
    const leafMesh = new THREE.InstancedMesh(BOX_GEO, mat('#2e5d1f'), leaves.length * 2);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    trunks.forEach(([x, z, s], i) => {
      m.compose(new THREE.Vector3(x, 1.6 * s, z), q.setFromAxisAngle(up, i), new THREE.Vector3(0.5 * s, 3.2 * s, 0.5 * s));
      trunkMesh.setMatrixAt(i, m);
    });
    leaves.forEach(([x, z, s], i) => {
      q.setFromAxisAngle(up, i * 0.7);
      m.compose(new THREE.Vector3(x, 3.6 * s, z), q, new THREE.Vector3(2.6 * s, 1.8 * s, 2.6 * s));
      leafMesh.setMatrixAt(i * 2, m);
      m.compose(new THREE.Vector3(x, 4.8 * s, z), q, new THREE.Vector3(1.6 * s, 1.2 * s, 1.6 * s));
      leafMesh.setMatrixAt(i * 2 + 1, m);
    });
    for (const im of [trunkMesh, leafMesh]) {
      im.castShadow = true;
      im.receiveShadow = true;
      this.root.add(im);
    }
  }

  buildRocks() {
    for (let i = 0; i < 160; i++) {
      const x = (this.rng() - 0.5) * 430;
      const z = (this.rng() - 0.5) * 430;
      if (!this.isFree(x, z, 1)) continue;
      const s = 0.5 + this.rng() * 1.2;
      const r = box(s * 1.3, s * 0.7, s, mat('#757575'));
      r.position.set(x, s * 0.35, z);
      r.rotation.y = this.rng() * 3;
      this.root.add(r);
      if (s > 0.9) this.collision.add(boxFromBase(x, 0, z, s, s * 0.7, s, { kind: 'static' }));
    }
  }

  removeBarrel(barrel) {
    barrel.alive = false;
    this.root.remove(barrel.mesh);
    this.collision.remove(barrel.box);
  }

  removeBarricade(bar) {
    bar.alive = false;
    this.root.remove(bar.mesh);
    this.collision.remove(bar.box);
  }

  removeCrate(crate) {
    crate.alive = false;
    this.root.remove(crate.mesh);
    this.collision.remove(crate.box);
  }
}
