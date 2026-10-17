import * as THREE from 'three';
import { FACILITY, openReactorDoor } from '../world/facility.js';
import { BOMB_TIME, SAFE_DIST, PLANT_TIME, survivesNuke, summonWaves, reactorStage } from './reactorLogic.js';
import { updateTurrets } from './RescueMission.js';
import { rand } from '../core/math.js';

const CAMP = { x: 2, z: 174 };

// 3. bölüm: salgının başladığı nükleer tesis. Dr. Kaos'u durdur, reaktöre bombayı kur, kaç.
export class ReactorMission {
  constructor(game) {
    this.game = game;
    this.level = 3;
    game.children = [];
    this.boss = null;
    this.planted = false;
    this.countdown = BOMB_TIME;
    this.plantProgress = 0;
    this.nuked = false;
    this.nukeTime = 0;
    this.survived = false;
    this.bossDeadHandled = false;
    this.bossFrac = 1;
    this.said = new Set();
    this.steamTimer = 0;
    this.sirenTimer = 0;
    this.extraSpawn = 0;
    this.blink = 0;
  }

  start() {
    const g = this.game;
    g.dayNight.time = 35;
    g.wasNight = false;
    const F = FACILITY;
    g.player.pos.set(CAMP.x, 0, CAMP.z);
    g.player.yaw = Math.atan2(-(F.reactor.x - CAMP.x), -(F.reactor.z - CAMP.z));
    this.spawnEnemies();
    g.hud.banner('3. BÖLÜM: NÜKLEER TESİS', 4);
    g.radio.say('Komutan', 'Salgın doğudaki nükleer tesiste başladı. Orada çılgın bilim insanları deney yapıyor.', 6);
    g.radio.say('Komutan', 'Reaktör kapısı kontrol odasından kilitli. Başlarındaki Dr. Kaos\'u durdur.', 5.5);
    g.radio.say('Komutan', 'Sonra bombayı reaktör çekirdeğine kur ve 140 metreden uzağa kaç. Araçlar kampta.', 6);
  }

  spawnEnemies() {
    const g = this.game;
    const z = g.zombies;
    const K = FACILITY.control;
    this.boss = z.spawn('drKaos', K.x, K.z + 1.5, {});
    this.boss.shielded = true;
    for (const [x, zz] of [[120, 160], [131, 163], [154, 120], [166, 106], [140, 136], [170, 150], [114, 128], [186, 142], [148, 172], [118, 112]]) z.spawn('scientist', x, zz, {});
    for (const [x, zz] of [[128, 176], [160, 116], [146, 160], [176, 128], [117, 140], [135, 110]]) z.spawn('chemist', x, zz, {});
    // Tesis içinde dolaşan zombiler
    const F = FACILITY;
    let n = 0;
    for (let k = 0; k < 80 && n < 16; k++) {
      const x = rand(F.minX + 4, F.maxX - 4);
      const zz = rand(F.minZ + 4, F.maxZ - 4);
      if (g.collision.blockedAt(x, zz, 0.7, 2)) continue;
      z.spawn(n % 7 === 0 ? 'big' : n % 5 === 0 ? 'exploder' : 'normal', x, zz, {});
      n++;
    }
  }

  get pylonsUp() {
    return (this.game.world.pylons || []).filter((p) => p.alive).length;
  }

  get stage() {
    return reactorStage({ bossAlive: this.boss && this.boss.alive, planted: this.planted, nuked: this.nuked });
  }

  distToCore() {
    const p = this.game.player.pos;
    return Math.hypot(p.x - FACILITY.core.x, p.z - FACILITY.core.z);
  }

  objective() {
    switch (this.stage) {
      case 'boss': return this.pylonsUp > 0
        ? `Kontrol odasındaki Dr. Kaos'u durdur — önce mor kalkan direklerini yık (${this.pylonsUp})`
        : "Dr. Kaos'u durdur — kalkanı düştü!";
      case 'plant': return 'Reaktöre gir ve bombayı çekirdeğe kur (E basılı tut)';
      case 'escape': return `KAÇ! Reaktörden ${SAFE_DIST} m uzaklaş — ${Math.ceil(this.countdown)} sn`;
      default: return 'Salgın durduruldu';
    }
  }

  counters() {
    const list = [];
    const b = this.boss;
    if (b && b.alive && b.pos.distanceTo(this.game.player.pos) < 70) {
      list.push({ label: 'DR. KAOS', value: b.shielded ? 'KALKANLI' : `%${Math.ceil((b.health / b.maxHealth) * 100)}`, frac: b.health / b.maxHealth, color: '#d500f9' });
    }
    if (this.planted && !this.nuked) {
      const d = Math.round(this.distToCore());
      list.push({ label: 'SÜRE', value: `${Math.ceil(this.countdown)} sn`, frac: this.countdown / BOMB_TIME, color: '#ff1744' });
      list.push({ label: 'MESAFE', value: `${d}/${SAFE_DIST} m`, frac: d / SAFE_DIST, color: d >= SAFE_DIST ? '#00e676' : '#ffb300' });
    }
    return list;
  }

  compassTargets() {
    const F = FACILITY;
    const p = this.game.player.pos;
    switch (this.stage) {
      case 'boss': {
        const near = Math.hypot(p.x - F.control.x, p.z - F.control.z) < 70;
        return near
          ? [{ key: 'boss', x: F.control.x, z: F.control.z, label: 'DR. KAOS', cls: 'gas' }]
          : [{ key: 'facility', x: F.minX, z: F.gateZ, label: 'TESİS', cls: 'gas' }];
      }
      case 'plant': return [{ key: 'reactor', x: F.reactor.x - F.reactor.w / 2, z: F.reactor.z, label: 'REAKTÖR', cls: 'gas' }];
      case 'escape': return [{ key: 'camp', x: CAMP.x, z: CAMP.z, label: 'KAMP', cls: 'safe' }];
      default: return [];
    }
  }

  interaction(s) {
    const g = this.game;
    const p = g.player.pos;
    const door = g.world.reactorDoor;
    if (door && door.locked && door.pos.distanceTo(p) < 3.2) {
      g.prompt = { text: "Kapı kilitli — kontrol odasındaki Dr. Kaos'u durdur", noKey: true };
      return true;
    }
    if (!this.planted && this.stage === 'plant' && this.distToCore() < 4.6) {
      if (s.interact) {
        this.plantProgress += (g.lastDt || 1 / 30) / PLANT_TIME;
        if (this.plantProgress >= 1) this.plant();
      } else {
        this.plantProgress = Math.max(0, this.plantProgress - 0.02);
      }
      g.prompt = { text: 'Bombayı çekirdeğe kur', hold: true, progress: this.plantProgress };
      return true;
    }
    return false;
  }

  saveBlock() {
    if (this.planted) return 'Bomba kurulduktan sonra kaydedilemez — KAÇ!';
    return null;
  }

  saveState() {
    return { said: [...this.said] };
  }

  restoreState(d) {
    const g = this.game;
    this.said = new Set(d.said || []);
    this.boss = g.zombies.list.find((z) => z.typeKey === 'drKaos') || null;
    if (this.boss) {
      this.bossFrac = this.boss.health / this.boss.maxHealth;
    } else {
      // Dr. Kaos ölmüştü: reaktör kapısı açık
      this.bossDeadHandled = true;
      openReactorDoor(g.world);
    }
  }

  plant() {
    const g = this.game;
    this.planted = true;
    this.countdown = BOMB_TIME;
    g.hud.banner(`BOMBA KURULDU! ${BOMB_TIME} SN — KAÇ!`, 4);
    g.radio.say('Komutan', `Bomba kuruldu! ${SAFE_DIST} metreden uzağa kaç, hemen! Araca bin!`, 5);
    g.zombies.chaseCap = 24;
    g.zombies.alert(g.player.pos, 120);
    g.input.rumble(0.6, 0.6, 400);
  }

  sayOnce(key, from, text, sec) {
    if (this.said.has(key)) return;
    this.said.add(key);
    this.game.radio.say(from, text, sec);
  }

  update(dt) {
    const g = this.game;
    const F = FACILITY;
    g.lastDt = dt;
    const b = this.boss;

    // Boss kalkanı ve çağırma
    if (b) {
      b.shielded = b.alive && this.pylonsUp > 0;
      if (b.shieldMesh) b.shieldMesh.visible = b.shielded;
      if (b.alive) {
        const frac = b.health / b.maxHealth;
        const waves = summonWaves(this.bossFrac, frac);
        this.bossFrac = frac;
        for (let w = 0; w < waves; w++) this.summon();
        if (b.pos.distanceTo(g.player.pos) < 40) this.sayOnce('kaos', 'Dr. Kaos', 'Deneyimi mahvedemezsin! Zombiler benim eserim!', 4.5);
      } else if (!this.bossDeadHandled) {
        this.bossDeadHandled = true;
        openReactorDoor(g.world);
        g.hud.banner("DR. KAOS ÖLDÜ — REAKTÖR AÇIK!", 3.5);
        g.radio.say('Komutan', 'Kontrol odası düştü, reaktör kapısı açıldı! Bombayı çekirdeğe kur.', 5);
      }
    }
    if (g.player.pos.x > F.minX - 30 && g.player.pos.z > F.minZ - 30) this.sayOnce('arrive', 'Komutan', 'Tesise yaklaşıyorsun. Bilim insanları lazer kullanıyor, kimyagerler zehir şişesi atıyor!', 5);

    // Zehirli göletler
    if (g.player.alive && !g.player.vehicle) {
      for (const p of F.ponds) {
        if (Math.hypot(g.player.pos.x - p.x, g.player.pos.z - p.z) < p.r) {
          g.player.takeDamage(10 * dt, null);
          g.player.hurt = Math.min(1, g.player.hurt + dt);
        }
      }
    }
    // Soğutma kulesi buharı
    this.steamTimer -= dt;
    if (this.steamTimer <= 0 && g.world.steamVents) {
      this.steamTimer = 0.15;
      for (const v of g.world.steamVents) g.particles.emit({ pos: v, count: 1, colors: ['#eceff1', '#cfd8dc'], speed: 0.8, up: 2, spread: 8, life: 4, size: 2, gravity: -0.5, drag: 0.3, grow: 2 });
    }
    updateTurrets(g, dt);

    if (this.planted && !this.nuked) {
      this.countdown -= dt;
      this.sirenTimer -= dt;
      if (this.sirenTimer <= 0) {
        this.sirenTimer = 1.3;
        g.audio.play('siren', null, 0.6);
      }
      this.blink += dt;
      const on = Math.sin(this.blink * 8) > 0;
      for (const l of g.world.alarmLamps || []) l.material.emissiveIntensity = on ? 3 : 0.2;
      // Tesisten zombi akını
      this.extraSpawn -= dt;
      if (this.extraSpawn <= 0) {
        this.extraSpawn = 2.2;
        const z = g.spawner.spawnOne(g.player, 0.5);
        if (z) z.alerted = true;
      }
      if (this.countdown <= 10) this.sayOnce('ten', 'Komutan', 'On saniye!', 2);
      if (this.countdown <= 0) this.nuke();
    }
    if (this.nuked) {
      this.nukeTime += dt;
      this.updateNuke(dt);
      if (this.nukeTime > 4.5 && this.survived) return 'win';
    }
    return null;
  }

  summon() {
    const g = this.game;
    const b = this.boss;
    g.hud.toast('Dr. Kaos zombi çağırıyor!');
    g.radio.say('Dr. Kaos', 'Gelin çocuklarım!', 2.5);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const x = b.pos.x + Math.sin(a) * 10;
      const z = b.pos.z + Math.cos(a) * 10;
      if (!g.collision.blockedAt(x, z, 0.6, 2)) g.zombies.spawn(i === 0 ? 'big' : 'normal', x, z, { alerted: true });
    }
  }

  nuke() {
    const g = this.game;
    const C = FACILITY.core;
    this.nuked = true;
    this.nukeTime = 0;
    this.survived = survivesNuke(this.distToCore());
    // Beyaz flaş
    const fade = document.getElementById('fade');
    fade.classList.add('white', 'show');
    this.flashOff = false;
    g.audio.play('nuke');
    g.addShake(1.5);
    g.input.rumble(1, 1, 1500);
    // Tüm zombiler ve bilim insanları yok olur
    for (const z of g.zombies.list) {
      if (!z.alive) continue;
      z.alive = false;
      z.removed = true;
      g.scene.remove(z.mesh);
      g.stats.kills++;
    }
    g.spawner.timer = 1e9;
    g.spawner.disabled = true;
    const core = new THREE.Vector3(C.x, 2, C.z);
    g.particles.explosion(core, 25);
    if (!this.survived) g.player.takeDamage(99999, core);
    else g.radio.say('Komutan', 'Tesis yok oldu! Zombiler... yere yığılıyor. Başardın!', 5);
  }

  updateNuke(dt) {
    const g = this.game;
    const C = FACILITY.core;
    if (this.nukeTime > 0.6 && !this.flashOff) {
      this.flashOff = true;
      document.getElementById('fade').classList.remove('show');
    }
    // Mantar bulutu: yükselen sütun ve tepede geniş bulut
    if (this.nukeTime < 4) {
      const h = Math.min(60, this.nukeTime * 22);
      g.particles.emit({ pos: new THREE.Vector3(C.x, h * 0.5, C.z), count: 6, colors: ['#ffab40', '#ff6d00', '#ffd180', '#8d6e63'], speed: 3, spread: 6, up: 6, life: 2, size: 3, gravity: -2, drag: 0.5, grow: 2, glow: true });
      g.particles.emit({ pos: new THREE.Vector3(C.x, h, C.z), count: 5, colors: ['#ffcc80', '#bcaaa4', '#ff7043'], speed: 9, spread: 10, up: 1, life: 2.5, size: 4, gravity: -0.5, drag: 0.8, grow: 2.5, glow: true });
    }
  }

  endText(win) {
    if (win) return { title: 'SALGIN DURDURULDU!', sub: 'Reaktör bombası tesisi ve zombileri yok etti. Ama radar güneybatıdaki roket üssünde tuhaf bir sinyal yakaladı...' };
    if (this.nuked && !this.survived) return { title: 'PATLAMADA KALDIN', sub: `Reaktörden en az ${SAFE_DIST} m uzaklaşmalıydın. Bir dahakine araca atla!` };
    return { title: 'ÖLDÜN', sub: 'Dr. Kaos güldü...' };
  }

  dispose() {
    const fade = document.getElementById('fade');
    fade.classList.remove('white');
    this.game.spawner.disabled = false;
  }
}
