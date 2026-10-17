import * as THREE from 'three';
import { boxFromBase } from '../core/Collision.js';
import { box, mat, glowMat, part } from './materials.js';
import { road, flat } from './regions.js';

// 4. bölüm: roket üssü (harita güneybatısı)
export const LAUNCH = {
  minX: -200, maxX: -130, minZ: -200, maxZ: -130,
  rocket: { x: -170, z: -172 },
  tower: { x: -163.5, z: -172 },
  elevator: { x: -161.5, z: -172 },
  console: { x: -145, z: -158 },
  start: { x: -100, z: -150 },
};

function rocketModel() {
  const g = new THREE.Group();
  const white = mat('#f5f5f5');
  const red = mat('#c62828');
  const body = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 26, 20), white);
  body.position.y = 15;
  g.add(body);
  for (const y of [6, 20, 26]) {
    const band = new THREE.Mesh(new THREE.CylinderGeometry(2.25, 2.25, 1, 20), red);
    band.position.y = y;
    g.add(band);
  }
  const nose = new THREE.Mesh(new THREE.ConeGeometry(2.2, 6, 20), red);
  nose.position.y = 31;
  g.add(nose);
  const win = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.2, 12), glowMat('#4fc3f7', 1));
  win.rotation.x = Math.PI / 2;
  win.position.set(0, 23, 2.2);
  g.add(win);
  for (let i = 0; i < 4; i++) {
    const fin = box(0.3, 5, 3, red);
    const a = (i * Math.PI) / 2;
    fin.position.set(Math.sin(a) * 2.8, 4.5, Math.cos(a) * 2.8);
    fin.rotation.y = a;
    g.add(fin);
  }
  for (const [x, z] of [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]]) {
    const n = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.7, 1.4, 10), mat('#424242'));
    n.position.set(x, 1.3, z);
    g.add(n);
  }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

export function buildLaunchSite(world) {
  const L = LAUNCH;
  road(world, -4, -150, L.maxX, -150, 9);
  flat(world, (L.minX + L.maxX) / 2, (L.minZ + L.maxZ) / 2, L.maxX - L.minX, L.maxZ - L.minZ, '#7a7a72', 0.014);
  // Fırlatma rampası
  const R = L.rocket;
  world.block(R.x, 0, R.z, 12, 1.2, 12, '#5f5f5f');
  const scorch = new THREE.Mesh(new THREE.CircleGeometry(4, 20), mat('#2b2b2b'));
  scorch.rotation.x = -Math.PI / 2;
  scorch.position.set(R.x, 1.22, R.z);
  world.root.add(scorch);
  const rocket = rocketModel();
  rocket.position.set(R.x, 1.2, R.z);
  world.root.add(rocket);
  world.rocket = rocket;
  world.rocketBox = world.collision.add(boxFromBase(R.x, 1.2, R.z, 4.6, 32, 4.6, { kind: 'static' }));
  // Fırlatma kulesi (kafes) ve asansör
  const T = L.tower;
  for (const [dx, dz] of [[-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3], [1.3, 1.3]]) world.block(T.x + dx, 0, T.z + dz, 0.35, 31.2, 0.35, '#c62828', false);
  for (let y = 4; y < 31; y += 4) {
    const beam = box(3, 0.25, 3, mat('#b71c1c'));
    beam.position.set(T.x, 1.2 + y, T.z);
    world.root.add(beam);
    const arm = box(2.6, 0.2, 0.5, mat('#9e9e9e'));
    arm.position.set(T.x - 1.8, 1.2 + y, T.z);
    world.root.add(arm);
  }
  const lift = box(1.6, 0.2, 1.6, glowMat('#ffd54f', 0.6));
  lift.position.set(L.elevator.x, 0.1, L.elevator.z);
  world.launchLift = lift;
  world.root.add(lift);
  world.collision.add(boxFromBase(T.x, 0, T.z, 3, 31.2, 3, { kind: 'static' }));
  // Kontrol konsolu (kum torbalı yuva içinde)
  const C = L.console;
  const con = new THREE.Group();
  part(con, 1.6, 1.1, 0.8, 0, 0.55, 0, '#37474f');
  part(con, 1.4, 0.6, 0.1, 0, 1.4, -0.3, glowMat('#00e5ff', 1.2));
  part(con, 0.3, 0.15, 0.3, -0.4, 1.15, 0.1, glowMat('#ff1744', 2));
  part(con, 0.3, 0.15, 0.3, 0.4, 1.15, 0.1, glowMat('#00e676', 2));
  con.position.set(C.x, 0, C.z);
  world.root.add(con);
  world.launchConsole = con;
  world.collision.add(boxFromBase(C.x, 0, C.z, 1.6, 1.1, 0.8, { kind: 'static' }));
  // Yakıt tankları
  for (const [x, z] of [[-188, -145], [-180, -145], [-195, -160]]) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 9, 16), mat('#eceff1'));
    t.position.set(x, 4.5, z);
    t.castShadow = true;
    world.root.add(t);
    world.collision.add(boxFromBase(x, 0, z, 6, 9, 6, { kind: 'static' }));
  }
  // Işık direkleri ve bariyerler
  for (const [x, z] of [[-135, -135], [-195, -135], [-135, -195], [-195, -195]]) {
    world.block(x, 0, z, 0.35, 8, 0.35, '#616161');
    const lamp = box(1, 0.4, 1, glowMat('#fff8e1', 2));
    lamp.position.set(x, 8.1, z);
    world.root.add(lamp);
  }
  for (const [x, z] of [[-150, -165], [-140, -170], [-155, -150]]) world.block(x, 0, z, 3, 1, 0.8, '#b0aea5');
  for (const [x, z] of [[-138, -140], [-138.9, -140.8]]) world.addBarrel(x, z);
}
