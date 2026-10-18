import * as THREE from 'three';
import { WEAPONS, SLOTS, THROWABLES } from './weaponData.js';
import { WEAPON_MODELS, gasCanModel } from '../world/models.js';
import { damp, clamp, angleDiff } from '../core/math.js';
import { settings } from '../core/Settings.js';

const HOLD = new THREE.Vector3(0.28, -0.27, -0.55);
const tmpV = new THREE.Vector3();

export class WeaponSystem {
  constructor(game) {
    this.game = game;
    this.vmScene = new THREE.Scene();
    this.vmCamera = new THREE.PerspectiveCamera(60, 1, 0.01, 10);
    this.vmHemi = new THREE.HemisphereLight('#ffffff', '#445544', 1.5);
    this.vmScene.add(this.vmHemi);
    this.vmDir = new THREE.DirectionalLight('#ffffff', 1);
    this.vmDir.position.set(1, 2, 1);
    this.vmScene.add(this.vmDir);
    this.muzzleLight = new THREE.PointLight('#ffcc66', 0, 12, 1.5);
    game.scene.add(this.muzzleLight);
    this.vmMuzzle = new THREE.PointLight('#ffcc66', 0, 3, 1.5);
    this.vmMuzzle.position.set(0.25, -0.15, -1);
    this.vmScene.add(this.vmMuzzle);

    this.holder = new THREE.Group();
    this.vmScene.add(this.holder);
    this.models = {};
    for (const id of Object.keys(WEAPON_MODELS)) {
      const m = WEAPON_MODELS[id]();
      m.visible = false;
      this.holder.add(m);
      this.models[id] = m;
    }
    // Elde tutma boyutu ve konumu (uzun silahlar kameraya girmesin)
    const VM = {
      crowbar: [0.8, 0, -0.05, -0.1], pistol: [0.75, 0, 0.03, -0.18], laser: [1, 0, 0.03, -0.12], shotgun: [0.6, 0, 0.03, -0.32],
      smg: [0.75, 0, 0.02, -0.18], rocket: [0.55, 0.02, 0.1, -0.3],
      grenade: [1.2, -0.04, 0.12, 0], head: [0.7, -0.05, 0.1, -0.05], tnt: [1, -0.05, 0.12, 0], c4: [1, -0.05, 0.14, 0],
    };
    for (const [id, [sc, x, y, z]] of Object.entries(VM)) {
      this.models[id].scale.setScalar(sc);
      this.models[id].position.set(x, y, z);
    }
    this.gasCan = gasCanModel();
    this.gasCan.position.set(-0.35, -0.42, -0.6);
    this.gasCan.rotation.set(0.1, 0.4, 0);
    this.gasCan.visible = false;
    this.vmScene.add(this.gasCan);
    // Namlu alevi
    this.flash = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.12, 0.12),
      new THREE.MeshBasicMaterial({ color: '#ffe082', transparent: true, opacity: 0.95 }),
    );
    this.flash.visible = false;
    this.vmScene.add(this.flash);
    this.reset();
  }

  reset() {
    this.cooldown = 0;
    this.reloading = 0;
    this.switchAnim = 0;
    this.kick = 0;
    this.swing = 0;
    this.throwAnim = 0;
    this.flashTime = 0;
    this.sway = new THREE.Vector2();
    this.shown = null;
    this.pendingMelee = -1;
    this.aim = 0;
  }

  get inv() {
    return this.game.inventory;
  }

  currentModelId() {
    const id = this.inv.activeId;
    if (id === 'throwable') return this.inv.throwKind;
    return id;
  }

  update(dt, s) {
    const g = this.game;
    const inv = this.inv;
    const player = g.player;
    this.cooldown -= dt;
    this.flashTime -= dt;

    // Eşya değiştirme
    const prev = inv.active;
    const prevThrow = inv.throwKind;
    if (s.slot >= 0) inv.select(s.slot);
    if (s.next) inv.cycle(1);
    if (s.prev) inv.cycle(-1);
    if (inv.active !== prev || inv.throwKind !== prevThrow) this.onSwitch();

    // C4 her slottan G ile; C4 eldeyken sağ tıkla da patlar
    const detonate = s.detonate || (inv.activeId === 'c4' && s.secondary);
    if (detonate && g.explosives.detonateC4() > 0) g.hud.toast('C4 patlatıldı!');

    const id = inv.activeId;
    const w = WEAPONS[id];

    // Şarjör
    if (this.reloading > 0) {
      this.reloading -= dt;
      if (this.reloading <= 0) inv.reload(id);
    } else if (s.reload && inv.canReload(id)) {
      this.startReload(id);
    }

    this.aim = damp(this.aim, s.aim ? 1 : 0, 12, dt);
    if (s.aim || (s.fire && g.input.lastDevice === 'pad')) this.aimAssist(dt, s.aim ? 1 : 0.35);

    const ready = this.cooldown <= 0 && this.reloading <= 0 && this.switchAnim <= 0.3 && player.alive;
    if (ready) {
      const trigger = w.auto ? s.fire : s.firePressed;
      switch (w.kind) {
        case 'melee':
          if (s.fire) this.melee();
          break;
        case 'hitscan':
        case 'rocket':
          if (trigger) {
            if (inv.mag[id] > 0) this.shoot(id);
            else if (inv.canReload(id)) this.startReload(id);
            else if (s.firePressed) {
              g.audio.play('empty');
              g.hud.toast('Mermi yok!');
              this.cooldown = 0.25;
            }
          }
          break;
        case 'throw':
          if (s.firePressed) this.throwItem();
          break;
        case 'place':
          if (s.firePressed) this.placeTNT();
          break;
        case 'c4':
          if (s.firePressed) this.placeC4();
          break;
        default:
          break;
      }
    }

    if (this.pendingMelee >= 0) {
      this.pendingMelee -= dt;
      if (this.pendingMelee < 0) this.meleeHit();
    }
    this.animate(dt, s);
  }

  onSwitch() {
    this.switchAnim = 0.45;
    this.reloading = 0;
    this.cooldown = Math.max(this.cooldown, 0.15);
  }

  startReload(id) {
    this.reloading = WEAPONS[id].reload;
    this.game.audio.play('reload');
  }

  aimAssist(dt, strength) {
    const g = this.game;
    if (g.input.lastDevice !== 'pad' || !settings.aimAssist) return;
    const eye = g.player.eye;
    const fwd = g.player.forward();
    let best = null;
    let bestAng = 0.13;
    for (const z of g.zombies.list) {
      if (!z.alive) continue;
      const target = z.headless ? z.chestPos : z.chestPos.lerp(z.headPos, 0.5);
      tmpV.subVectors(target, eye);
      const d = tmpV.length();
      if (d > 45) continue;
      tmpV.divideScalar(d);
      const ang = Math.acos(clamp(tmpV.dot(fwd), -1, 1));
      if (ang < bestAng) {
        bestAng = ang;
        best = target;
      }
    }
    if (!best) return;
    tmpV.subVectors(best, eye).normalize();
    const ty = Math.atan2(-tmpV.x, -tmpV.z);
    const tp = Math.asin(clamp(tmpV.y, -1, 1));
    const rate = 2.2 * strength * dt;
    g.player.yaw += clamp(angleDiff(g.player.yaw, ty), -rate, rate);
    g.player.pitch += clamp(tp - g.player.pitch, -rate, rate);
  }

  muzzleWorld() {
    const cam = this.game.camera;
    return tmpV.set(0.18, -0.12, -0.7).applyMatrix4(cam.matrixWorld).clone();
  }

  shoot(id) {
    const g = this.game;
    const w = WEAPONS[id];
    const inv = this.inv;
    inv.useAmmo(id);
    this.cooldown = w.interval;
    this.kick = 1;
    this.flashTime = 0.05;
    const player = g.player;
    // Geri tepme sadece görüntüyü sarsar ve kendiliğinden geri döner; nişan yeri kaymaz
    player.kick += w.recoil * (1 - this.aim * 0.5);
    g.audio.play(w.sound);
    g.input.rumble(id === 'shotgun' || id === 'rocket' ? 0.8 : 0.3, 0.5, id === 'smg' ? 60 : 120);
    g.zombies.alert(player.pos, 35);
    if (g.animals) g.animals.onGunshot(player.pos);
    const eye = player.eye;
    const fwd = player.forward();
    const muzzle = this.muzzleWorld();
    this.muzzleLight.position.copy(muzzle);
    this.muzzleLight.intensity = 30;

    if (w.kind === 'rocket') {
      g.explosives.fireRocket(eye.clone().addScaledVector(fwd, 0.9), fwd, 'player');
      if (inv.mag[id] === 0 && inv.reserve[id] > 0) this.startReload(id);
      return;
    }

    // Saçılma: dururken çok küçük, koşarken/zıplarken artar, nişan alınca daha da azalır
    const moveSpread = 0.35 + player.speed * 0.12 + (player.onGround ? 0 : 1.5);
    const spread = w.spread * moveSpread * (1 - this.aim * 0.6);
    const right = new THREE.Vector3(Math.cos(player.yaw), 0, -Math.sin(player.yaw));
    const up = new THREE.Vector3().crossVectors(right, fwd).normalize();
    let hitAny = false;
    let killAny = false;
    for (let i = 0; i < w.pellets; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * spread;
      const dir = fwd.clone().addScaledVector(right, Math.cos(a) * r).addScaledVector(up, Math.sin(a) * r).normalize();
      const res = this.hitscan(eye, dir, w);
      if (res.hitZombie) hitAny = true;
      if (res.killed) killAny = true;
      if (i < 3) g.particles.tracer(muzzle, res.point, w.tracer);
    }
    if (hitAny) g.hud.hitMarker(killAny);
    if (inv.mag[id] === 0 && inv.reserve[id] > 0) this.startReload(id);
  }

  hitscan(origin, dir, w) {
    const g = this.game;
    const maxT = w.range || 100;
    const wh = g.collision.raycast(origin.x, origin.y, origin.z, dir.x, dir.y, dir.z, maxT);
    const worldT = wh ? wh.t : maxT;
    const zh = g.zombies.raycast(origin, dir, worldT);
    const out = { hitZombie: false, killed: false, point: origin.clone().addScaledVector(dir, worldT) };
    // Geyik (zombiden daha yakınsa)
    const ah = g.animals ? g.animals.raycast(origin, dir, zh ? zh.t : worldT) : null;
    if (ah) {
      out.point = origin.clone().addScaledVector(dir, ah.t);
      let dmg = w.damage;
      if (w.falloff && ah.t > w.falloff) dmg *= clamp(1 - (ah.t - w.falloff) / 30, 0.25, 1);
      const r = g.animals.damage(ah.deer, dmg, ah.part, 'bullet', dir);
      g.audio.play('hit', ah.deer.pos, 0.6);
      out.hitZombie = true;
      out.killed = r.killed;
      return out;
    }
    if (zh) {
      out.point = origin.clone().addScaledVector(dir, zh.t);
      let dmg = w.damage;
      if (w.falloff && zh.t > w.falloff) dmg *= clamp(1 - (zh.t - w.falloff) / 30, 0.25, 1);
      const r = g.zombies.damage(zh.zombie, dmg, zh.part, 'bullet', dir);
      g.particles.blood(out.point, dir.clone().multiplyScalar(-0.5), zh.part === 'head' ? 10 : 6);
      g.audio.play('hit', zh.zombie.pos, 0.6);
      out.hitZombie = true;
      out.killed = r.killed;
      return out;
    }
    if (wh) {
      if (wh.box && wh.box.data) this.damageObject(wh.box.data, w.damage);
      g.particles.sparks(out.point, dir.clone().multiplyScalar(-1));
    }
    return out;
  }

  // Varil / sandık hasarı
  damageObject(data, dmg, melee = false) {
    const g = this.game;
    if (data.kind === 'barrel' && data.ref.alive) {
      data.ref.hp -= dmg;
      // Levyeyle vurulan varil tıslar: kaçmak için biraz zaman var
      if (data.ref.hp <= 0) {
        g.explosives.triggerBarrel(data.ref, melee ? 1.4 : 0.05);
        if (melee) g.hud.toast('Varil tıslıyor — KAÇ!');
      }
    } else if (data.kind === 'crate' && data.ref.alive) {
      data.ref.hp -= dmg;
      g.audio.play('wood', data.ref.pos, 0.6);
      g.particles.emit({ pos: data.ref.pos.clone().setY(0.8), count: 4, colors: ['#8d6e3f', '#5d4325'], speed: 2, up: 1, life: 0.6, size: 0.08 });
      if (data.ref.hp <= 0) g.breakCrate(data.ref);
    } else if (data.kind === 'barricade' && data.ref.alive) {
      data.ref.hp -= dmg;
      g.audio.play('wood', data.ref.pos, 0.8);
      g.particles.emit({ pos: data.ref.pos.clone(), count: 6, colors: ['#8d6e3f', '#5d4325'], speed: 3, up: 1, life: 0.7, size: 0.1 });
      if (data.ref.hp <= 0) g.breakBarricade(data.ref);
      else if (melee) g.hud.toast(`Tahtalar kırılıyor... (${Math.ceil(data.ref.hp / 30)} darbe kaldı)`);
    } else if (data.kind === 'pylon' && data.ref.alive) {
      g.damagePylon(data.ref, dmg);
    } else if (data.kind === 'vehicle' && data.ref.alive) {
      g.vehicles.damage(data.ref, dmg * data.ref.spec.armor);
    }
  }

  melee() {
    this.cooldown = WEAPONS.crowbar.interval;
    this.swing = 1;
    this.pendingMelee = 0.1;
    this.game.audio.play('swing');
  }

  meleeHit() {
    const g = this.game;
    const w = WEAPONS.crowbar;
    const eye = g.player.eye;
    const fwd = g.player.forward();
    // Önce doğrudan ışın, olmazsa önündeki koniden en yakın zombi
    let zh = g.zombies.raycast(eye, fwd, w.range);
    const ah = g.animals ? g.animals.raycast(eye, fwd, zh ? zh.t : w.range) : null;
    if (ah) {
      const r = g.animals.damage(ah.deer, w.damage, ah.part, 'melee', fwd);
      g.audio.play('hit', null, 1);
      g.hud.hitMarker(r.killed);
      return;
    }
    if (!zh) {
      let best = null;
      let bd = w.range + 0.5;
      for (const z of g.zombies.list) {
        if (!z.alive) continue;
        tmpV.subVectors(z.chestPos, eye);
        const d = Math.hypot(tmpV.x, tmpV.z) - z.radius;
        if (d > bd) continue;
        tmpV.y = 0;
        tmpV.normalize();
        const f2 = new THREE.Vector3(fwd.x, 0, fwd.z).normalize();
        if (tmpV.dot(f2) > 0.6 && g.collision.lineOfSight(eye.x, eye.y - 0.3, eye.z, z.pos.x, 1.2 * z.scale, z.pos.z)) {
          bd = d;
          best = z;
        }
      }
      if (best) zh = { zombie: best, part: 'body', t: bd };
    }
    if (zh) {
      const r = g.zombies.damage(zh.zombie, w.damage, zh.part, 'melee', fwd);
      g.particles.blood(zh.part === 'head' ? zh.zombie.headPos : zh.zombie.chestPos, fwd.clone().multiplyScalar(-1), 12);
      g.audio.play('hit', null, 1);
      g.hud.hitMarker(r.killed);
      g.addShake(0.15);
      g.input.rumble(0.5, 0.3, 90);
      return;
    }
    const wh = g.collision.raycast(eye.x, eye.y, eye.z, fwd.x, fwd.y, fwd.z, w.range);
    if (wh && !wh.ground) {
      if (wh.box && wh.box.data) this.damageObject(wh.box.data, w.damage, true);
      g.audio.play('clank');
      g.particles.sparks(eye.clone().addScaledVector(fwd, wh.t), fwd.clone().multiplyScalar(-1));
      g.input.rumble(0.3, 0.6, 60);
    }
  }

  throwItem() {
    const g = this.game;
    const kind = this.inv.throwKind;
    if (!this.inv.useItem(kind)) return;
    this.cooldown = 0.6;
    this.throwAnim = 1;
    const fwd = g.player.forward();
    const origin = g.player.eye.addScaledVector(fwd, 0.6);
    g.explosives.throw(kind, origin, fwd);
    g.audio.play('throw');
    g.hud.toast(`${THROWABLES[kind].name} fırlatıldı!`);
    this.afterUse();
  }

  placeTNT() {
    const g = this.game;
    if (!this.inv.useItem('tnt')) return;
    this.cooldown = 0.6;
    this.throwAnim = 1;
    const p = g.player;
    const f = p.forward();
    const fx = f.x;
    const fz = f.z;
    const l = Math.hypot(fx, fz) || 1;
    const pos = new THREE.Vector3(p.pos.x + (fx / l) * 1.3, 0, p.pos.z + (fz / l) * 1.3);
    pos.y = g.collision.groundHeight(pos.x, pos.z, 0.2, p.pos.y + 0.5, 1);
    g.explosives.placeTNT(pos);
    g.hud.toast('TNT yerleştirildi — KAÇ!');
    this.afterUse();
  }

  placeC4() {
    const g = this.game;
    if (g.explosives.c4Count >= WEAPONS.c4.max) {
      g.hud.toast('En fazla 5 C4 yerleştirebilirsin');
      return;
    }
    if (!this.inv.useItem('c4')) return;
    this.cooldown = 0.5;
    this.throwAnim = 0.6;
    const p = g.player;
    const eye = p.eye;
    const f = p.forward();
    const hit = g.collision.raycast(eye.x, eye.y, eye.z, f.x, f.y, f.z, 3.5);
    let pos;
    let normal = new THREE.Vector3(0, 1, 0);
    if (hit) {
      pos = eye.clone().addScaledVector(f, hit.t);
      if (hit.box) {
        const b = hit.box;
        const e = 0.02;
        if (Math.abs(pos.x - b.minX) < e) normal.set(-1, 0, 0);
        else if (Math.abs(pos.x - b.maxX) < e) normal.set(1, 0, 0);
        else if (Math.abs(pos.z - b.minZ) < e) normal.set(0, 0, -1);
        else if (Math.abs(pos.z - b.maxZ) < e) normal.set(0, 0, 1);
      }
    } else {
      const l = Math.hypot(f.x, f.z) || 1;
      pos = new THREE.Vector3(p.pos.x + (f.x / l) * 1.5, 0, p.pos.z + (f.z / l) * 1.5);
    }
    g.explosives.placeC4(pos, normal);
    const key = g.input.lastDevice === 'pad' ? 'D-pad ▲' : 'G (ya da C4 eldeyken sağ tık)';
    g.hud.toast(`C4 yerleştirildi — patlatmak için ${key}`);
    this.afterUse();
  }

  afterUse() {
    // Son eşya kullanıldıysa slot değişmiş olabilir
    if (this.currentModelId() !== this.shown) this.switchAnim = 0.35;
  }

  animate(dt, s) {
    const g = this.game;
    const player = g.player;
    const modelId = this.currentModelId();
    if (modelId !== this.shown) {
      for (const [k, m] of Object.entries(this.models)) m.visible = k === modelId;
      this.shown = modelId;
    }
    this.switchAnim = Math.max(0, this.switchAnim - dt * 2.2);
    this.kick = damp(this.kick, 0, 18, dt);
    this.swing = Math.max(0, this.swing - dt * 3.2);
    this.throwAnim = Math.max(0, this.throwAnim - dt * 3);
    this.sway.x = damp(this.sway.x, clamp(-s.lookX * 3, -0.08, 0.08), 10, dt);
    this.sway.y = damp(this.sway.y, clamp(s.lookY * 3, -0.08, 0.08), 10, dt);

    const bob = player.bob;
    const bp = player.bobPhase;
    const h = this.holder;
    // Silah sadece ateşli silahlarda göz hizasına gelir
    const gunAim = ['pistol', 'shotgun', 'smg', 'rocket', 'laser'].includes(modelId) ? this.aim : 0;
    const aimX = gunAim * -0.28;
    h.position.set(
      HOLD.x + aimX + Math.cos(bp) * 0.02 * bob + this.sway.x,
      HOLD.y + gunAim * 0.1 + Math.abs(Math.sin(bp)) * 0.025 * bob - this.switchAnim * 0.5 + this.sway.y,
      HOLD.z + this.kick * 0.09,
    );
    let rx = this.kick * 0.12;
    let ry = 0;
    let rz = 0;
    if (this.reloading > 0) {
      const t = Math.sin(Math.PI * Math.min(1, 1 - this.reloading / WEAPONS[this.inv.activeId].reload));
      rx -= t * 0.6;
      rz += t * 0.4;
      h.position.y -= t * 0.12;
    }
    if (modelId === 'crowbar') {
      // Levye savurma: sağ üstten sol alta
      const sw = Math.sin(this.swing * Math.PI);
      rx += 0.85 - sw * 1.9;
      ry += 0.2 + sw * 0.7;
      rz += 0.35 - sw * 0.5;
      h.position.x -= sw * 0.2;
    }
    if (this.throwAnim > 0) {
      const t = Math.sin(this.throwAnim * Math.PI);
      rx -= t * 0.8;
      h.position.z -= t * 0.2;
      h.position.y += t * 0.1;
    }
    h.rotation.set(rx, ry, rz);
    this.gasCan.visible = player.carryingGas;
    this.gasCan.position.y = -0.42 + Math.abs(Math.sin(bp)) * 0.03 * bob;

    // Namlu alevi
    const show = this.flashTime > 0;
    this.flash.visible = show;
    if (show) {
      this.flash.position.set(h.position.x - 0.02, h.position.y + 0.06, h.position.z - (modelId === 'shotgun' ? 0.8 : modelId === 'smg' ? 0.5 : 0.35));
      this.flash.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      this.flash.scale.setScalar(modelId === 'shotgun' ? 2 : 1.2);
    }
    this.vmMuzzle.intensity = show ? 8 : 0;
    this.muzzleLight.intensity = damp(this.muzzleLight.intensity, 0, 30, dt);

    // Silah ışığı dünya aydınlığına uysun; gece fener açıksa biraz aydınlat
    const night = g.dayNight.night;
    this.vmHemi.intensity = 1.5 * (1 - night) + 0.08 + (player.flashOn ? night * 0.9 : 0);
    this.vmDir.intensity = 1 * (1 - night) + (player.flashOn ? night * 0.6 : 0);

    // Nişan: görüş açısı daralır
    g.camera.fov = 75 - this.aim * 17;
    g.camera.updateProjectionMatrix();
  }

  render(renderer) {
    if (!this.game.player.alive || this.game.player.vehicle || this.game.state === 'escaping') return;
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.render(this.vmScene, this.vmCamera);
    renderer.autoClear = true;
  }
}

export { SLOTS };
