import * as THREE from 'three';
import { boxFromBase } from '../core/Collision.js';
import { box, mat, glowMat, part } from './materials.js';

// Büyük haritadaki yeni bölgeler: köy, kuzey barikatı, terk edilmiş askeri üs, uçak pisti.

export const BASE = { x: 150, z: -150, half: 45 };
export const RUNWAY = { x1: 62, x2: 216, z: -80, w: 16 };
export const VILLAGE = { x: -150, z: 20 };
export const BARRICADE_Z = 160;
// 2. bölüm: çocuğun saklandığı okul ve güvenli bölge
export const SCHOOL = { x: -135, z: -22, w: 16, d: 10, doorZ: -17 };
export const SAFE_ZONE = { minX: -18, maxX: 18, minZ: BARRICADE_Z + 2, maxZ: BARRICADE_Z + 32, flareX: 1, flareZ: BARRICADE_Z + 14 };
export const TURRETS = [{ x: -9, z: BARRICADE_Z + 2.5 }, { x: 11, z: BARRICADE_Z + 2.5 }];

// Ağaç/kaya yerleştirilmeyecek alanlar [minX, minZ, maxX, maxZ]
export const CLEAR_ZONES = [
  [BASE.x - BASE.half - 6, BASE.z - BASE.half - 6, BASE.x + BASE.half + 6, BASE.z + BASE.half + 6],
  [RUNWAY.x1 - 6, RUNWAY.z - RUNWAY.w, RUNWAY.x2 + 6, RUNWAY.z + RUNWAY.w],
  [-200, -5, -100, 45], // köy
  [0, -156, 106, -144], // üs yolu
  [-196, 14, 0, 26], // köy yolu
  [-20, BARRICADE_Z - 12, 20, BARRICADE_Z + 12],
  [-150, -36, -118, -4], // okul
  [100, 95, 205, 190], // nükleer tesis
  [0, 115, 106, 125], // tesis yolu
];

export function flat(world, x, z, w, d, color, y = 0.022) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat(color));
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, y, z);
  m.receiveShadow = true;
  world.root.add(m);
  return m;
}

function sandbags(world, x, z, len, alongX) {
  const n = Math.max(1, Math.round(len / 1.1));
  for (let i = 0; i < n; i++) {
    const t = (i - (n - 1) / 2) * 1.1;
    const bx = alongX ? x + t : x;
    const bz = alongX ? z : z + t;
    world.block(bx, 0, bz, alongX ? 1.05 : 0.7, 0.45, alongX ? 0.7 : 1.05, '#a89a6b', false);
    world.block(bx + (alongX ? 0.4 : 0), 0.45, bz + (alongX ? 0 : 0.4), alongX ? 1.05 : 0.7, 0.45, alongX ? 0.7 : 1.05, '#9a8c5f', false);
  }
  world.collision.add(boxFromBase(x, 0, z, alongX ? n * 1.1 : 0.8, 0.9, alongX ? 0.8 : n * 1.1, { kind: 'static' }));
}

function armyTruck(world, x, z, rotY, wrecked = true) {
  const g = new THREE.Group();
  const olive = wrecked ? '#3d4127' : '#4b5320';
  part(g, 2.4, 1.0, 7, 0, 1.0, 0, '#2a2a2a');
  part(g, 2.4, 1.6, 2.2, 0, 2.2, -2.3, olive);
  part(g, 2.3, 0.6, 0.06, 0, 2.5, -3.41, '#263238');
  part(g, 2.5, 2.2, 4.6, 0, 2.6, 1.1, wrecked ? '#4a4a32' : '#5b6b3a');
  for (const zz of [-2.4, 0.6, 2.4]) {
    part(g, 0.4, 1, 1, -1.15, 0.5, zz, '#151515');
    part(g, 0.4, 1, 1, 1.15, 0.5, zz, '#151515');
  }
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  world.root.add(g);
  const c = Math.abs(Math.cos(rotY));
  const s = Math.abs(Math.sin(rotY));
  world.collision.add(boxFromBase(x, 0, z, 2.5 * c + 7 * s, 3.7, 2.5 * s + 7 * c, { kind: 'static' }));
}

// Yol: x1,z1 → x2,z2 eksen hizalı şerit
export function road(world, x1, z1, x2, z2, w = 9) {
  const alongX = Math.abs(x2 - x1) > Math.abs(z2 - z1);
  const len = alongX ? Math.abs(x2 - x1) : Math.abs(z2 - z1);
  flat(world, (x1 + x2) / 2, (z1 + z2) / 2, alongX ? len : w, alongX ? w : len, '#2e2e2e', 0.021);
  const line = mat('#e8d36a');
  for (let t = 3; t < len - 3; t += 6) {
    const l = new THREE.Mesh(new THREE.PlaneGeometry(alongX ? 3 : 0.25, alongX ? 0.25 : 3), line);
    l.rotation.x = -Math.PI / 2;
    const k = t / len;
    l.position.set(x1 + (x2 - x1) * k, 0.03, z1 + (z2 - z1) * k);
    world.root.add(l);
  }
}

export function buildVillage(world) {
  road(world, -4, 20, -196, 20, 8);
  const houses = [
    [-118, 7, 's', '#c5a880', '#6d4c41'], [-134, 33, 'n', '#b0a493', '#5d4037'],
    [-150, 7, 's', '#d7c4a3', '#4e342e'], [-166, 33, 'n', '#a1887f', '#3e2723'],
    [-182, 7, 's', '#bcaaa4', '#5d4037'], [-118, 33, 'n', '#9e9480', '#4e342e'],
  ];
  // Kapılar yola bakar: yolun güneyindekiler kuzeye (n), kuzeyindekiler güneye (s)
  for (const [x, z, , wall, roof] of houses) world.house(x, z, 10, 8, 3.4, z < 20 ? 's' : 'n', wall, roof);
  // Cami/kilise gibi yüksek bina
  world.house(-170, -14, 9, 9, 6, 'n', '#e0dccf', '#455a64');
  world.block(-174, 0, -18, 2, 12, 2, '#e0dccf');
  world.block(-174, 12, -18, 1.4, 2, 1.4, '#455a64');
  buildSchool(world);
  // Kuyu, çit parçaları
  world.block(-128, 0, 46, 1.6, 0.9, 1.6, '#757575');
  for (const [x, z] of [[-140, 46], [-160, 46], [-176, -4]]) world.block(x, 0, z, 6, 1, 0.3, '#6d4c41');
}

function signTexture(text, bg, fg) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 256, 96);
  ctx.fillStyle = fg;
  ctx.font = 'bold 60px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 52);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Köy okulu: kapısı yola (güneye, +z) bakar; içinde sıralar ve kara tahta
function buildSchool(world) {
  const { x, z, w, d } = SCHOOL;
  world.house(x, z, w, d, 3.6, 's', '#e8c35a', '#8d3b2a', 2.4);
  // Tabela
  const tex = signTexture('OKUL', '#1e5aa8', '#ffffff');
  const sign = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.0, 0.15), [
    mat('#14417a'), mat('#14417a'), mat('#14417a'), mat('#14417a'),
    new THREE.MeshLambertMaterial({ map: tex, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.25 }),
    new THREE.MeshLambertMaterial({ map: tex }),
  ]);
  sign.position.set(x, 3.0, z + d / 2 + 0.3);
  world.root.add(sign);
  // Kara tahta (kuzey duvarının içi)
  const board = box(4, 1.4, 0.08, mat('#1f3b2b'));
  board.position.set(x, 1.6, z - d / 2 + 0.25);
  world.root.add(board);
  // Sıralar
  for (const dz of [-2.5, 0, 2.2]) {
    for (const dx of [-5, -2, 2, 5]) {
      world.block(x + dx, 0, z + dz, 1.4, 0.75, 0.6, '#8d6e3f');
      world.block(x + dx, 0, z + dz + 0.6, 0.5, 0.45, 0.4, '#5d4325', false);
    }
  }
  // Bahçe çiti ve salıncak direkleri
  world.block(x - 10, 0, z + 9, 0.15, 2.4, 0.15, '#c62828', false);
  world.block(x - 7, 0, z + 9, 0.15, 2.4, 0.15, '#c62828', false);
  world.block(x - 8.5, 2.3, z + 9, 3.2, 0.15, 0.15, '#c62828', false);
}

// Kapı boşluğuna çakılı tahtalar (levye/silah/patlayıcıyla kırılır).
// axis 'x': kapı z'ye bakan duvarda (tahtalar x boyunca); 'z': x'e bakan duvarda
export function buildDoorBarricade(world, x, z, width, axis = 'x') {
  const g = new THREE.Group();
  const wood = mat('#8d6e3f');
  const dark = mat('#5d4325');
  [[0.5, 0.35], [1.2, -0.3], [1.9, 0.25], [0.9, 0]].forEach(([y, rot], i) => {
    const plank = box(width + 0.4, 0.22, 0.08, i % 2 ? dark : wood);
    plank.position.set(0, y, 0);
    plank.rotation.z = rot;
    g.add(plank);
  });
  g.position.set(x, 0, z);
  if (axis === 'z') g.rotation.y = Math.PI / 2;
  world.root.add(g);
  const bar = { mesh: g, pos: new THREE.Vector3(x, 1, z), hp: 90, alive: true };
  const w = axis === 'x' ? width : 0.35;
  const d = axis === 'x' ? 0.35 : width;
  bar.box = world.collision.add(boxFromBase(x, 0, z, w, 2.6, d, { kind: 'barricade', ref: bar }));
  world.barricades.push(bar);
  return bar;
}

// 2. bölüm: üç çocuğun saklandığı yerlerin kapıları (sıra: okul, ambar, benzinlik)
export const HIDEOUTS = [
  { name: 'Deniz', place: 'OKUL', where: 'köydeki okulda', x: SCHOOL.x + 6.8, z: SCHOOL.z - 3.5, door: [SCHOOL.x, SCHOOL.doorZ + 0.25, 2.5, 'x'], coat: '#fdd835', pitch: 1 },
  { name: 'Ela', place: 'AMBAR', where: 'çiftlikteki ambarda', x: -62, z: 44, door: [-45.6, 42, 5, 'z'], coat: '#ec407a', pitch: 1.15 },
  { name: 'Can', place: 'BENZİNLİK', where: 'benzinlik dükkânında', x: 39.5, z: -54.5, door: [29.6, -52, 2.6, 'z'], coat: '#29b6f6', pitch: 0.9 },
];

export function buildHideoutBarricades(world) {
  for (const h of HIDEOUTS) buildDoorBarricade(world, ...h.door);
}

// 2. bölüm: kuzey barikatı ışıklandırılmış güvenli kampa dönüşür
export function buildSafeCamp(world) {
  const z = BARRICADE_Z;
  // Projektör direkleri (parlayan başlık)
  for (const [x, zz] of [[-16, z + 3], [17, z + 3], [-15, z + 24], [15, z + 24]]) {
    world.block(x, 0, zz, 0.3, 7, 0.3, '#616161');
    const lamp = box(1.2, 0.5, 0.6, glowMat('#fff8e1', 2.5));
    lamp.position.set(x, 7.1, zz);
    world.root.add(lamp);
  }
  // Kamp aydınlatması (sadece 2. bölüm sahnesinde)
  const flood = new THREE.PointLight('#fff3d0', 90, 45, 1.3);
  flood.position.set(0, 8, z + 12);
  world.root.add(flood);
  // Çadırlar ve sağlık çadırı
  for (const [x, zz, c] of [[-10, z + 20, '#5b6b3a'], [10, z + 20, '#e0e0e0']]) {
    world.block(x, 0, zz, 6, 2.3, 4.5, c);
    const roof = box(6.2, 3.2, 3.2, mat(c));
    roof.position.set(x, 2.3, zz);
    roof.rotation.x = Math.PI / 4;
    world.root.add(roof);
  }
  const cross = box(1.2, 1.2, 0.05, glowMat('#d32f2f', 0.6));
  cross.position.set(10, 1.4, z + 17.7);
  world.root.add(cross);
  // Taretler: kum torbalı yuva + dönen başlık
  world.turrets = TURRETS.map(({ x, z: tz }) => {
    world.block(x, 0, tz + 1, 3, 0.9, 0.8, '#a89a6b');
    world.block(x, 0, tz + 1.8, 0.5, 1.1, 0.5, '#333');
    const head = new THREE.Group();
    head.position.set(x, 1.4, tz + 1.8);
    part(head, 0.7, 0.45, 0.8, 0, 0, 0, '#3f4a22');
    part(head, 0.12, 0.12, 1.4, 0, 0.05, -0.9, '#1a1a1a');
    const led = part(head, 0.12, 0.12, 0.12, 0.25, 0.25, 0.2, glowMat('#00e676', 2));
    void led;
    world.root.add(head);
    return { x, z: tz + 1.8, head, cooldown: 0 };
  });
}

export function buildBarricade(world) {
  const z = BARRICADE_Z;
  // Beton bariyerler, ortada araç geçebilecek kadar boşluk
  for (const x of [-13, -9.5, -6, -2.5, 5, 8.5, 12]) world.block(x, 0, z, 3.2, 1.1, 0.9, '#b0aea5');
  world.block(1.2, 0, z - 3, 2.8, 1.6, 0.4, '#d32f2f', false);
  armyTruck(world, -8, z + 7, 0.25);
  sandbags(world, 10, z + 5, 6, true);
  sandbags(world, -14, z - 5, 5, false);
  for (const [x, zz] of [[-3, z + 4], [-2.2, z + 4.8]]) world.addBarrel(x, zz);
  // Kontrol kulübesi
  world.house(16, z + 8, 4, 4, 2.8, 'w', '#8d9478', '#3e4630', 1.6);
}

function watchtower(world, x, z) {
  const h = 5.2;
  for (const [dx, dz] of [[-1.8, -1.8], [1.8, -1.8], [-1.8, 1.8], [1.8, 1.8]]) world.block(x + dx, 0, z + dz, 0.35, h, 0.35, '#5d4e37');
  world.block(x, h, z, 4.4, 0.3, 4.4, '#6d5a40');
  // Doğu tarafı merdivene açık
  for (const [dx, dz, w, d] of [[0, -2.1, 4.4, 0.2], [0, 2.1, 4.4, 0.2], [-2.1, 0, 0.2, 4.4]]) {
    world.block(x + dx, h + 0.3, z + dz, w, 1, d, '#6d5a40');
  }
  world.block(x, h + 2.6, z, 4.8, 0.25, 4.8, '#3e4630', false);
  for (const [dx, dz] of [[-2, -2], [2, 2]]) world.block(x + dx, h + 0.3, z + dz, 0.15, 2.3, 0.15, '#5d4e37', false);
  const lamp = box(0.3, 0.3, 0.3, glowMat('#ff1744', 2));
  lamp.position.set(x, h + 2.9, z);
  world.root.add(lamp);
  // Basamaklar (kulenin dışına doğru yükselir)
  const steps = Math.round(h / 0.4);
  for (let i = 0; i < steps; i++) {
    world.block(x + 2.6 + (steps - 1 - i) * 0.6, 0, z, 0.6, (i + 1) * 0.4, 1.2, '#7a6a50');
  }
}

export function buildMilitaryBase(world) {
  const { x: cx, z: cz, half } = BASE;
  road(world, 4, cz, cx - half, cz, 9);
  flat(world, cx, cz, half * 2, half * 2, '#5f5f55', 0.015);
  // Çevre duvarı: batıda kapı, kuzeyde yıkık gedik, doğuda çökmüş parça
  const wall = '#8a8f86';
  const t = 0.6;
  const H = 3.2;
  const w = (x1, z1, x2, z2) => {
    const alongX = Math.abs(x2 - x1) > Math.abs(z2 - z1);
    const len = alongX ? Math.abs(x2 - x1) : Math.abs(z2 - z1);
    world.block((x1 + x2) / 2, 0, (z1 + z2) / 2, alongX ? len : t, H, alongX ? t : len, wall);
  };
  const W = cx - half;
  const E = cx + half;
  const N = cz - half;
  const S = cz + half;
  w(W, N, W, cz - 6);
  w(W, cz + 6, W, S);
  w(W, N, cx + 8, N);
  w(cx + 16, N, E, N);
  w(W, S, E, S);
  w(E, N, E, cz - 12);
  w(E, cz + 2, E, S);
  // Yıkık parçalar
  world.block(cx + 12, 0, N - 1.5, 2.5, 0.8, 1.5, wall);
  world.block(E + 1.5, 0, cz - 5, 1.5, 1, 4, wall);
  // Kapı direkleri ve devrilmiş bariyer
  world.block(W, 0, cz - 6.5, 1.2, 4, 1.2, '#616161');
  world.block(W, 0, cz + 6.5, 1.2, 4, 1.2, '#616161');
  const boom = box(0.25, 0.25, 9, mat('#d32f2f'));
  boom.position.set(W - 2, 0.15, cz - 3);
  boom.rotation.y = 0.5;
  world.root.add(boom);
  // Uyarı lambaları
  for (const [x, z] of [[W, N], [E, N], [W, S], [E, S], [W, cz - 6.5], [W, cz + 6.5]]) {
    const l = box(0.35, 0.35, 0.35, glowMat('#ff1744', 2.2));
    l.position.set(x, H + 0.6, z);
    world.root.add(l);
  }
  watchtower(world, W + 6, N + 6);
  watchtower(world, E - 10, S - 6);
  // Koğuşlar
  for (const x of [cx - 25, cx - 5, cx + 15]) world.house(x, N + 12, 14, 7, 3.2, 's', '#6b7553', '#3e4630', 2);
  // Hangar
  world.house(cx + 18, cz + 22, 26, 18, 8, 'n', '#6d7266', '#4a4f47', 13);
  // Helikopter pisti
  flat(world, cx - 22, cz + 22, 16, 16, '#8a8a80', 0.03);
  const hm = mat('#f5f5f5');
  for (const [x, z, ww, dd] of [[-2.2, 0, 0.8, 7], [2.2, 0, 0.8, 7], [0, 0, 3.6, 0.8]]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(ww, dd), hm);
    p.rotation.x = -Math.PI / 2;
    p.position.set(cx - 22 + x, 0.035, cz + 22 + z);
    world.root.add(p);
  }
  // Kum torbası siperleri
  sandbags(world, W + 8, cz - 10, 6, false);
  sandbags(world, W + 8, cz + 10, 6, false);
  sandbags(world, cx, cz + 4, 8, true);
  sandbags(world, cx + 30, cz - 20, 6, true);
  // Çadırlar
  for (const [x, z] of [[cx + 32, cz - 6], [cx + 32, cz + 4]]) {
    world.block(x, 0, z, 6, 2.2, 4.5, '#6b6b4a');
    const roof = box(6.2, 3.2, 3.2, mat('#5a5a3c'));
    roof.position.set(x, 2.2, z);
    roof.rotation.x = Math.PI / 4;
    world.root.add(roof);
  }
  // Yakıt tankı ve pompa (araç yakıtı)
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 7, 16), mat('#7d8a6a'));
  tank.rotation.z = Math.PI / 2;
  tank.position.set(cx + 35, 2.6, cz - 32);
  tank.castShadow = true;
  world.root.add(tank);
  world.collision.add(boxFromBase(cx + 35, 0, cz - 32, 7, 5, 4.8, { kind: 'static' }));
  world.block(cx + 35, 0, cz - 27, 0.8, 1.7, 0.7, '#d32f2f');
  world.fuelPoints.push(new THREE.Vector3(cx + 35, 0, cz - 25.5));
  // Askeri araç enkazı ve sandıklar
  armyTruck(world, cx - 10, cz - 12, 1.5);
  armyTruck(world, cx + 4, cz + 34, 0.1);
  const loot = [[cx - 30, cz - 30], [cx - 24, N + 12], [cx + 12, cz + 26], [cx + 24, cz + 18], [cx + 30, cz + 12],
    [cx - 4, N + 12], [cx + 16, N + 12], [E - 6, cz + 10], [W + 4, S - 4]];
  for (const [x, z] of loot) world.addCrate(x, z, null, true);
  for (const [x, z] of [[cx + 30, cz - 30], [cx + 31, cz - 31.2], [cx - 35, cz + 35], [cx + 6, cz - 6]]) world.addBarrel(x, z);
}

export function buildRunway(world) {
  const { x1, x2, z, w } = RUNWAY;
  flat(world, (x1 + x2) / 2, z, x2 - x1, w, '#4a4a4a', 0.023);
  const white = mat('#eeeeee');
  for (let x = x1 + 6; x < x2 - 6; x += 12) {
    const l = new THREE.Mesh(new THREE.PlaneGeometry(6, 0.5), white);
    l.rotation.x = -Math.PI / 2;
    l.position.set(x, 0.033, z);
    world.root.add(l);
  }
  for (const end of [x1 + 3, x2 - 3]) {
    for (let k = -3; k <= 3; k++) {
      const l = new THREE.Mesh(new THREE.PlaneGeometry(4, 0.8), white);
      l.rotation.x = -Math.PI / 2;
      l.position.set(end, 0.033, z + k * 1.8);
      world.root.add(l);
    }
  }
  // Pist kenar lambaları
  for (let x = x1; x <= x2; x += 14) {
    for (const s of [-1, 1]) {
      const l = box(0.25, 0.25, 0.25, glowMat('#ffd54f', 1.5));
      l.position.set(x, 0.15, z + s * (w / 2 + 0.5));
      world.root.add(l);
    }
  }
}
