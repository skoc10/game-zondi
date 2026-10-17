import * as THREE from 'three';

export const BOX_GEO = new THREE.BoxGeometry(1, 1, 1);
const cache = new Map();

// Aynı renkteki parçalar tek materyali paylaşır.
export function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  let m = cache.get(key);
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color, ...opts });
    cache.set(key, m);
  }
  return m;
}

export function glowMat(color, intensity = 1) {
  return mat(color, { emissive: color, emissiveIntensity: intensity });
}

export function box(w, h, d, material) {
  const m = new THREE.Mesh(BOX_GEO, typeof material === 'object' ? material : mat(material));
  m.scale.set(w, h, d);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// Merkez konumlu parça ekler
export function part(parent, w, h, d, x, y, z, material) {
  const m = box(w, h, d, material);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}
