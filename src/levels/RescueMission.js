import * as THREE from 'three';
import { Child } from '../entities/Child.js';
import { inSafeZone, rescueStatus } from '../entities/childLogic.js';
import { HIDEOUTS, SAFE_ZONE } from '../world/regions.js';
import { rand, angleDiff } from '../core/math.js';

// 2. bölüm: okul, ambar ve benzinlikte mahsur kalan üç çocuğu kurtar, güvenli bölgeye götür.
export class RescueMission {
  constructor(game) {
    this.game = game;
    this.level = 2;
    this.children = HIDEOUTS.map((h, i) => {
      const c = new Child(game, h.x, h.z, { name: h.name, coat: h.coat, pitch: h.pitch });
      c.yaw = Math.PI;
      c.hideout = h;
      c.barricade = game.world.barricades[i];
      c.rescuedAt = 0;
      return c;
    });
    game.children = this.children;
    this.finished = false;
    this.finishTime = 0;
    this.said = new Set();
    this.lureTimer = 0;
    this.flareTimer = 0;
    this.time = 0;
    this.deadChild = null;
  }

  start() {
    const g = this.game;
    g.dayNight.time = 250;
    // Gece zaten başlamış: "gece çöküyor" yazısı bölüm başlığını örtmesin
    g.wasNight = true;
    g.spawner.elapsed = 150;
    const sedan = g.vehicles.list.find((v) => v.typeKey === 'sedan');
    if (sedan) g.vehicles.enter(sedan);
    g.hud.banner('2. BÖLÜM: MAHSUR ÇOCUKLAR', 4);
    this.spawnHordes();
    g.radio.say('Telsiz', '...kşşş... Kimse var mı? Ben Deniz...', 4);
    g.radio.say('Deniz', 'Köydeki okulda saklanıyorum. Kapıyı tahtalarla kapattık. Dışarıda çok fazla var...', 6);
    g.radio.say('Ela', 'Ben Ela! Çiftlikteki ambardayım, samanların arkasına saklandım...', 5);
    g.radio.say('Can', 'Benzinlik dükkânındayım, kapıyı çaktım ama dayanmaz! Çabuk!', 5);
    g.radio.say('Kuzey Kontrol', 'Üç çocuğu da kuzey barikatındaki kampa getirin. Yeşil dumanı takip edin.', 5.5);
  }

  // Her saklanma yerinin çevresinde dolaşan sürü
  spawnHordes() {
    const g = this.game;
    const packs = [
      ['normal', 'normal', 'normal', 'normal', 'normal', 'normal', 'normal', 'small', 'small', 'big', 'exploder'],
      ['normal', 'normal', 'normal', 'normal', 'small', 'exploder', 'gunner'],
      ['normal', 'normal', 'normal', 'normal', 'small', 'big', 'gunner'],
    ];
    HIDEOUTS.forEach((h, i) => {
      for (const t of packs[i]) {
        for (let k = 0; k < 12; k++) {
          const a = rand(0, Math.PI * 2);
          const r = rand(12, 26);
          const x = h.x + Math.sin(a) * r;
          const z = h.z + Math.cos(a) * r;
          if (g.collision.blockedAt(x, z, 0.6, 2)) continue;
          g.zombies.spawn(t, x, z, t === 'gunner' ? { weapon: 'pistol' } : {});
          break;
        }
      }
    });
  }

  get status() {
    return rescueStatus(this.children);
  }

  objective() {
    const st = this.status;
    if (st.done) return 'Tüm çocuklar güvende!';
    if (st.failed) return `${this.deadChild ? this.deadChild.name : 'Bir çocuk'} öldü...`;
    const withYou = this.children.filter((c) => c.state === 'following' || c.state === 'inVehicle').map((c) => c.name);
    const hiding = this.children.filter((c) => c.state === 'hiding');
    if (withYou.length && !hiding.length) return `${withYou.join(', ')} seninle — kuzeydeki güvenli bölgeye götür (yeşil duman)`;
    if (withYou.length) return `${withYou.join(', ')} seninle · Sıradaki: ${hiding.map((c) => c.hideout.place.toLocaleLowerCase('tr-TR')).join(', ')}`;
    return `Çocukları kurtar (${st.safe}/3 güvende): ${hiding.map((c) => c.hideout.place.toLocaleLowerCase('tr-TR')).join(', ')} — kapıları kır`;
  }

  // HUD: her çocuğun can çubuğu
  counters() {
    return this.children.map((c) => ({
      label: c.name,
      value: c.state === 'safe' ? 'GÜVENDE' : c.alive ? `${Math.ceil(c.health)}` : 'ÖLDÜ',
      frac: c.health / c.maxHealth,
      color: c.coat,
    }));
  }

  compassTargets() {
    const list = [];
    let anyEscort = false;
    for (const c of this.children) {
      if (c.state === 'hiding') list.push({ key: 'hide-' + c.name, x: c.hideout.x, z: c.hideout.z, label: c.hideout.place, cls: 'gas' });
      if (c.state === 'following' || c.state === 'inVehicle') anyEscort = true;
      if (c.state === 'following') {
        const p = this.game.player.pos;
        if (Math.hypot(c.pos.x - p.x, c.pos.z - p.z) > 12) list.push({ key: 'child-' + c.name, x: c.pos.x, z: c.pos.z, label: c.name.toUpperCase(), cls: 'child' });
      }
    }
    if (anyEscort || this.status.safe > 0) list.push({ key: 'safe', x: SAFE_ZONE.flareX, z: SAFE_ZONE.flareZ, label: 'GÜVENLİ BÖLGE', cls: 'safe' });
    return list;
  }

  sayOnce(key, from, text, sec) {
    if (this.said.has(key)) return;
    this.said.add(key);
    this.game.radio.say(from, text, sec);
  }

  saveBlock() {
    return this.finished ? 'Şu an kaydedilemez' : null;
  }

  saveState() {
    return {
      time: this.time,
      said: [...this.said],
      kids: this.children.map((c) => ({ state: c.state, health: c.health, rescuedAt: c.rescuedAt })),
    };
  }

  // Kayıttan dönüş: takip eden ya da araçtaki çocuklar oyuncunun yanında başlar
  restoreState(d) {
    const p = this.game.player.pos;
    this.time = d.time || 0;
    this.said = new Set(d.said || []);
    (d.kids || []).forEach((s, i) => {
      const c = this.children[i];
      if (!c || !s) return;
      c.health = Math.max(1, Math.min(c.maxHealth, s.health || c.maxHealth));
      c.rescuedAt = s.rescuedAt || 0;
      if (s.state === 'safe') {
        c.state = 'safe';
        c.pos.set(SAFE_ZONE.flareX + 7 + i * 1.2, 0, SAFE_ZONE.flareZ + 3);
        c.yaw = Math.PI;
        c.animate(0, 0);
      } else if (s.state === 'following' || s.state === 'inVehicle') {
        const a = (i / 3) * Math.PI * 2;
        c.pos.set(p.x + Math.sin(a) * 1.6, 0, p.z + Math.cos(a) * 1.6);
        c.lastPos.copy(c.pos);
        c.follow();
      }
      c.mesh.position.copy(c.pos);
    });
  }

  // Oyuncu etkileşimi: döner true ise bu karede ipucu ayarlandı
  interaction(s) {
    const g = this.game;
    const p = g.player;
    for (const c of this.children) {
      if (c.state !== 'hiding') continue;
      const d = Math.hypot(p.pos.x - c.pos.x, p.pos.z - c.pos.z);
      if (d < 2.4 && (!c.barricade || !c.barricade.alive)) {
        g.prompt = { text: `${c.name}: "Benimle gel!"` };
        if (s.interactPressed) {
          c.follow();
          c.rescuedAt = this.time;
          g.hud.banner(`${c.name.toUpperCase()} SENİNLE!`, 2.5);
          g.radio.say(c.name, 'Teşekkürler! Seni takip ediyorum, beni bırakma!', 4.5);
          if (!this.said.has('control')) {
            this.said.add('control');
            g.radio.say('Kuzey Kontrol', 'Araca binerseniz çocuklar da biner. Kampın girişi barikatın ortasında.', 5.5);
          }
        }
        return true;
      }
    }
    return false;
  }

  update(dt) {
    const g = this.game;
    this.time += dt;
    // Takip sırası: önce kurtarılan öne
    const followers = this.children.filter((c) => c.state === 'following').sort((a, b) => a.rescuedAt - b.rescuedAt);
    followers.forEach((c, i) => { c.order = i; });
    for (const c of this.children) c.update(dt);

    for (const c of this.children) {
      if (c.state !== 'hiding') continue;
      const d = Math.hypot(g.player.pos.x - c.hideout.x, g.player.pos.z - c.hideout.z);
      if (d < 60) this.sayOnce('near-' + c.name, c.name, `Motor sesini duydum! Kapıdaki tahtaları kır, içerideyim!`, 5);
      if (c.barricade && !c.barricade.alive) this.sayOnce('open-' + c.name, c.name, 'Kapı açıldı! Buradayım!', 4);
    }

    // Saklanan çocuklar zombileri binanın çevresine çeker
    this.lureTimer -= dt;
    if (this.lureTimer <= 0) {
      this.lureTimer = 3;
      for (const c of this.children) {
        if (c.state !== 'hiding') continue;
        for (const z of g.zombies.list) {
          if (!z.alive || z.alerted) continue;
          if (Math.hypot(z.pos.x - c.hideout.x, z.pos.z - c.hideout.z) < 35) {
            const a = rand(0, Math.PI * 2);
            z.wanderTarget = new THREE.Vector3(c.hideout.x + Math.sin(a) * rand(9, 15), 0, c.hideout.z + Math.cos(a) * rand(9, 15));
            z.wanderTimer = 5;
          }
        }
      }
    }

    this.updateCamp(dt);

    // Güvenli bölgeye ulaşan çocuk kampta kalır
    this.children.forEach((c, i) => {
      if (!c.alive || (c.state !== 'following' && c.state !== 'inVehicle')) return;
      if (!inSafeZone(c.pos.x, c.pos.z, SAFE_ZONE)) return;
      if (c.state === 'inVehicle') c.leaveVehicle(c.vehicle);
      c.state = 'safe';
      c.pos.set(SAFE_ZONE.flareX + 7 + i * 1.2, 0, SAFE_ZONE.flareZ + 3);
      c.yaw = Math.PI;
      c.animate(0, 0);
      g.audio.play('gas');
      const st = this.status;
      g.radio.say('Kuzey Kontrol', st.done ? 'Üç çocuk da güvende! İyi iş çıkardın.' : `${c.name} güvende! (${st.safe}/3) Diğerlerini de getir.`, 4);
    });

    const st = this.status;
    if (st.done && !this.finished) {
      this.finished = true;
      this.finishTime = 0;
      g.hud.banner('ÇOCUKLAR GÜVENDE!', 3);
    }
    if (this.finished) {
      this.finishTime += dt;
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
    updateTurrets(g, dt);
  }

  endText(win, reason) {
    if (win) return { title: 'ÇOCUKLAR KURTARILDI!', sub: 'Deniz, Ela ve Can kampta güvende. Ama salgının kaynağı hâlâ orada...' };
    if (reason === 'child') {
      const n = this.deadChild ? this.deadChild.name : 'Bir çocuk';
      return { title: `${n.toUpperCase()} ÖLDÜ`, sub: 'Çocuğu koruyamadın. Bir daha dene.' };
    }
    return { title: 'ÖLDÜN', sub: 'Çocuklar yalnız kaldı...' };
  }

  dispose() {
    for (const c of this.children) c.remove();
    this.game.children = [];
  }
}

// Kamp taretleri: görüş hattındaki en yakın zombiyi vurur (3. ve 4. bölümde de kullanılır)
export function updateTurrets(g, dt) {
  for (const t of g.world.turrets) {
    t.cooldown -= dt;
    let best = null;
    let bd = 26;
    for (const z of g.zombies.list) {
      if (!z.alive || z.type.human) continue;
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
