import * as THREE from 'three';
import { part, mat, glowMat } from './materials.js';

// Tüm eşya modelleri kutulardan; ileri yön -Z (kamera ile aynı).

export function crowbarModel() {
  const g = new THREE.Group();
  part(g, 0.05, 0.05, 0.85, 0, 0, -0.1, '#9b1c1c');
  const hook = part(g, 0.05, 0.05, 0.18, 0, 0.06, -0.55, '#9b1c1c');
  hook.rotation.x = 0.9;
  part(g, 0.06, 0.06, 0.2, 0, 0, 0.3, '#222');
  return g;
}

export function pistolModel() {
  const g = new THREE.Group();
  part(g, 0.08, 0.09, 0.3, 0, 0.05, -0.05, '#2a2a2a');
  part(g, 0.03, 0.03, 0.06, 0, 0.05, -0.23, '#111');
  const grip = part(g, 0.075, 0.18, 0.09, 0, -0.07, 0.06, '#3a2a1a');
  grip.rotation.x = -0.25;
  return g;
}

export function shotgunModel() {
  const g = new THREE.Group();
  part(g, 0.06, 0.06, 0.95, 0, 0.04, -0.25, '#2f2f2f');
  part(g, 0.05, 0.05, 0.7, 0, -0.03, -0.2, '#2f2f2f');
  part(g, 0.1, 0.08, 0.26, 0, -0.02, -0.35, '#6b4423');
  part(g, 0.09, 0.12, 0.28, 0, 0.0, 0.25, '#2a2a2a');
  const stock = part(g, 0.08, 0.16, 0.38, 0, -0.06, 0.55, '#6b4423');
  stock.rotation.x = 0.12;
  return g;
}

export function smgModel() {
  const g = new THREE.Group();
  part(g, 0.09, 0.13, 0.5, 0, 0.02, 0, '#222');
  part(g, 0.04, 0.04, 0.22, 0, 0.04, -0.35, '#111');
  part(g, 0.05, 0.26, 0.08, 0, -0.17, -0.08, '#1a1a1a');
  part(g, 0.07, 0.15, 0.08, 0, -0.1, 0.14, '#1a1a1a');
  part(g, 0.04, 0.04, 0.3, 0, 0.02, 0.38, '#333');
  part(g, 0.02, 0.05, 0.04, 0, 0.11, -0.15, '#111');
  return g;
}

export function rocketModel() {
  const g = new THREE.Group();
  part(g, 0.17, 0.17, 1.05, 0, 0, -0.05, '#4b5320');
  part(g, 0.2, 0.2, 0.08, 0, 0, -0.58, '#3a3f1a');
  part(g, 0.2, 0.2, 0.08, 0, 0, 0.47, '#3a3f1a');
  part(g, 0.08, 0.16, 0.1, 0, -0.15, 0.05, '#222');
  part(g, 0.06, 0.08, 0.16, -0.12, 0.1, -0.1, '#222');
  return g;
}

export function rocketProjectileModel() {
  const g = new THREE.Group();
  part(g, 0.12, 0.12, 0.45, 0, 0, 0, '#5a6328');
  part(g, 0.1, 0.1, 0.12, 0, 0, -0.28, '#b71c1c');
  part(g, 0.08, 0.08, 0.06, 0, 0, 0.25, glowMat('#ffb300', 2));
  return g;
}

export function grenadeModel() {
  const g = new THREE.Group();
  part(g, 0.13, 0.15, 0.13, 0, 0, 0, '#3d4a2a');
  part(g, 0.05, 0.05, 0.05, 0, 0.1, 0, '#888');
  part(g, 0.02, 0.1, 0.03, 0.05, 0.05, 0, '#999');
  return g;
}

export function tntModel() {
  const g = new THREE.Group();
  for (let i = -1; i <= 1; i++) part(g, 0.08, 0.36, 0.08, i * 0.085, 0, 0, '#c0392b');
  part(g, 0.27, 0.05, 0.1, 0, 0.05, 0, '#222');
  part(g, 0.27, 0.05, 0.1, 0, -0.09, 0, '#222');
  part(g, 0.015, 0.12, 0.015, 0, 0.24, 0, '#eee');
  return g;
}

export function c4Model() {
  const g = new THREE.Group();
  part(g, 0.28, 0.08, 0.18, 0, 0, 0, '#b8b08d');
  part(g, 0.1, 0.03, 0.08, 0.04, 0.055, 0, '#222');
  const led = part(g, 0.025, 0.025, 0.025, -0.08, 0.055, 0.03, glowMat('#ff1744', 3));
  led.name = 'led';
  part(g, 0.3, 0.02, 0.02, 0, 0.0, 0.08, '#c62828');
  return g;
}

export function zombieHeadModel() {
  const g = new THREE.Group();
  part(g, 0.42, 0.5, 0.42, 0, 0, 0, glowMat('#8dff4a', 0.6));
  part(g, 0.08, 0.06, 0.02, -0.1, 0.06, -0.215, glowMat('#ffeb3b', 2));
  part(g, 0.08, 0.06, 0.02, 0.1, 0.06, -0.215, glowMat('#ffeb3b', 2));
  part(g, 0.2, 0.05, 0.02, 0, -0.1, -0.215, '#1b3010');
  return g;
}

export function gasCanModel() {
  const g = new THREE.Group();
  part(g, 0.36, 0.45, 0.18, 0, 0, 0, '#c62828');
  part(g, 0.24, 0.05, 0.05, 0.02, 0.26, 0, '#222');
  part(g, 0.05, 0.08, 0.05, -0.13, 0.27, 0, '#222');
  part(g, 0.37, 0.04, 0.19, 0, 0.05, 0, '#8e1b1b');
  return g;
}

export function ammoBoxModel(color = '#556b2f') {
  const g = new THREE.Group();
  part(g, 0.36, 0.2, 0.22, 0, 0, 0, color);
  part(g, 0.37, 0.05, 0.23, 0, 0.03, 0, '#e0b400');
  part(g, 0.12, 0.04, 0.05, 0, 0.12, 0, '#222');
  return g;
}

export function armorModel() {
  const g = new THREE.Group();
  part(g, 0.48, 0.55, 0.18, 0, 0, 0, '#2c3e50');
  part(g, 0.36, 0.3, 0.04, 0, 0.04, -0.1, '#3d566e');
  part(g, 0.1, 0.12, 0.2, -0.17, 0.3, 0, '#2c3e50');
  part(g, 0.1, 0.12, 0.2, 0.17, 0.3, 0, '#2c3e50');
  return g;
}

export function medkitModel() {
  const g = new THREE.Group();
  part(g, 0.4, 0.26, 0.18, 0, 0, 0, '#f5f5f5');
  part(g, 0.18, 0.05, 0.19, 0, 0, 0, '#d32f2f');
  part(g, 0.05, 0.18, 0.19, 0, 0, 0, '#d32f2f');
  part(g, 0.14, 0.04, 0.04, 0, 0.15, 0, '#555');
  return g;
}

// Çiğ et parçası (kemikli)
export function meatModel() {
  const g = new THREE.Group();
  part(g, 0.34, 0.16, 0.24, 0, 0, 0, '#c62828');
  part(g, 0.26, 0.04, 0.2, 0, 0.09, 0, '#ef9a9a');
  part(g, 0.3, 0.06, 0.06, 0.24, 0.02, 0, '#f5f5f5');
  part(g, 0.08, 0.1, 0.1, 0.4, 0.02, 0, '#f5f5f5');
  return g;
}

export function laserModel() {
  const g = new THREE.Group();
  part(g, 0.1, 0.12, 0.42, 0, 0.04, -0.05, '#eceff1');
  part(g, 0.06, 0.06, 0.2, 0, 0.05, -0.33, glowMat('#ff1744', 2));
  part(g, 0.13, 0.05, 0.3, 0, 0.12, -0.02, '#90a4ae');
  part(g, 0.08, 0.2, 0.1, 0, -0.08, 0.08, '#37474f');
  part(g, 0.11, 0.06, 0.06, 0, 0.02, 0.12, glowMat('#00e5ff', 1.5));
  return g;
}

// Zehir şişesi (bilim insanları fırlatır)
export function flaskModel() {
  const g = new THREE.Group();
  part(g, 0.16, 0.2, 0.16, 0, 0, 0, glowMat('#76ff03', 1.2));
  part(g, 0.06, 0.1, 0.06, 0, 0.15, 0, '#eceff1');
  return g;
}

export const WEAPON_MODELS = {
  laser: laserModel,
  crowbar: crowbarModel,
  pistol: pistolModel,
  shotgun: shotgunModel,
  smg: smgModel,
  rocket: rocketModel,
  grenade: grenadeModel,
  head: zombieHeadModel,
  tnt: tntModel,
  c4: c4Model,
};

export function outlineGlow(group, color = '#fff59d') {
  // Gece bulunabilsin diye eşyanın altına zayıf parlayan bir halka
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.35, 0.5, 20),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.name = 'ring';
  group.add(ring);
  return ring;
}

export { mat };
