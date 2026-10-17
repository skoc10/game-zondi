import * as THREE from 'three';
import { boxFromBase } from '../core/Collision.js';
import { box, mat, glowMat, part } from './materials.js';
import { road, flat } from './regions.js';

// Zombi salgınının başladığı nükleer tesis (harita kuzeydoğusu).
export const FACILITY = {
  minX: 105, maxX: 200, minZ: 100, maxZ: 185,
  gateZ: 120,
  reactor: { x: 152, z: 150, w: 22, d: 22, h: 9 },
  core: { x: 154, z: 150 },
  control: { x: 124, z: 132, w: 14, d: 10 },
  labs: [{ x: 124, z: 170 }, { x: 160, z: 112 }],
  ponds: [{ x: 172, z: 135, r: 5 }, { x: 138, z: 176, r: 4 }],
  towers: [{ x: 186, z: 168 }, { x: 186, z: 118 }],
};

function radiationTexture(text) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fdd835';
  ctx.fillRect(0, 0, 256, 128);
  // Radyasyon simgesi: merkez + üç yaprak
  ctx.fillStyle = '#111';
  const cx = 60;
  const cy = 64;
  for (let i = 0; i < 3; i++) {
    const a0 = -Math.PI / 2 + (i * 2 * Math.PI) / 3 - Math.PI / 6;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, 44, a0, a0 + Math.PI / 3);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = '#fdd835';
  ctx.beginPath();
  ctx.arc(cx, cy, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.arc(cx, cy, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = 'bold 30px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 112, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function sign(world, x, y, z, rotY, text) {
  const tex = radiationTexture(text);
  const m = new THREE.Mesh(new THREE.BoxGeometry(3, 1.5, 0.1), [
    mat('#c9a400'), mat('#c9a400'), mat('#c9a400'), mat('#c9a400'),
    new THREE.MeshLambertMaterial({ map: tex, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.2 }),
    new THREE.MeshLambertMaterial({ map: tex }),
  ]);
  m.position.set(x, y, z);
  m.rotation.y = rotY;
  world.root.add(m);
}

function coolingTower(world, x, z) {
  // Hiperboloit kule
  const pts = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    const r = 6 + 3.2 * Math.pow(Math.abs(t - 0.62) / 0.62, 1.6);
    pts.push(new THREE.Vector2(r, t * 26));
  }
  const geo = new THREE.LatheGeometry(pts, 20);
  const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: '#b0aea5', side: THREE.DoubleSide }));
  m.position.set(x, 0, z);
  m.castShadow = true;
  m.receiveShadow = true;
  world.root.add(m);
  const stripe = new THREE.Mesh(new THREE.CylinderGeometry(7.2, 7.25, 1.2, 20, 1, true), mat('#c62828'));
  stripe.position.set(x, 23, z);
  world.root.add(stripe);
  world.collision.add(boxFromBase(x, 0, z, 16, 26, 16, { kind: 'static' }));
  world.steamVents.push(new THREE.Vector3(x, 26, z));
}

function fence(world, x1, z1, x2, z2) {
  const alongX = Math.abs(x2 - x1) > Math.abs(z2 - z1);
  const len = alongX ? Math.abs(x2 - x1) : Math.abs(z2 - z1);
  const cx = (x1 + x2) / 2;
  const cz = (z1 + z2) / 2;
  // Tel örgü görünümü: yarı saydam ızgara + direkler
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(alongX ? len : 0.08, 3, alongX ? 0.08 : len),
    new THREE.MeshLambertMaterial({ color: '#9e9e9e', transparent: true, opacity: 0.45 }),
  );
  mesh.position.set(cx, 1.5, cz);
  world.root.add(mesh);
  const n = Math.floor(len / 4);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    world.block(x1 + (x2 - x1) * t, 0, z1 + (z2 - z1) * t, 0.15, 3.4, 0.15, '#616161', false);
  }
  // Dikenli tel
  const wire = box(alongX ? len : 0.25, 0.25, alongX ? 0.25 : len, mat('#424242'));
  wire.position.set(cx, 3.4, cz);
  world.root.add(wire);
  world.collision.add(boxFromBase(cx, 0, cz, alongX ? len : 0.3, 3.4, alongX ? 0.3 : len, { kind: 'static' }));
}

export function buildFacility(world) {
  const F = FACILITY;
  world.steamVents = [];
  world.alarmLamps = [];
  world.pylons = [];
  road(world, 4, F.gateZ, F.minX, F.gateZ, 9);
  flat(world, (F.minX + F.maxX) / 2, (F.minZ + F.maxZ) / 2, F.maxX - F.minX, F.maxZ - F.minZ, '#6e6e66', 0.014);
  // Çit (batıda giriş kapısı)
  fence(world, F.minX, F.minZ, F.maxX, F.minZ);
  fence(world, F.minX, F.maxZ, F.maxX, F.maxZ);
  fence(world, F.maxX, F.minZ, F.maxX, F.maxZ);
  fence(world, F.minX, F.minZ, F.minX, F.gateZ - 5);
  fence(world, F.minX, F.gateZ + 5, F.minX, F.maxZ);
  world.block(F.minX, 0, F.gateZ - 5.4, 0.8, 4, 0.8, '#fdd835');
  world.block(F.minX, 0, F.gateZ + 5.4, 0.8, 4, 0.8, '#fdd835');
  sign(world, F.minX - 0.3, 2.4, F.gateZ - 8, -Math.PI / 2, 'RADYASYON');
  sign(world, F.minX - 0.3, 2.4, F.gateZ + 8, -Math.PI / 2, 'TEHLİKE');
  // Soğutma kuleleri
  for (const t of F.towers) coolingTower(world, t.x, t.z);

  // Reaktör binası: kare gövde, kubbe, batıda kilitli çelik kapı
  const R = F.reactor;
  world.house(R.x, R.z, R.w, R.d, R.h, 'w', '#cfd2cc', '#8a8f86', 3.2);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(R.w * 0.55, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat('#d7dad3'));
  dome.position.set(R.x, R.h + 0.2, R.z);
  dome.castShadow = true;
  world.root.add(dome);
  sign(world, R.x - R.w / 2 - 0.25, 4.6, R.z + 4, -Math.PI / 2, 'REAKTÖR');
  // Kilitli kapı
  const doorX = R.x - R.w / 2 - 0.1;
  const door = new THREE.Group();
  part(door, 0.25, 2.6, 3.2, 0, 1.3, 0, '#5d6d7e');
  for (let i = 0; i < 4; i++) part(door, 0.27, 0.3, 3.2, 0, 0.4 + i * 0.6, 0, i % 2 ? '#fdd835' : '#212121');
  const lock = part(door, 0.3, 0.4, 0.4, -0.05, 1.3, 1.1, glowMat('#ff1744', 2));
  door.position.set(doorX, 0, R.z);
  world.root.add(door);
  world.reactorDoor = {
    mesh: door, lock, locked: true, pos: new THREE.Vector3(doorX, 0, R.z),
    box: world.collision.add(boxFromBase(doorX, 0, R.z, 0.4, 2.6, 3.2, { kind: 'static' })),
  };
  // Çekirdek
  const C = F.core;
  world.block(C.x, 0, C.z, 6, 0.6, 6, '#455a64');
  const core = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 5, 16), glowMat('#18ffff', 1.4));
  core.position.set(C.x, 3.1, C.z);
  world.root.add(core);
  world.collision.add(boxFromBase(C.x, 0, C.z, 3.4, 6, 3.4, { kind: 'static' }));
  for (const [dx, dz] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) world.block(C.x + dx, 0, C.z + dz, 0.4, 6, 0.4, '#37474f', false);
  world.reactorCore = core;
  const coreLight = new THREE.PointLight('#18ffff', 25, 18, 1.5);
  coreLight.position.set(C.x, 4, C.z);
  world.root.add(coreLight);

  // Kontrol odası (Dr. Kaos) ve kalkan direkleri
  const K = F.control;
  world.house(K.x, K.z, K.w, K.d, 4, 'n', '#eceff1', '#455a64', 2.4);
  for (const [dx, dz] of [[-4, 2.5], [4, 2.5], [0, 3.6]]) world.block(K.x + dx, 0, K.z + dz, 2.2, 1, 0.8, '#37474f');
  for (const [dx, dz] of [[-5, -3.2], [5, -3.2]]) {
    const x = K.x + dx;
    const z = K.z + dz;
    const g = new THREE.Group();
    part(g, 0.6, 3, 0.6, 0, 1.5, 0, '#455a64');
    const orb = part(g, 0.7, 0.7, 0.7, 0, 3.3, 0, glowMat('#d500f9', 2.5));
    g.position.set(x, 0, z);
    world.root.add(g);
    const pylon = { mesh: g, orb, pos: new THREE.Vector3(x, 1.5, z), hp: 180, alive: true };
    pylon.box = world.collision.add(boxFromBase(x, 0, z, 0.7, 3.6, 0.7, { kind: 'pylon', ref: pylon }));
    world.pylons.push(pylon);
  }
  // Laboratuvarlar: masalar ve yeşil sıvı tankları
  for (const L of F.labs) {
    world.house(L.x, L.z, 16, 10, 4, 'n', '#f5f5f5', '#607d8b', 2.6);
    for (const dx of [-5, 0, 5]) world.block(L.x + dx, 0, L.z + 1.5, 2.6, 0.9, 1.2, '#b0bec5');
    for (const dx of [-6, 6]) {
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 2.4, 12), glowMat('#76ff03', 0.9));
      tank.position.set(L.x + dx, 1.2, L.z - 3);
      world.root.add(tank);
      world.collision.add(boxFromBase(L.x + dx, 0, L.z - 3, 1.4, 2.4, 1.4, { kind: 'static' }));
    }
  }
  // Zehirli göletler
  world.toxicPonds = F.ponds;
  for (const p of F.ponds) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(p.r, 20), glowMat('#64dd17', 0.7));
    m.rotation.x = -Math.PI / 2;
    m.position.set(p.x, 0.04, p.z);
    world.root.add(m);
  }
  // Alarm lambaları
  for (const [x, z, y] of [[R.x - R.w / 2, R.z - R.d / 2, R.h + 0.5], [R.x + R.w / 2, R.z + R.d / 2, R.h + 0.5], [K.x, K.z, 4.5], [F.minX, F.gateZ - 5.4, 4.3], [F.minX, F.gateZ + 5.4, 4.3]]) {
    const l = box(0.5, 0.5, 0.5, glowMat('#ff1744', 0.4).clone());
    l.position.set(x, y, z);
    world.root.add(l);
    world.alarmLamps.push(l);
  }
  // Varil yığınları
  for (const [x, z] of [[115, 140], [115.9, 140.8], [195, 150], [194.2, 151], [140, 105]]) world.addBarrel(x, z);
}

export function openReactorDoor(world) {
  const d = world.reactorDoor;
  if (!d || !d.locked) return;
  d.locked = false;
  world.collision.remove(d.box);
  d.mesh.position.z += 3.4;
  d.lock.material = glowMat('#00e676', 2);
}

export function destroyPylon(world, pylon) {
  if (!pylon.alive) return;
  pylon.alive = false;
  world.root.remove(pylon.mesh);
  world.collision.remove(pylon.box);
}
