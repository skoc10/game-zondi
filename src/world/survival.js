import * as THREE from 'three';
import { boxFromBase } from '../core/Collision.js';
import { box, mat, glowMat, part } from './materials.js';
import { VILLAGE, BASE } from './regions.js';

// Hayatta kalma modu: su kaynakları ve kamp ateşleri
export const LAKE = { x: -95, z: 105, r: 17 };

// Yakında boş bir nokta bul (binalara gömülmesin)
function freeSpot(world, x, z, r = 1.6) {
  for (let ring = 0; ring < 8; ring++) {
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      const px = x + Math.sin(a) * ring * 2.5;
      const pz = z + Math.cos(a) * ring * 2.5;
      if (!world.collision.blockedAt(px, pz, r, 2)) return [px, pz];
      if (ring === 0) break;
    }
  }
  return [x, z];
}

function buildLake(world) {
  const { x, z, r } = LAKE;
  const sand = new THREE.Mesh(new THREE.CircleGeometry(r + 3, 40), mat('#a1887f'));
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(x, 0.025, z);
  sand.receiveShadow = true;
  world.root.add(sand);
  const water = new THREE.Mesh(new THREE.CircleGeometry(r, 40), new THREE.MeshStandardMaterial({ color: '#1e88e5', roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.85 }));
  water.rotation.x = -Math.PI / 2;
  water.position.set(x, 0.06, z);
  world.root.add(water);
  world.lakeWater = water;
  // Kıyı taşları ve sazlıklar
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2 + world.rng() * 0.2;
    const d = r + 0.6 + world.rng() * 2;
    if (i % 3 === 0) {
      const s = 0.4 + world.rng() * 0.5;
      const rock = box(s * 1.3, s * 0.6, s, mat('#8d8d8d'));
      rock.position.set(x + Math.sin(a) * d, s * 0.3, z + Math.cos(a) * d);
      rock.rotation.y = world.rng() * 3;
      world.root.add(rock);
    } else {
      for (let k = 0; k < 3; k++) {
        const reed = box(0.06, 1 + world.rng() * 0.6, 0.06, mat('#7cb342'));
        reed.position.set(x + Math.sin(a) * (d - 1.2) + (world.rng() - 0.5), 0.6, z + Math.cos(a) * (d - 1.2) + (world.rng() - 0.5));
        reed.castShadow = false;
        world.root.add(reed);
      }
    }
  }
  return { name: 'Göl', kind: 'lake', x, z, r: r + 2.5 };
}

function buildWell(world, x, z) {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1, 0.9, 14, 1, true), mat('#9e9e9e'));
  ring.position.y = 0.45;
  ring.material.side = THREE.DoubleSide;
  g.add(ring);
  const w = new THREE.Mesh(new THREE.CircleGeometry(0.85, 14), mat('#0d47a1'));
  w.rotation.x = -Math.PI / 2;
  w.position.y = 0.6;
  g.add(w);
  part(g, 0.15, 2.2, 0.15, -0.95, 1.1, 0, '#5d4037');
  part(g, 0.15, 2.2, 0.15, 0.95, 1.1, 0, '#5d4037');
  part(g, 2.3, 0.12, 0.12, 0, 2.15, 0, '#4e342e');
  part(g, 2.6, 0.08, 1.6, 0, 2.35, 0, '#6d4c41');
  part(g, 0.3, 0.3, 0.3, 0, 1.4, 0, '#795548');
  g.position.set(x, 0, z);
  world.root.add(g);
  world.collision.add(boxFromBase(x, 0, z, 2, 0.9, 2, { kind: 'static' }));
  return { name: 'Köy kuyusu', kind: 'well', x, z, r: 2.6 };
}

function buildPump(world, x, z) {
  const g = new THREE.Group();
  part(g, 0.25, 1.2, 0.25, 0, 0.6, 0, '#37474f');
  part(g, 0.12, 0.12, 0.5, 0, 1.0, -0.3, '#455a64');
  part(g, 0.08, 0.08, 0.8, 0, 1.3, 0.35, '#263238');
  part(g, 1.2, 0.35, 0.6, 0, 0.18, -0.75, '#6d4c41');
  part(g, 1.05, 0.05, 0.45, 0, 0.36, -0.75, '#1976d2');
  g.position.set(x, 0, z);
  world.root.add(g);
  world.collision.add(boxFromBase(x, 0, z, 0.4, 1.2, 0.4, { kind: 'static' }));
  return { name: 'Çiftlik pompası', kind: 'pump', x, z, r: 2.2 };
}

function buildTank(world, x, z) {
  const t = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 4, 16), mat('#607d8b'));
  t.position.set(x, 2.6, z);
  t.castShadow = true;
  world.root.add(t);
  for (const [dx, dz] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) world.block(x + dx, 0, z + dz, 0.2, 0.6, 0.2, '#455a64', false);
  part(world.root, 0.15, 0.15, 0.6, x, 1.0, z + 2.0, '#b0bec5');
  part(world.root, 0.6, 0.2, 0.6, x, 0.1, z + 2.3, '#37474f');
  world.collision.add(boxFromBase(x, 0, z, 3.6, 4.6, 3.6, { kind: 'static' }));
  return { name: 'Askeri su tankı', kind: 'tank', x, z: z + 2.4, r: 2.2 };
}

function buildCampfire(world, x, z) {
  const g = new THREE.Group();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    part(g, 0.3, 0.22, 0.3, Math.sin(a) * 0.7, 0.11, Math.cos(a) * 0.7, '#757575');
  }
  for (const r of [0.5, -0.5]) {
    const log = box(1.1, 0.16, 0.16, mat('#4e342e'));
    log.position.y = 0.12;
    log.rotation.y = r;
    g.add(log);
  }
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.9, 7), glowMat('#ff9800', 2.5));
  flame.position.y = 0.55;
  g.add(flame);
  const inner = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.6, 6), glowMat('#ffeb3b', 3));
  inner.position.y = 0.45;
  g.add(inner);
  // Oturmak için kütükler
  part(g, 1.4, 0.35, 0.4, 0, 0.18, 1.9, '#5d4037');
  part(g, 0.4, 0.35, 1.4, -1.9, 0.18, 0, '#5d4037');
  g.position.set(x, 0, z);
  world.root.add(g);
  const light = new THREE.PointLight('#ff9e40', 8, 22, 1.6);
  light.position.set(x, 1.4, z);
  world.root.add(light);
  world.collision.add(boxFromBase(x, 0, z, 1.0, 0.5, 1.0, { kind: 'static' }));
  return { name: 'Kamp ateşi', x, z, r: 2.6, light, flame, inner };
}

// Göl ve kamp ateşlerinin çevresi ağaçsız kalsın
export const SURVIVAL_CLEAR = [[LAKE.x - LAKE.r - 6, LAKE.z - LAKE.r - 6, LAKE.x + LAKE.r + 6, LAKE.z + LAKE.r + 6]];

const CAMPFIRES = [[-71, 98], [VILLAGE.x + 8, VILLAGE.z + 14], [-30, 54], [55, 128], [-58, -106], [120, -20]];

export function buildSurvival(world) {
  const sources = [buildLake(world)];
  sources.push(buildWell(world, ...freeSpot(world, VILLAGE.x + 4, VILLAGE.z + 4, 1.8)));
  sources.push(buildPump(world, ...freeSpot(world, -40, 52, 1.2)));
  sources.push(buildTank(world, ...freeSpot(world, BASE.x - 22, BASE.z + 8, 2.6)));
  world.waterSources = sources;
  world.campfires = CAMPFIRES.map(([x, z]) => buildCampfire(world, ...freeSpot(world, x, z, 2.2)));
  for (const c of world.campfires) world.extraClear.push([c.x - 8, c.z - 8, c.x + 8, c.z + 8]);
  world.extraClear.push(...SURVIVAL_CLEAR);
}
