import * as THREE from 'three';
import { Child } from '../entities/Child.js';
import { inSafeZone, rescueStage } from '../entities/childLogic.js';
import { SCHOOL, SAFE_ZONE } from '../world/regions.js';
import { rand, angleDiff } from '../core/math.js';

// 2. bölüm: okulda mahsur kalan Deniz'i kurtar, güvenli bölgeye götür.
export class RescueMission {
  constructor(game) {
    this.game = game;
    this.level = 2;
    this.child = new Child(game, SCHOOL.x + 4, SCHOOL.z - 2.5);
    this.child.yaw = Math.PI;
    game.child = this.child;
    this.barricade = game.world.barricades[0];
    this.finished = false;
    this.finishTime = 0;
    this.said = new Set();
    this.lureTimer = 0;
    this.flareTimer = 0;
    this.time = 0;
  }

  start() {
    const g = this.game;
    this.spawnHorde();
    g.radio.say('Telsiz', '...kşşş... Kimse var mı? Ben Deniz...', 4);
    g.radio.say('Deniz', 'Köydeki okulda saklanıyorum. Kapıyı tahtalarla kapattık. Dışarıda çok fazla var...', 6);
    g.radio.say('Deniz', 'Lütfen gelin! Okul köyün güneyinde, sarı bina.', 5);
  }

  // Okulun çevresinde dolaşan sürü
  spawnHorde() {
    const g = this.game;
    const types = ['normal', 'normal', 'normal', 'normal', 'normal', 'normal', 'normal', 'normal', 'small', 'small', 'big', 'exploder', 'normal'];
    for (const t of types) {
      for (let k = 0; k < 10; k++) {
        const a = rand(0, Math.PI * 2);
        const r = rand(11, 24);
        const x = SCHOOL.x + Math.sin(a) * r;
        const z = SCHOOL.z + Math.cos(a) * r;
        if (g.collision.blockedAt(x, z, 0.6, 2)) continue;
        g.zombies.spawn(t, x, z, {});
        break;
      }
    }
  }

  get stage() {
    const c = this.child;
    return rescueStage({
      barricadeBroken: !this.barricade || !this.barricade.alive,
      childState: c.state,
      childAlive: c.alive,
      childSafe: c.state === 'safe',
    });
  }

  objective() {
    switch (this.stage) {
      case 'school': return "Okula git ve kapıdaki tahtaları kır (köyün güneyi)";
      case 'reach': return "İçeri gir, Deniz'e ulaş";
      case 'escort': return this.child.state === 'inVehicle'
        ? 'Güvenli bölgeye sür (kuzey barikatı, yeşil duman)'
        : "Deniz'i koru ve bir araca bindir";
      case 'done': return 'Deniz güvende!';
      default: return 'Deniz öldü...';
    }
  }

  counter() {
    return { label: 'Deniz', value: `${Math.ceil(this.child.health)} / ${this.child.maxHealth}`, frac: this.child.health / this.child.maxHealth };
  }

  compassTargets() {
    const c = this.child;
    const list = [];
    if (c.state === 'hiding') list.push({ key: 'school', x: SCHOOL.x, z: SCHOOL.z, label: 'OKUL', cls: 'gas' });
    else {
      list.push({ key: 'safe', x: SAFE_ZONE.flareX, z: SAFE_ZONE.flareZ, label: 'GÜVENLİ BÖLGE', cls: 'safe' });
      if (c.state === 'following') list.push({ key: 'child', x: c.pos.x, z: c.pos.z, label: 'DENİZ', cls: 'child' });
    }
    return list;
  }

  sayOnce(key, from, text, sec) {
    if (this.said.has(key)) return;
    this.said.add(key);
    this.game.radio.say(from, text, sec);
  }

  // Oyuncu etkileşimi: döner true ise bu karede ipucu ayarlandı
  interaction(s) {
    const g = this.game;
    const c = this.child;
    const p = g.player;
    if (c.state !== 'hiding') return false;
    const d = Math.hypot(p.pos.x - c.pos.x, p.pos.z - c.pos.z);
    if (d < 2.4 && (!this.barricade || !this.barricade.alive)) {
      g.prompt = { text: 'Deniz: "Benimle gel!"' };
      if (s.interactPressed) {
        c.follow();
        g.hud.banner('DENİZ SENİNLE!', 2.5);
        g.radio.say('Deniz', 'Teşekkürler! Seni takip ediyorum, beni bırakma!', 4.5);
        g.radio.say('Kuzey Kontrol', 'Burası Kuzey Kontrol Noktası. Çocuğu getirin, yeşil dumanı takip edin!', 6);
        g.radio.say('Kuzey Kontrol', 'Araca binerseniz çocuk da biner. Kampın girişi barikatın ortasında.', 5.5);
      }
      return true;
    }
    return false;
  }

  update(dt) {
    const g = this.game;
    const c = this.child;
    this.time += dt;
    c.update(dt);

    // Okula yaklaşınca telsiz
    const dSchool = Math.hypot(g.player.pos.x - SCHOOL.x, g.player.pos.z - SCHOOL.z);
    if (c.state === 'hiding' && dSchool < 60) this.sayOnce('near', 'Deniz', 'Motor sesini duydum! Kapıdaki tahtaları kır, içerideyim!', 5);
    if (this.barricade && !this.barricade.alive) this.sayOnce('broken', 'Deniz', 'Kapı açıldı! Buradayım, sıraların arkasında!', 4);

    // Saklanan çocuk zombileri okulun çevresine çeker
    this.lureTimer -= dt;
    if (c.state === 'hiding' && this.lureTimer <= 0) {
      this.lureTimer = 3;
      for (const z of g.zombies.list) {
        if (!z.alive || z.alerted) continue;
        const d = Math.hypot(z.pos.x - SCHOOL.x, z.pos.z - SCHOOL.z);
        if (d < 35) {
          const a = rand(0, Math.PI * 2);
          z.wanderTarget = new THREE.Vector3(SCHOOL.x + Math.sin(a) * rand(8, 14), 0, SCHOOL.z + Math.cos(a) * rand(8, 14));
          z.wanderTimer = 5;
        }
      }
    }

    this.updateCamp(dt);

    // Güvenli bölgeye ulaştı mı (yaya ya da araçta)
    if (!this.finished && c.alive && c.state !== 'hiding' && inSafeZone(c.pos.x, c.pos.z, SAFE_ZONE)) {
      this.finished = true;
      this.finishTime = 0;
      g.hud.banner('GÜVENLİ BÖLGEYE ULAŞTIN!', 3);
      g.radio.say('Kuzey Kontrol', 'Çocuğu aldık! İyi iş çıkardın.', 4);
      g.audio.play('gas');
    }
    if (this.finished) {
      this.finishTime += dt;
      if (this.finishTime > 0.6 && c.state === 'inVehicle') c.leaveVehicle(c.vehicle);
      if (c.state === 'following') c.state = 'safe';
      if (this.finishTime > 3) return 'win';
    }
    return null;
  }

  // Kamp: yeşil işaret dumanı ve nöbetçi taretler
  updateCamp(dt) {
    const g = this.game;
    this.flareTimer -= dt;
    if (this.flareTimer <= 0) {
      this.flareTimer = 0.08;
      g.particles.emit({
        pos: new THREE.Vector3(SAFE_ZONE.flareX, 0.4, SAFE_ZONE.flareZ), count: 1,
        colors: ['#69f0ae', '#00e676', '#b9f6ca'], speed: 0.6, up: 4, life: 5, size: 0.7,
        gravity: -0.6, drag: 0.4, grow: 3, glow: true,
      });
    }
    for (const t of g.world.turrets) {
      t.cooldown -= dt;
      let best = null;
      let bd = 26;
      for (const z of g.zombies.list) {
        if (!z.alive) continue;
        const d = Math.hypot(z.pos.x - t.x, z.pos.z - t.z);
        if (d < bd && g.collision.lineOfSight(t.x, 1.5, t.z, z.pos.x, 1.2 * z.scale, z.pos.z)) {
          bd = d;
          best = z;
        }
      }
      if (!best) continue;
      const target = Math.atan2(-(best.pos.x - t.x), -(best.pos.z - t.z));
      t.head.rotation.y += angleDiff(t.head.rotation.y, target) * Math.min(1, dt * 8);
      if (t.cooldown <= 0) {
        t.cooldown = 0.5;
        const muzzle = new THREE.Vector3(t.x, 1.5, t.z);
        const hit = best.chestPos;
        g.particles.tracer(muzzle, hit, '#b9f6ca');
        g.audio.play('turret', muzzle, 0.8);
        g.zombies.damage(best, 30, 'body', 'bullet', hit.clone().sub(muzzle).normalize());
        g.particles.blood(hit, new THREE.Vector3(0, 1, 0), 5);
      }
    }
  }

  dispose() {
    this.child.remove();
  }
}
