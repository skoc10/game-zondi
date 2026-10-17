import * as THREE from 'three';
import { lerp, smoothstep } from '../core/math.js';

// Bir tam gün ~6 dk: gündüz 0–210 s, alacakaranlık 210–240, gece 240–345, şafak 345–360.
export const CYCLE = 360;
export const DUSK_START = 210;
export const NIGHT_START = 240;
export const DAWN_START = 345;
export const START_TIME = 60;

export function nightFactorAt(t) {
  t = ((t % CYCLE) + CYCLE) % CYCLE;
  if (t < DUSK_START) return 0;
  if (t < NIGHT_START) return smoothstep(DUSK_START, NIGHT_START, t);
  if (t < DAWN_START) return 1;
  return 1 - smoothstep(DAWN_START, CYCLE, t);
}

const DAY_SKY = new THREE.Color('#8fbfe0');
const DUSK_SKY = new THREE.Color('#d9825b');
const NIGHT_SKY = new THREE.Color('#020306');
const DAY_SUN = new THREE.Color('#fff1d6');
const DUSK_SUN = new THREE.Color('#ff9a5c');
const MOON = new THREE.Color('#6f8fd6');

export class DayNight {
  constructor(scene) {
    this.scene = scene;
    this.time = START_TIME;
    this.night = 0;
    this.hemi = new THREE.HemisphereLight('#cfe8ff', '#3b4a26', 1.4);
    scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#fff1d6', 2.4);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -45; sc.right = 45; sc.top = 45; sc.bottom = -45; sc.near = 1; sc.far = 160;
    this.sun.shadow.bias = -0.0008;
    this.sun.shadow.normalBias = 0.03;
    scene.add(this.sun);
    scene.add(this.sun.target);
    scene.fog = new THREE.Fog(DAY_SKY.clone(), 35, 170);
    scene.background = DAY_SKY.clone();
    this.skyColor = new THREE.Color();
  }

  reset() {
    this.time = START_TIME;
  }

  get phaseTime() {
    return ((this.time % CYCLE) + CYCLE) % CYCLE;
  }

  get isNight() {
    return this.night > 0.6;
  }

  // HUD için: { label, remaining }
  phaseInfo() {
    const t = this.phaseTime;
    if (t < DUSK_START) return { label: 'Gündüz', remaining: DUSK_START - t, icon: '☀' };
    if (t < NIGHT_START) return { label: 'Akşam', remaining: NIGHT_START - t, icon: '◐' };
    if (t < DAWN_START) return { label: 'Gece', remaining: DAWN_START - t, icon: '☾' };
    return { label: 'Şafak', remaining: CYCLE - t, icon: '◑' };
  }

  update(dt, playerPos) {
    this.time += dt;
    const t = this.phaseTime;
    const n = nightFactorAt(t);
    this.night = n;
    // Alacakaranlık rengi geçişlerin ortasında en güçlü
    const dusk = Math.max(0, 1 - Math.abs(n - 0.4) / 0.4) * (n < 1 ? 1 : 0);

    this.skyColor.copy(DAY_SKY).lerp(DUSK_SKY, dusk * 0.8).lerp(NIGHT_SKY, smoothstep(0.3, 1, n));
    this.scene.background.copy(this.skyColor);
    this.scene.fog.color.copy(this.skyColor);
    this.scene.fog.near = lerp(35, 4, n);
    this.scene.fog.far = lerp(170, 42, n);

    this.hemi.intensity = lerp(1.4, 0.05, n);
    this.hemi.color.set(n > 0.5 ? '#3a4a80' : '#cfe8ff');
    this.sun.intensity = lerp(2.4, 0.12, n);
    this.sun.color.copy(DAY_SUN).lerp(DUSK_SUN, dusk).lerp(MOON, smoothstep(0.5, 1, n));

    // Güneş gün boyunca gökyüzünde döner; gece ay gibi düşük açıda kalır
    const dayProgress = Math.min(1, t / NIGHT_START);
    const ang = lerp(-0.9, 0.9, dayProgress);
    const elev = n > 0.5 ? 0.9 : lerp(1.2, 0.35, Math.abs(ang) / 0.9);
    const dir = new THREE.Vector3(Math.sin(ang) * 60, Math.sin(elev) * 80, Math.cos(ang) * 40);
    this.sun.position.set(playerPos.x + dir.x, dir.y, playerPos.z + dir.z);
    this.sun.target.position.set(playerPos.x, 0, playerPos.z);
  }
}
