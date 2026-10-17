import * as THREE from 'three';
import { Input } from './Input.js';
import { CollisionWorld } from './Collision.js';
import { World, GAS_SPOTS, CAR_POS, GAS_REQUIRED } from '../world/World.js';
import { destroyPylon } from '../world/facility.js';
import { DayNight, NIGHT_START } from '../world/DayNight.js';
import { BOX_GEO } from '../world/materials.js';
import { Particles } from '../fx/Particles.js';
import { Sound } from '../audio/Sound.js';
import { Player } from '../player/Player.js';
import { Inventory } from '../player/Inventory.js';
import { PickupManager, pickupLabel } from '../entities/Pickup.js';
import { ZombieManager } from '../entities/Zombie.js';
import { Spawner } from '../entities/Spawner.js';
import { Explosives } from '../entities/Explosives.js';
import { WeaponSystem } from '../weapons/WeaponSystem.js';
import { VehicleManager } from '../vehicles/VehicleManager.js';
import { WEAPONS, SLOTS, DROP_AMMO, BOX_AMMO, THROWABLES, ITEM_MAX } from '../weapons/weaponData.js';
import { HUD } from '../ui/HUD.js';
import { Menu } from '../ui/Menu.js';
import { Radio } from '../ui/Radio.js';
import { RescueMission } from '../levels/RescueMission.js';
import { ReactorMission } from '../levels/ReactorMission.js';
import { loadProgress, saveProgress, LAST_LEVEL, LEVEL_SELECT_UNLOCKED } from './Progress.js';
import { applyLoadout } from '../levels/loadouts.js';
import { randInt, chance, pickWeighted, rand, formatTime } from './math.js';

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.input = new Input(canvas);
    this.audio = new Sound();
    this.inventory = new Inventory();
    this.hud = new HUD();
    this.menu = new Menu(this);
    this.radio = new Radio(this);
    this.level = 1;
    this.state = 'menu';
    this.menuReturn = 'menu-main';
    this.last = 0;

    this.buildScene();
    this.enterMenuBackground();

    window.addEventListener('resize', () => this.resize());
    this.resize();
    this.input.onLockChange = (locked) => {
      if (!locked && this.state === 'playing') this.pause();
    };
    canvas.addEventListener('click', () => {
      if (this.state === 'playing') this.input.requestLock();
    });
    const wake = () => this.audio.resume();
    window.addEventListener('keydown', wake);
    window.addEventListener('mousedown', wake);
    requestAnimationFrame((t) => this.loop(t));
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.weapons.vmCamera.aspect = w / h;
    this.weapons.vmCamera.updateProjectionMatrix();
  }

  disposeScene() {
    if (!this.scene) return;
    this.scene.traverse((o) => {
      if (o.geometry && o.geometry !== BOX_GEO) o.geometry.dispose();
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) if (m && m.map) m.map.dispose();
    });
    this.renderer.renderLists.dispose();
  }

  buildScene(level = 1) {
    if (this.mission) this.mission.dispose();
    this.mission = null;
    this.children = [];
    this.deadChild = null;
    this.level = level;
    this.radio.clear();
    this.disposeScene();
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.05, 400);
    this.scene.add(this.camera);
    this.collision = new CollisionWorld();
    this.world = new World(this.scene, this.collision, level);
    this.dayNight = new DayNight(this.scene);
    this.particles = new Particles(this.scene);
    this.player = new Player(this.camera, this.collision, this.audio);
    this.pickups = new PickupManager(this.scene);
    this.zombies = new ZombieManager(this.scene, this.collision, this);
    this.spawner = new Spawner(this.zombies, this.collision);
    this.explosives = new Explosives(this.scene, this);
    this.weapons = new WeaponSystem(this);
    // 2. bölümde mavi araba sürülebilir araç olarak gelir
    const extra = {
      2: [['sedan', CAR_POS.x, CAR_POS.z, 0]],
      3: [['sedan', 7, 174, Math.PI / 2], ['jeep', -6, 176, Math.PI / 2]],
    }[level] || [];
    this.vehicles = new VehicleManager(this, extra);
    this.inventory.reset();
    if (level === 1) GAS_SPOTS.forEach((s, i) => this.pickups.spawn('gas', s.x, s.z, { spot: i }));
    this.spawner.populate();
    this.gasDelivered = 0;
    this.pour = 0;
    this.shake = 0;
    this.prompt = null;
    this.wasNight = false;
    this.deathTimer = 0;
    this.escapeTime = 0;
    this.nights = 0;
    this.stats = { kills: 0, headshots: 0, explosionKills: 0, roadkills: 0, explosions: 0, time: 0 };
    if (level === 2) this.mission = new RescueMission(this);
    else if (level === 3) this.mission = new ReactorMission(this);
    if (this.weapons) this.resize();
  }

  enterMenuBackground() {
    // Ana menü arkasında alacakaranlıkta dolaşan zombiler
    this.state = 'menu';
    this.player.alive = false;
    this.dayNight.time = 222;
    this.hud.show(false);
    // Kayıtlı ilerleme varsa "Devam et" görünür
    const prog = loadProgress();
    const cont = document.getElementById('btn-continue');
    cont.style.display = prog ? '' : 'none';
    if (prog) cont.textContent = `DEVAM ET: ${prog.level}. BÖLÜM`;
    document.getElementById('btn-levels').style.display = LEVEL_SELECT_UNLOCKED ? '' : 'none';
    this.menu.open('menu-main');
  }

  // carry: önceki bölümden taşınan eşya/can; yoksa bölümün hazır eşyaları verilir
  newGame(level = 1, carry = null) {
    this.audio.stopEngine();
    this.buildScene(level);
    this.state = 'playing';
    this.menu.close();
    this.hud.show(true);
    document.getElementById('fade').classList.remove('show');
    if (carry) {
      this.inventory.restore(carry.inventory);
      this.player.health = Math.max(60, Math.min(100, carry.health || 100));
      this.player.armor = Math.max(0, Math.min(100, carry.armor || 0));
    } else {
      applyLoadout(level, this.inventory, this.player);
    }
    if (this.mission) {
      this.mission.start();
    } else {
      this.hud.banner('BENZİNİ BUL!', 3);
      this.hud.toast('Elinde sadece levye ve fener var. Silahlı zombilerden silah al!');
    }
    if (this.input.lastDevice !== 'pad') this.input.requestLock();
    this.audio.resume();
  }

  hitChild(amount, fromPos, child) {
    if (child) child.takeDamage(amount, fromPos);
  }

  onChildDied(child) {
    if (this.deadChild) return;
    this.deadChild = child;
    if (this.mission) this.mission.deadChild = child;
    this.hud.banner(`${child.name.toUpperCase()} ÖLDÜ`, 3);
    this.childDeadTimer = 0;
  }

  damagePylon(pylon, dmg) {
    if (!pylon.alive) return;
    pylon.hp -= dmg;
    this.particles.emit({ pos: pylon.pos.clone().setY(3.2), count: 5, colors: ['#ea80fc', '#d500f9'], speed: 3, life: 0.4, size: 0.1, glow: true });
    this.audio.play('shield', pylon.pos, 0.6);
    if (pylon.hp <= 0) {
      destroyPylon(this.world, pylon);
      this.explosives.explode(pylon.pos.clone().setY(2), 3.5, 40);
      this.hud.toast('Kalkan direği yıkıldı!');
    }
  }

  breakBarricade(bar) {
    if (!bar.alive) return;
    this.world.removeBarricade(bar);
    this.audio.play('wood', bar.pos, 1.3);
    this.particles.emit({ pos: bar.pos.clone(), count: 22, colors: ['#8d6e3f', '#5d4325', '#a1887f'], speed: 5, up: 3, life: 1.2, size: 0.16, gravity: 14 });
    this.hud.toast('Kapı açıldı!');
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.audio.stopEngine();
    this.audio.setPouring(false);
    this.input.exitLock();
    this.menuReturn = 'menu-pause';
    this.menu.open('menu-pause');
  }

  resume() {
    this.state = 'playing';
    if (this.player.vehicle) this.audio.startEngine(this.player.vehicle.typeKey);
    this.menu.close();
    if (this.input.lastDevice !== 'pad') this.input.requestLock();
  }

  menuAction(action) {
    switch (action) {
      case 'play':
        this.newGame(1);
        break;
      case 'restart': {
        // Kayıt bu bölüme aitse eşyalarla, değilse hazır eşyalarla baştan
        const prog = loadProgress();
        this.newGame(this.level, prog && prog.level === this.level ? prog : null);
        break;
      }
      case 'next':
      case 'continue': {
        const prog = loadProgress();
        if (prog) this.newGame(prog.level, prog);
        break;
      }
      case 'levels':
        this.menuReturn = 'menu-main';
        this.menu.open('menu-levels', 'back');
        break;
      case 'resume':
        this.resume();
        break;
      case 'settings':
        this.menuReturn = 'menu-main';
        this.menu.open('menu-settings', 'back');
        break;
      case 'controls':
        this.menuReturn = 'menu-main';
        this.menu.open('menu-controls', 'back');
        break;
      case 'settings-pause':
        this.menuReturn = 'menu-pause';
        this.menu.open('menu-settings', 'back');
        break;
      case 'controls-pause':
        this.menuReturn = 'menu-pause';
        this.menu.open('menu-controls', 'back');
        break;
      case 'back':
        this.menu.open(this.menuReturn, this.menuReturn === 'menu-pause' ? 'resume' : null);
        break;
      case 'quit':
        this.input.exitLock();
        this.audio.stopEngine();
        this.audio.setPouring(false);
        this.buildScene();
        this.enterMenuBackground();
        document.getElementById('fade').classList.remove('show');
        break;
      default:
        // Bölüm seçimi: level-1 … level-4
        if (action.startsWith('level-')) this.newGame(parseInt(action.slice(6), 10), null);
        break;
    }
  }

  addShake(v) {
    this.shake = Math.min(1.5, this.shake + v);
  }

  // Zombi saldırısı/mermisi: oyuncu araçtaysa hasar araca gider
  hitPlayer(amount, fromPos) {
    const v = this.player.vehicle;
    if (v) {
      this.vehicles.damage(v, amount * v.spec.armor);
      if (v.spec.exposed) {
        this.player.takeDamage(amount * 0.5, fromPos);
        this.onPlayerHit(amount * 0.5);
      }
      return;
    }
    this.player.takeDamage(amount, fromPos);
    this.onPlayerHit(amount);
  }

  onPlayerHit(dmg) {
    this.input.rumble(Math.min(1, 0.3 + dmg / 40), 0.4, 160);
    this.addShake(Math.min(0.5, dmg / 60));
  }

  onZombieKilled(z, cause, headshot) {
    if (cause !== 'self') {
      this.stats.kills++;
      if (headshot) this.stats.headshots++;
      if (cause === 'explosion') this.stats.explosionKills++;
    }
    const x = z.pos.x;
    const zz = z.pos.z;
    const off = () => rand(-0.6, 0.6);
    if (z.type.human) this.stats.scientists = (this.stats.scientists || 0) + 1;
    if (z.typeKey === 'chemist' && chance(0.5)) this.pickups.spawn(chance(0.5) ? 'medkit' : 'grenade', x + off(), zz + off());
    if (z.weapon && DROP_AMMO[z.weapon]) {
      const [a, b] = DROP_AMMO[z.weapon];
      this.pickups.spawn('weapon', x + off(), zz + off(), { weapon: z.weapon, ammo: randInt(a, b) });
      z.armR.children.forEach((c) => { if (c.type === 'Group') c.visible = false; });
    }
    if (z.type.exploder && !z.removed) {
      // Gövdeden öldürülen patlayan zombinin kafası düşer
      z.head.visible = false;
      z.headless = true;
      this.pickups.spawn('head', x + off(), zz + off());
      this.hud.toast('Patlayan kafa düştü — al ve fırlat!');
    }
    if (z.typeKey === 'armored' && chance(0.45)) this.pickups.spawn('armor', x + off(), zz + off());
    if (z.typeKey === 'soldier' && chance(0.3)) this.pickups.spawn('armor', x + off(), zz + off());
    if (z.typeKey === 'big') {
      this.pickups.spawn('ammo', x + off(), zz + off());
      this.pickups.spawn(pickWeighted([['grenade', 3], ['tnt', 2], ['medkit', 2], ['c4', 1]]), x + off(), zz + off());
    } else if (!z.weapon && !z.type.exploder) {
      const r = Math.random();
      if (r < 0.1) this.pickups.spawn('ammo', x + off(), zz + off());
      else if (r < 0.13) this.pickups.spawn('grenade', x + off(), zz + off());
      else if (r < 0.15) this.pickups.spawn('medkit', x + off(), zz + off());
    }
  }

  breakCrate(c) {
    if (!c.alive) return;
    this.world.removeCrate(c);
    this.audio.play('wood', c.pos);
    this.particles.emit({ pos: c.pos.clone().setY(0.6), count: 18, colors: ['#8d6e3f', '#5d4325', '#a1887f'], speed: 5, up: 3, life: 1.1, size: 0.16, gravity: 14 });
    const table = c.military
      ? [['weapon:rocket', 10], ['weapon:smg', 12], ['weapon:shotgun', 8], ['c4', 18], ['tnt', 14], ['armor', 18], ['ammo', 20], ['grenade', 14]]
      : [['ammo', 30], ['grenade', 20], ['tnt', 12], ['c4', 10], ['armor', 12], ['medkit', 14]];
    const loot = c.loot || pickWeighted(table);
    if (loot.startsWith('weapon:')) {
      const weapon = loot.slice(7);
      const [a, b] = DROP_AMMO[weapon];
      this.pickups.spawn('weapon', c.pos.x, c.pos.z, { weapon, ammo: randInt(a, b) * 2 });
    } else {
      this.pickups.spawn(loot, c.pos.x, c.pos.z);
    }
    if (chance(0.3)) this.pickups.spawn('ammo', c.pos.x + 0.7, c.pos.z + 0.3);
  }

  collect(pk) {
    const p = this.player;
    const inv = this.inventory;
    switch (pk.type) {
      case 'weapon': {
        const isNew = inv.addWeapon(pk.weapon, pk.ammo);
        if (isNew) {
          inv.select(SLOTS.indexOf(pk.weapon));
          this.weapons.onSwitch();
          this.hud.banner(`${WEAPONS[pk.weapon].name.toUpperCase()}!`, 1.5);
        }
        this.hud.toast(`${WEAPONS[pk.weapon].name} alındı (+${pk.ammo} mermi)`);
        break;
      }
      case 'ammo': {
        const target = inv.ammoBoxTarget();
        const n = inv.addAmmo(target, BOX_AMMO[target]);
        if (n <= 0) return this.hud.toast('Mermi dolu');
        this.hud.toast(`+${n} ${WEAPONS[target].name} mermisi`);
        break;
      }
      case 'grenade':
      case 'tnt':
      case 'c4':
      case 'head': {
        const had = inv.hasSlot(inv.active);
        const n = inv.addItem(pk.type, 1);
        if (n <= 0) return this.hud.toast('Daha fazla taşıyamazsın');
        const name = pk.type === 'grenade' || pk.type === 'head' ? THROWABLES[pk.type].name : WEAPONS[pk.type].name;
        this.hud.toast(`${name} alındı`);
        if (!had) inv.ensureValid();
        break;
      }
      case 'armor':
        if (p.armor >= 100) return this.hud.toast('Zırhın zaten dolu');
        p.armor = Math.min(100, p.armor + 50);
        this.hud.toast('+50 zırh');
        break;
      case 'medkit':
        if (p.health >= 100) return this.hud.toast('Canın zaten dolu');
        p.health = Math.min(100, p.health + 45);
        this.hud.toast('+45 can');
        break;
      case 'gas':
        p.carryingGas = true;
        this.hud.toast('Benzin bidonu alındı! Arabaya götür (yavaşlarsın).');
        break;
      default:
        break;
    }
    this.pickups.remove(pk);
    this.audio.play('pickup');
    this.input.rumble(0.1, 0.3, 60);
  }

  updateInteraction(dt, s) {
    const p = this.player;
    this.prompt = null;
    if (this.mission && this.mission.interaction(s)) return;
    const car = this.world.car ? this.world.car.pos : null;
    const nearCar = !!car && Math.hypot(p.pos.x - car.x, p.pos.z - car.z) < 3.9;
    if (nearCar && p.carryingGas) {
      if (s.interact) {
        this.pour += dt / 2;
        this.audio.setPouring(true);
        if (this.pour >= 1) {
          this.pour = 0;
          p.carryingGas = false;
          this.gasDelivered++;
          this.audio.setPouring(false);
          this.audio.play('gas');
          this.input.rumble(0.4, 0.6, 200);
          if (this.gasDelivered >= GAS_REQUIRED) {
            this.hud.banner('DEPO DOLU! ARABAYA BİN!', 4);
            this.zombies.alert(car, 70);
          } else {
            this.hud.toast(`Benzin döküldü: ${this.gasDelivered} / ${GAS_REQUIRED}`);
          }
        }
      } else {
        this.pour = Math.max(0, this.pour - dt);
        this.audio.setPouring(false);
      }
      this.prompt = { text: 'Benzini depoya dök', hold: true, progress: this.pour };
      return;
    }
    this.audio.setPouring(false);
    this.pour = 0;
    if (nearCar && this.gasDelivered >= GAS_REQUIRED) {
      this.prompt = { text: 'Arabaya bin ve KAÇ!' };
      if (s.interactPressed) this.startEscape();
      return;
    }
    // Üst üste düşen eşyalarda önce alınabilir olanı seç
    const pk = this.pickups.nearest(p.pos, 2.2, (x) => !this.blockReason(x));
    if (pk) {
      this.prompt = { text: pickupLabel(pk) };
      if (s.interactPressed) this.collect(pk);
      return;
    }
    const veh = this.vehicles.nearest(p.pos);
    if (veh) {
      this.prompt = { text: this.vehicles.enterLabel(veh) };
      if (s.interactPressed) this.vehicles.enter(veh);
      return;
    }
    const blocked = this.pickups.nearest(p.pos, 2.2);
    if (blocked) this.prompt = { text: this.blockReason(blocked) };
  }

  // Eşya alınamıyorsa nedeni, alınabiliyorsa null
  blockReason(pk) {
    const p = this.player;
    const inv = this.inventory;
    switch (pk.type) {
      case 'gas': return p.carryingGas ? 'Önce elindeki bidonu arabaya götür' : null;
      case 'armor': return p.armor >= 100 ? 'Zırhın zaten dolu' : null;
      case 'medkit': return p.health >= 100 ? 'Canın zaten dolu' : null;
      case 'grenade':
      case 'tnt':
      case 'c4':
      case 'head': return inv.counts[pk.type] >= ITEM_MAX[pk.type] ? 'Daha fazla taşıyamazsın' : null;
      default: return null;
    }
  }

  startEscape() {
    this.audio.stopEngine();
    this.state = 'escaping';
    this.escapeTime = 0;
    this.prompt = null;
    this.audio.play('engine');
    this.hud.banner('KAÇIYORSUN!', 3);
    this.input.rumble(0.6, 0.6, 1200);
  }

  showEnd(win, reason = null) {
    this.state = 'end';
    this.audio.stopEngine();
    this.input.exitLock();
    this.audio.setPouring(false);
    this.radio.clear();
    this.hud.show(false);
    let title;
    let sub;
    if (this.mission) {
      ({ title, sub } = this.mission.endText(win, reason));
    } else {
      title = win ? 'KAÇTIN!' : 'ÖLDÜN';
      sub = win ? 'Depo doldu, motor çalıştı, zombiler arkada kaldı.' : `Benzin: ${this.gasDelivered} / ${GAS_REQUIRED} — zombiler seni yakaladı.`;
    }
    const hasNext = win && this.level < LAST_LEVEL;
    // Sonraki bölüme eşyalarla devam
    if (hasNext) saveProgress({ level: this.level + 1, inventory: this.inventory.serialize(), health: this.player.health, armor: this.player.armor });
    document.getElementById('end-title').textContent = title;
    document.getElementById('end-sub').textContent = sub;
    const next = document.getElementById('btn-next');
    next.style.display = hasNext ? '' : 'none';
    next.textContent = `${this.level + 1}. BÖLÜME DEVAM`;
    const rows = [
      ['Süre', formatTime(this.stats.time)],
      ['Öldürülen zombi', this.stats.kills],
      ['Kafadan vuruş', this.stats.headshots],
      ['Patlamayla öldürülen', this.stats.explosionKills],
      ['Araçla ezilen', this.stats.roadkills],
      ['Patlama sayısı', this.stats.explosions],
      ['Atlatılan gece', this.nights],
    ];
    document.getElementById('end-stats').innerHTML = rows.map(([k, v]) => `<span>${k}</span><b>${v}</b>`).join('');
    this.menuReturn = 'menu-end';
    this.menu.open('menu-end');
  }

  tick(dt, s) {
    this.stats.time += dt;
    const dn = this.dayNight;
    dn.update(dt, this.player.pos);
    const night = dn.night;
    if (night > 0.5 && !this.wasNight) {
      this.wasNight = true;
      this.hud.banner('GECE ÇÖKÜYOR...', 3.5);
      if (!this.player.flashOn) this.hud.toast('Feneri aç!');
    } else if (night < 0.5 && this.wasNight) {
      this.wasNight = false;
      this.nights++;
      this.hud.banner('ŞAFAK SÖKTÜ', 3);
    }
    if (s.flashlight && this.player.alive) {
      this.player.flashOn = !this.player.flashOn;
      this.audio.play('empty');
    }
    const wasDriving = !!this.player.vehicle;
    if (!wasDriving) this.player.update(dt, s, night, this.shake);
    this.prompt = null;
    this.vehicles.update(dt, s);
    const driving = !!this.player.vehicle;
    if (driving) this.vehicles.updateCamera(dt, s);
    else if (wasDriving) this.player.update(0, this.input.emptyState(), night, 0);
    this.audio.setListener(this.player.pos.x, this.player.pos.z, this.player.yaw);
    if (this.player.alive && !driving && !wasDriving) this.weapons.update(dt, s);
    this.zombies.update(dt, this.player, night);
    this.spawner.update(dt, this.player, night);
    this.explosives.update(dt);
    this.pickups.update(dt);
    this.particles.update(dt);
    // Araçtan inildiği karede aynı tuş tekrar binmesin
    if (this.player.alive && !driving && !wasDriving) this.updateInteraction(dt, s);
    else if (!driving) this.prompt = null;
    if (this.mission) {
      const r = this.mission.update(dt);
      if (r === 'win') this.showEnd(true);
      else if (r === 'lose') this.showEnd(false, 'mission');
    }
    this.radio.update(dt);
    this.shake = Math.max(0, this.shake - dt * 2.5);
    this.audio.updateMusic(night, true);
    this.hud.update(dt, this);
  }

  tickEscape(dt) {
    this.escapeTime += dt;
    const car = this.world.car;
    const speed = Math.min(30, this.escapeTime * 9);
    car.mesh.position.z -= speed * dt;
    car.pos.z = car.mesh.position.z;
    // Kamera: arkadan takip
    this.camera.position.set(car.mesh.position.x + 1.5, 3.2, car.mesh.position.z + 9);
    this.camera.lookAt(car.mesh.position.x, 1, car.mesh.position.z - 4);
    if (Math.random() < 0.6) this.particles.emit({ pos: car.mesh.position.clone().setY(0.5).add(new THREE.Vector3(0.6, 0, 2.3)), count: 1, colors: ['#9e9e9e'], speed: 0.5, life: 1, size: 0.25, gravity: -1, grow: 2 });
    this.dayNight.update(dt, car.mesh.position);
    this.zombies.update(dt, this.player, this.dayNight.night);
    this.explosives.update(dt);
    this.particles.update(dt);
    if (this.escapeTime > 2.6) document.getElementById('fade').classList.add('show');
    if (this.escapeTime > 4) {
      this.showEnd(true);
      document.getElementById('fade').classList.remove('show');
    }
  }

  loop(now) {
    requestAnimationFrame((t) => this.loop(t));
    const dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    const s = this.input.update(dt);
    // Menüdeki onay tuşu (ör. A) aynı karede oyunda zıplama sayılmasın
    const menuOpen = !!this.menu.current;
    if (menuOpen) this.menu.update(s);

    switch (this.state) {
      case 'menu': {
        const t = now / 1000;
        this.camera.position.set(Math.sin(t * 0.08) * 14, 4.5, Math.cos(t * 0.08) * 14);
        this.camera.lookAt(0, 1, 0);
        this.dayNight.update(0, { x: 0, z: 0 });
        this.zombies.update(dt, this.player, this.dayNight.night);
        this.particles.update(dt);
        const ps = document.getElementById('pad-status');
        const has = !!this.input.pad;
        if (ps.classList.contains('on') !== has) {
          ps.classList.toggle('on', has);
          ps.textContent = has ? `Oyun kolu bağlı ✓ (${this.input.ps ? 'PlayStation' : 'Xbox / genel'})` : 'Oyun kolu: bağlı değil (bağlamak için koldaki bir tuşa bas)';
        }
        this.audio.updateMusic(0, false);
        break;
      }
      case 'playing':
        if (menuOpen) break;
        if (s.pause) this.pause();
        else this.tick(dt, s);
        if (this.state === 'playing' && !this.player.alive) {
          this.deathTimer += dt;
          if (this.deathTimer > 2.2) this.showEnd(false);
        }
        if (this.state === 'playing' && this.deadChild) {
          this.childDeadTimer += dt;
          if (this.childDeadTimer > 2.5) this.showEnd(false, 'child');
        }
        break;
      case 'escaping':
        this.tickEscape(dt);
        break;
      case 'paused':
        // Kolda Start ile devam (klavyede fare kilidi için tıklama gerekir)
        if (s.pause && this.input.lastDevice === 'pad') this.resume();
        break;
      default:
        break;
    }

    this.renderer.render(this.scene, this.camera);
    if (this.state === 'playing' || this.state === 'paused') this.weapons.render(this.renderer);
    this.input.endFrame();
  }
}

export { NIGHT_START };
