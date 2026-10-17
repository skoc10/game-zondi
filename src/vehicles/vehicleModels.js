import * as THREE from 'three';
import { part, glowMat } from '../world/materials.js';

// Kutu araç modelleri. Köken: zemin seviyesinde aracın ortası. İleri yön -Z.
// Dönen parçalar { rotor, tailRotor, prop, turret, barrel, wheels } içinde döner.

const headlight = () => glowMat('#fff8e1', 0.8);

function wheel(g, x, y, z, r, w, list) {
  const m = part(g, w, r * 2, r * 2, x, y, z, '#161616');
  list.push(m);
  return m;
}

export function motorcycleModel() {
  const g = new THREE.Group();
  const wheels = [];
  wheel(g, 0, 0.32, -0.75, 0.32, 0.14, wheels);
  wheel(g, 0, 0.32, 0.75, 0.32, 0.16, wheels);
  part(g, 0.18, 0.18, 1.4, 0, 0.55, 0, '#333');
  part(g, 0.36, 0.26, 0.5, 0, 0.78, -0.3, '#b71c1c');
  part(g, 0.32, 0.12, 0.6, 0, 0.78, 0.22, '#1c1c1c');
  part(g, 0.06, 0.45, 0.06, 0, 0.85, -0.75, '#888');
  part(g, 0.7, 0.05, 0.05, 0, 1.08, -0.68, '#222');
  part(g, 0.14, 0.1, 0.05, 0, 0.9, -0.95, headlight());
  part(g, 0.12, 0.12, 0.5, 0.18, 0.4, 0.45, '#777');
  return { group: g, wheels };
}

export function jeepModel() {
  const g = new THREE.Group();
  const wheels = [];
  const olive = '#4b5320';
  part(g, 2.0, 0.7, 4.2, 0, 0.75, 0, olive);
  part(g, 1.9, 0.5, 1.4, 0, 1.3, -1.2, '#434a1c');
  part(g, 1.9, 0.6, 0.06, 0, 1.55, -0.45, '#90a4ae');
  part(g, 0.08, 0.9, 0.08, -0.9, 1.55, 0.6, '#222');
  part(g, 0.08, 0.9, 0.08, 0.9, 1.55, 0.6, '#222');
  part(g, 1.88, 0.08, 0.08, 0, 2.0, 0.6, '#222');
  part(g, 0.5, 0.35, 0.7, -0.45, 1.25, 0.2, '#2f3514');
  part(g, 0.5, 0.35, 0.7, 0.45, 1.25, 0.2, '#2f3514');
  part(g, 0.7, 0.7, 0.2, 0, 1.0, 2.2, '#161616');
  for (const [x, z] of [[-1.0, -1.35], [1.0, -1.35], [-1.0, 1.35], [1.0, 1.35]]) wheel(g, x, 0.42, z, 0.42, 0.32, wheels);
  part(g, 0.35, 0.2, 0.06, -0.6, 0.9, -2.11, headlight());
  part(g, 0.35, 0.2, 0.06, 0.6, 0.9, -2.11, headlight());
  part(g, 0.3, 0.3, 0.03, 0, 1.11, 0.4, '#f5f5f5');
  return { group: g, wheels };
}

export function pickupModel() {
  const g = new THREE.Group();
  const wheels = [];
  const body = '#8e2b22';
  part(g, 2.1, 0.75, 5.0, 0, 0.8, 0, body);
  part(g, 2.0, 0.8, 1.9, 0, 1.55, -0.6, body);
  part(g, 2.02, 0.55, 0.06, 0, 1.6, -1.56, '#90caf9');
  part(g, 2.02, 0.45, 0.06, 0, 1.6, 0.36, '#90caf9');
  part(g, 2.1, 0.5, 0.1, 0, 1.4, 2.45, body);
  part(g, 0.1, 0.5, 2.0, -1.0, 1.4, 1.45, body);
  part(g, 0.1, 0.5, 2.0, 1.0, 1.4, 1.45, body);
  part(g, 1.8, 0.05, 1.9, 0, 1.18, 1.45, '#3e2723');
  for (const [x, z] of [[-1.05, -1.6], [1.05, -1.6], [-1.05, 1.6], [1.05, 1.6]]) wheel(g, x, 0.42, z, 0.42, 0.3, wheels);
  part(g, 0.4, 0.2, 0.06, -0.65, 0.95, -2.51, headlight());
  part(g, 0.4, 0.2, 0.06, 0.65, 0.95, -2.51, headlight());
  return { group: g, wheels };
}

// 1. bölümdeki mavi araba: artık sürülebilir
export function sedanModel() {
  const g = new THREE.Group();
  const wheels = [];
  const blue = '#1e5aa8';
  part(g, 2.0, 0.75, 4.4, 0, 0.75, 0, blue);
  part(g, 1.8, 0.65, 2.2, 0, 1.45, 0.3, blue);
  part(g, 1.82, 0.5, 0.06, 0, 1.47, -0.8, '#90caf9');
  part(g, 1.82, 0.45, 0.06, 0, 1.47, 1.42, '#90caf9');
  for (const [x, z] of [[-0.95, -1.4], [0.95, -1.4], [-0.95, 1.4], [0.95, 1.4]]) wheel(g, x, 0.35, z, 0.35, 0.3, wheels);
  part(g, 0.4, 0.18, 0.06, -0.6, 0.85, -2.21, headlight());
  part(g, 0.4, 0.18, 0.06, 0.6, 0.85, -2.21, headlight());
  part(g, 0.35, 0.15, 0.06, -0.65, 0.9, 2.21, glowMat('#d50000', 0.5));
  part(g, 0.35, 0.15, 0.06, 0.65, 0.9, 2.21, glowMat('#d50000', 0.5));
  return { group: g, wheels };
}

export function tankModel() {
  const g = new THREE.Group();
  const olive = '#4f5a2a';
  part(g, 2.6, 1.0, 6.6, 0, 1.0, 0, olive);
  part(g, 0.75, 1.0, 7.0, -1.45, 0.55, 0, '#1f1f1f');
  part(g, 0.75, 1.0, 7.0, 1.45, 0.55, 0, '#1f1f1f');
  part(g, 2.4, 0.3, 1.2, 0, 1.4, -3.0, '#454f22');
  const turret = new THREE.Group();
  turret.position.set(0, 1.5, 0.4);
  part(turret, 2.3, 0.85, 2.8, 0, 0.42, 0, '#56622e');
  part(turret, 0.8, 0.25, 0.8, 0.5, 0.95, 0.5, '#454f22');
  const barrel = new THREE.Group();
  barrel.position.set(0, 0.45, -1.3);
  part(barrel, 0.26, 0.26, 3.8, 0, 0, -1.9, '#3f4720');
  part(barrel, 0.36, 0.36, 0.5, 0, 0, -3.7, '#333a18');
  turret.add(barrel);
  g.add(turret);
  part(g, 0.4, 0.25, 0.06, -0.9, 1.3, -3.31, headlight());
  part(g, 0.4, 0.25, 0.06, 0.9, 1.3, -3.31, headlight());
  return { group: g, turret, barrel, wheels: [] };
}

export function heliModel() {
  const g = new THREE.Group();
  const olive = '#3f4a22';
  part(g, 2.2, 1.9, 4.6, 0, 1.55, 0, olive);
  part(g, 2.0, 1.3, 1.4, 0, 1.6, -2.7, '#7fb3d5');
  part(g, 0.6, 0.6, 5.2, 0, 2.0, 4.6, olive);
  part(g, 0.15, 1.6, 1.0, 0, 2.7, 7.0, olive);
  part(g, 2.0, 0.12, 0.8, 0, 2.1, 6.8, olive);
  part(g, 0.12, 0.12, 4.8, -0.95, 0.12, 0, '#222');
  part(g, 0.12, 0.12, 4.8, 0.95, 0.12, 0, '#222');
  for (const z of [-1.4, 1.4]) {
    part(g, 0.1, 0.5, 0.1, -0.95, 0.4, z, '#222');
    part(g, 0.1, 0.5, 0.1, 0.95, 0.4, z, '#222');
  }
  part(g, 0.5, 0.4, 0.5, 0, 2.7, 0, '#222');
  const rotor = new THREE.Group();
  rotor.position.set(0, 2.95, 0);
  part(rotor, 11, 0.06, 0.35, 0, 0, 0, '#1a1a1a');
  part(rotor, 0.35, 0.06, 11, 0, 0, 0, '#1a1a1a');
  g.add(rotor);
  const tailRotor = new THREE.Group();
  tailRotor.position.set(0.15, 2.6, 7.2);
  part(tailRotor, 0.05, 1.8, 0.2, 0, 0, 0, '#1a1a1a');
  g.add(tailRotor);
  part(g, 0.4, 0.4, 1.2, -1.3, 1.0, -0.6, '#2b2b2b');
  part(g, 0.4, 0.4, 1.2, 1.3, 1.0, -0.6, '#2b2b2b');
  part(g, 0.2, 0.2, 0.06, 0, 0.9, -3.42, glowMat('#ff1744', 2));
  return { group: g, rotor, tailRotor, wheels: [] };
}

export function planeModel() {
  const g = new THREE.Group();
  const body = '#cfd8dc';
  const trim = '#c62828';
  part(g, 1.3, 1.3, 7.0, 0, 1.6, 0, body);
  part(g, 1.0, 0.7, 1.6, 0, 2.45, -0.8, '#64b5f6');
  part(g, 10, 0.15, 1.7, 0, 1.5, -0.6, body);
  part(g, 1.2, 0.16, 1.72, -4.2, 1.5, -0.6, trim);
  part(g, 1.2, 0.16, 1.72, 4.2, 1.5, -0.6, trim);
  part(g, 3.6, 0.12, 1.0, 0, 1.75, 3.2, body);
  part(g, 0.14, 1.4, 1.1, 0, 2.5, 3.2, trim);
  part(g, 0.9, 0.9, 0.5, 0, 1.6, -3.6, '#455a64');
  const prop = new THREE.Group();
  prop.position.set(0, 1.6, -3.9);
  part(prop, 0.18, 2.6, 0.06, 0, 0, 0, '#1a1a1a');
  part(prop, 2.6, 0.18, 0.06, 0, 0, 0, '#1a1a1a');
  g.add(prop);
  const wheels = [];
  for (const [x, z] of [[-1.3, -0.6], [1.3, -0.6]]) {
    part(g, 0.08, 0.9, 0.08, x, 0.75, z, '#333');
    wheel(g, x, 0.3, z, 0.3, 0.2, wheels);
  }
  wheel(g, 0, 0.2, 3.3, 0.2, 0.15, wheels);
  return { group: g, prop, wheels };
}

export const VEHICLE_MODELS = {
  motorcycle: motorcycleModel,
  jeep: jeepModel,
  pickup: pickupModel,
  sedan: sedanModel,
  tank: tankModel,
  heli: heliModel,
  plane: planeModel,
};

// Araçtayken görünen oturan oyuncu figürü (zombi olmadığı belli olsun diye yeşil değil)
export function playerAvatar() {
  const g = new THREE.Group();
  part(g, 0.5, 0.65, 0.3, 0, 0.35, 0, '#5d4037');
  part(g, 0.36, 0.38, 0.36, 0, 0.88, 0, '#f1c27d');
  part(g, 0.38, 0.12, 0.38, 0, 1.08, 0, '#3e2723');
  part(g, 0.16, 0.5, 0.16, -0.33, 0.35, -0.2, '#5d4037').rotation.x = -1.1;
  part(g, 0.16, 0.5, 0.16, 0.33, 0.35, -0.2, '#5d4037').rotation.x = -1.1;
  part(g, 0.2, 0.2, 0.6, -0.13, 0.0, -0.25, '#1e3a5f');
  part(g, 0.2, 0.2, 0.6, 0.13, 0.0, -0.25, '#1e3a5f');
  return g;
}
