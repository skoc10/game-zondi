import * as THREE from 'three';
import * as M from '../world/models.js';
import { WEAPONS, THROWABLES } from '../weapons/weaponData.js';

// type: weapon | ammo | grenade | tnt | c4 | head | armor | medkit | gas | meat
const BUILDERS = {
  ammo: () => M.ammoBoxModel(),
  grenade: M.grenadeModel,
  tnt: M.tntModel,
  c4: M.c4Model,
  head: M.zombieHeadModel,
  armor: M.armorModel,
  medkit: M.medkitModel,
  gas: M.gasCanModel,
  meat: M.meatModel,
};

const RING = { meat: '#ff8a80', gas: '#ff7043', weapon: '#fff59d', head: '#b2ff59', armor: '#64b5f6', medkit: '#ef9a9a' };

export function pickupLabel(p) {
  switch (p.type) {
    case 'weapon': return `${WEAPONS[p.weapon].name} al`;
    case 'ammo': return 'Mermi al';
    case 'grenade': return 'Bomba al';
    case 'tnt': return 'TNT al';
    case 'c4': return 'C4 al';
    case 'head': return `${THROWABLES.head.name} al`;
    case 'armor': return 'Zırh giy';
    case 'medkit': return 'İlk yardım kullan';
    case 'gas': return 'Benzin bidonunu al';
    case 'meat': return 'Çiğ eti al';
    default: return 'Al';
  }
}

export class PickupManager {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
    this.time = 0;
  }

  spawn(type, x, z, data = {}) {
    const g = new THREE.Group();
    const model = type === 'weapon' ? M.WEAPON_MODELS[data.weapon]() : BUILDERS[type]();
    const s = type === 'weapon' ? 1.5 : type === 'gas' ? 1.6 : 1.4;
    model.scale.setScalar(s);
    g.add(model);
    M.outlineGlow(g, RING[type] || '#fff59d');
    g.position.set(x, 0, z);
    this.scene.add(g);
    const p = {
      type, ...data, mesh: g, model, pos: new THREE.Vector3(x, 0, z),
      life: type === 'gas' ? Infinity : type === 'head' ? 45 : type === 'meat' ? 120 : 75,
      phase: Math.random() * 6,
    };
    this.list.push(p);
    return p;
  }

  remove(p) {
    this.scene.remove(p.mesh);
    const i = this.list.indexOf(p);
    if (i >= 0) this.list.splice(i, 1);
  }

  clear() {
    for (const p of this.list) this.scene.remove(p.mesh);
    this.list = [];
  }

  // filter verilirse sadece ona uyan en yakın eşya
  nearest(pos, maxDist = 2.2, filter = null) {
    let best = null;
    let bd = maxDist;
    for (const p of this.list) {
      if (filter && !filter(p)) continue;
      const d = Math.hypot(p.pos.x - pos.x, p.pos.z - pos.z);
      if (d < bd && Math.abs(pos.y - p.pos.y) < 2.5) {
        bd = d;
        best = p;
      }
    }
    return best;
  }

  update(dt) {
    this.time += dt;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.remove(p);
        continue;
      }
      p.model.position.y = 0.45 + Math.sin(this.time * 2.5 + p.phase) * 0.1;
      p.model.rotation.y += dt * 1.4;
      // Kaybolmadan önce yanıp söner
      p.mesh.visible = p.life > 6 || Math.sin(this.time * 18) > 0;
    }
  }
}
