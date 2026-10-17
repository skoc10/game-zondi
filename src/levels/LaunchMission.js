import * as THREE from 'three';
import { LAUNCH } from '../world/launchSite.js';
import { DEFEND_TIME, CONSOLE_HP, LAUNCH_TIME, launchStage, defenseWave } from './spaceLogic.js';
import { updateTurrets } from './RescueMission.js';
import { rand, pickWeighted, smoothstep } from '../core/math.js';

const BLACK = new THREE.Color('#000005');

// 4. bölüm (a): roket üssü. Konsolda sayımı başlat, 60 sn konsolu savun, rokete bin.
export class LaunchMission {
  constructor(game) {
    this.game = game;
    this.level = 4;
    this.started = false;
    this.boarded = false;
    this.defendLeft = DEFEND_TIME;
    this.waveTimer = 2;
    this.cine = 0;
    this.said = new Set();
    this.hitToast = 0;
    const C = LAUNCH.console;
    // Zombilerin saldırabildiği konsol (çocuklar gibi hedef listesine girer)
    this.console = {
      name: 'Konsol',
      pos: new THREE.Vector3(C.x, 0, C.z),
      center: new THREE.Vector3(C.x, 0.8, C.z),
      hp: CONSOLE_HP,
      maxHp: CONSOLE_HP,
      alive: true,
      targetable: false,
      solid: true,
      vehicle: null,
      takeDamage: (amount) => this.damageConsole(amount),
    };
    game.children = [this.console];
  }

  get stage() {
    return launchStage({ started: this.started, defendLeft: this.defendLeft, boarded: this.boarded });
  }

  start() {
    const g = this.game;
    const L = LAUNCH;
    g.dayNight.time = 150;
    g.wasNight = false;
    g.player.pos.set(L.start.x, 0, L.start.z);
    g.player.yaw = Math.atan2(-(L.console.x - L.start.x), -(L.console.z - L.start.z));
    // Patlamadan sonra zombiler hızla çoğalıyor
    g.spawner.boost = 2;
    g.spawner.elapsed = 300;
    let n = 0;
    for (let k = 0; k < 120 && n < 18; k++) {
      const x = rand(L.minX + 4, L.maxX - 2);
      const z = rand(L.minZ + 4, L.maxZ - 2);
      if (g.collision.blockedAt(x, z, 0.7, 2)) continue;
      g.zombies.spawn(n % 6 === 0 ? 'big' : n % 4 === 0 ? 'exploder' : n % 5 === 0 ? 'soldier' : 'normal', x, z, {});
      n++;
    }
    g.hud.banner('4. BÖLÜM: ROKET ÜSSÜ', 4);
    g.radio.say('Komutan', 'Radar sinyalinin kaynağı bulundu: yörüngedeki uzay istasyonu. Uzaylılar ele geçirmiş!', 6);
    g.radio.say('Komutan', 'Salgını onlar başlatmış. Güneybatıdaki roket üssüne git, konsoldan fırlatma sayımını başlat.', 6);
    g.radio.say('Komutan', 'Zombiler hızla çoğalıyor. Acele et!', 4);
  }

  objective() {
    switch (this.stage) {
      case 'reach': return 'Roket üssüne git ve konsoldan fırlatma sayımını başlat';
      case 'defend': return `Konsolu savun! Fırlatmaya ${Math.ceil(this.defendLeft)} sn`;
      case 'board': return 'Sayım tamam! Kuledeki asansörle rokete bin';
      default: return 'Fırlatma!';
    }
  }

  counters() {
    const list = [];
    if (this.started && !this.boarded) {
      const c = this.console;
      list.push({ label: 'KONSOL', value: `${Math.ceil(c.hp)}`, frac: c.hp / c.maxHp, color: '#00e5ff' });
    }
    if (this.stage === 'defend') list.push({ label: 'SAYIM', value: `${Math.ceil(this.defendLeft)} sn`, frac: this.defendLeft / DEFEND_TIME, color: '#ffb300' });
    return list;
  }

  compassTargets() {
    const L = LAUNCH;
    switch (this.stage) {
      case 'reach':
      case 'defend': return [{ key: 'console', x: L.console.x, z: L.console.z, label: 'KONSOL', cls: 'gas' }];
      case 'board': return [{ key: 'rocket', x: L.elevator.x, z: L.elevator.z, label: 'ROKET', cls: 'safe' }];
      default: return [];
    }
  }

  dist(p) {
    const q = this.game.player.pos;
    return Math.hypot(q.x - p.x, q.z - p.z);
  }

  interaction(s) {
    const g = this.game;
    const L = LAUNCH;
    if (this.stage === 'reach' && this.dist(L.console) < 3) {
      g.prompt = { text: 'Fırlatma sayımını başlat' };
      if (s.interactPressed) this.startDefense();
      return true;
    }
    if (this.stage === 'defend' && this.dist(L.console) < 3) {
      g.prompt = { text: `Sayım sürüyor — konsolu koru (${Math.ceil(this.defendLeft)} sn)`, noKey: true };
      return true;
    }
    if (this.stage === 'board' && this.dist(L.elevator) < 3.2) {
      g.prompt = { text: 'Asansöre bin ve FIRLAT!' };
      if (s.interactPressed) this.startLaunch();
      return true;
    }
    return false;
  }

  saveBlock() {
    if (this.stage === 'defend') return 'Sayım sırasında kaydedilemez — konsolu koru!';
    if (this.boarded) return 'Şu an kaydedilemez';
    return null;
  }

  saveState() {
    return { started: this.started, defendLeft: this.defendLeft, consoleHp: this.console.hp, said: [...this.said] };
  }

  restoreState(d) {
    const g = this.game;
    g.spawner.boost = 2;
    this.started = !!d.started;
    this.defendLeft = Number.isFinite(d.defendLeft) ? d.defendLeft : DEFEND_TIME;
    this.console.hp = Number.isFinite(d.consoleHp) ? d.consoleHp : CONSOLE_HP;
    this.console.targetable = this.stage === 'defend';
    this.said = new Set(d.said || []);
  }

  startDefense() {
    const g = this.game;
    this.started = true;
    this.console.targetable = true;
    g.hud.banner(`FIRLATMA SAYIMI: ${DEFEND_TIME} SN`, 3.5);
    g.radio.say('Komutan', 'Sayım başladı! Zombiler sesi duydu, konsola saldıracaklar. Ne pahasına olursa olsun koru!', 6);
    g.audio.play('siren', null, 0.7);
    g.zombies.chaseCap = 24;
    g.zombies.alert(this.console.pos, 90);
    g.input.rumble(0.4, 0.4, 300);
  }

  damageConsole(amount) {
    const g = this.game;
    const c = this.console;
    if (!c.alive || !this.started || this.boarded) return;
    c.hp -= amount;
    g.particles.emit({ pos: c.center.clone().setY(1.3), count: 4, colors: ['#00e5ff', '#ffeb3b', '#fff'], speed: 3, up: 2, life: 0.4, size: 0.08, glow: true, gravity: 10 });
    const now = performance.now();
    if (now - this.hitToast > 3000) {
      this.hitToast = now;
      g.hud.toast('Konsol saldırı altında!');
    }
    if (c.hp <= 0) {
      c.hp = 0;
      c.alive = false;
      c.targetable = false;
      g.explosives.explode(c.center.clone(), 4, 30);
      g.hud.banner('KONSOL YOK OLDU', 3);
    }
  }

  sayOnce(key, from, text, sec) {
    if (this.said.has(key)) return;
    this.said.add(key);
    this.game.radio.say(from, text, sec);
  }

  update(dt) {
    const g = this.game;
    updateTurrets(g, dt);
    if (this.dist(LAUNCH.console) < 70) this.sayOnce('arrive', 'Komutan', 'Roket üssündesin. Konsol rampanın doğusunda, kum torbalarının yanında.', 5);
    if (!this.console.alive) {
      this.loseTimer = (this.loseTimer || 0) + dt;
      return this.loseTimer > 2.5 ? 'lose' : null;
    }
    if (this.stage === 'defend') {
      this.defendLeft -= dt;
      this.waveTimer -= dt;
      if (this.waveTimer <= 0) {
        const w = defenseWave(this.defendLeft);
        this.waveTimer = w.interval;
        this.wave(w.count);
      }
      if (this.defendLeft <= 30) this.sayOnce('30', 'Kontrol', 'Otuz saniye! Yakıt basıncı normal.', 3);
      if (this.defendLeft <= 10) this.sayOnce('10', 'Kontrol', 'On saniye! Kule kolları açılıyor.', 3);
      if (this.defendLeft <= 0) {
        this.console.targetable = false;
        g.hud.banner('SAYIM TAMAM! ROKETE BİN!', 3.5);
        g.radio.say('Komutan', 'Roket hazır! Kuledeki sarı asansöre koş!', 4.5);
        g.audio.play('door', null, 1);
      }
    }
    return null;
  }

  // Konsolun çevresindeki halkada zombi dalgası
  wave(count) {
    const g = this.game;
    const C = this.console.pos;
    if (g.zombies.countNear(C.x, C.z, 60) > 30) return;
    for (let i = 0; i < count; i++) {
      for (let k = 0; k < 10; k++) {
        const a = rand(0, Math.PI * 2);
        const r = rand(38, 55);
        const x = C.x + Math.sin(a) * r;
        const z = C.z + Math.cos(a) * r;
        if (Math.abs(x) > 220 || Math.abs(z) > 220 || g.collision.blockedAt(x, z, 0.7, 2)) continue;
        const type = pickWeighted([['normal', 6], ['small', 2], ['big', 2], ['exploder', 2]]);
        const zb = g.zombies.spawn(type, x, z, { alerted: true, spawned: true });
        zb.roared = true;
        break;
      }
    }
  }

  startLaunch() {
    const g = this.game;
    this.boarded = true;
    this.cine = 0;
    g.state = 'cinematic';
    g.prompt = null;
    g.hud.show(false);
    g.input.exitLock();
    g.audio.stopEngine();
    g.audio.play('launch', null, 1);
    g.radio.clear();
    g.input.rumble(0.8, 0.8, 3000);
    this.camFrom = new THREE.Vector3(LAUNCH.rocket.x + 42, 5, LAUNCH.rocket.z + 38);
  }

  // Fırlatma sahnesi; bitince true
  cinematic(dt) {
    const g = this.game;
    this.cine += dt;
    const t = this.cine;
    const R = LAUNCH.rocket;
    const rocket = g.world.rocket;
    const lift = t < 1.4 ? 0 : 0.5 * 10 * (t - 1.4) ** 2;
    rocket.position.y = 1.2 + lift;
    rocket.position.x = R.x + (t < 1.4 ? (Math.random() - 0.5) * 0.08 : 0);
    const base = new THREE.Vector3(R.x, rocket.position.y + 0.5, R.z);
    g.particles.emit({ pos: base, count: 4, colors: ['#ffeb3b', '#ff9800', '#ff5722', '#fff'], speed: 4, up: -8, spread: 1, life: 0.6, size: 0.6, gravity: 0, drag: 0.5, grow: 1.5, glow: true });
    if (t < 3.5) g.particles.emit({ pos: new THREE.Vector3(R.x, 1.5, R.z), count: 5, colors: ['#eeeeee', '#bdbdbd', '#9e9e9e'], speed: 9, up: 1, spread: 3, life: 3, size: 2.5, gravity: -0.4, drag: 1.2, grow: 2.5 });
    else g.particles.emit({ pos: base, count: 2, colors: ['#e0e0e0', '#bdbdbd'], speed: 2, spread: 1, life: 2.5, size: 2, gravity: 0, drag: 1, grow: 2 });
    g.shake = t < 3 ? 0.5 : 0.2;
    // Kamera: yerden roketi izler
    const cam = g.camera;
    cam.position.copy(this.camFrom).setY(5 + lift * 0.25);
    cam.position.x += (Math.random() - 0.5) * g.shake * 0.4;
    cam.lookAt(R.x, rocket.position.y + 14, R.z);
    // Gökyüzü kararır
    const k = smoothstep(2.5, 6, t);
    const sc = g.scene;
    if (sc.background && sc.background.isColor) sc.background.lerp(BLACK, k * 0.2);
    if (sc.fog) sc.fog.color.lerp(BLACK, k * 0.2);
    g.particles.update(dt);
    const fade = document.getElementById('fade');
    if (t > LAUNCH_TIME - 1.5) fade.classList.add('show');
    return t >= LAUNCH_TIME;
  }

  endText(win) {
    if (win) return { title: 'FIRLATMA!', sub: 'Roket yörüngeye çıktı.' };
    if (!this.console.alive) return { title: 'KONSOL YOK OLDU', sub: 'Zombiler fırlatma konsolunu parçaladı. Roket yerde kaldı.' };
    return { title: 'ÖLDÜN', sub: 'Zombiler roket üssünü ele geçirdi...' };
  }

  dispose() {
    document.getElementById('fade').classList.remove('show');
  }
}
