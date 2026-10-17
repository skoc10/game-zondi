import { STATION } from '../world/spaceStation.js';
import { SPACE_GRAVITY, SPACE_THROW_GRAVITY, QUEEN_THRESHOLDS, PHASE_CRYSTALS, queenPhase, roomCleared } from './spaceLogic.js';
import { rand } from '../core/math.js';

// Her bölmede çıkan uzaylılar [uzaylı, drone]
const ROOM_ENEMIES = [[2, 2], [5, 3], [6, 4], [4, 0]];
const QUEEN_POS = { x: 0, z: -156 };
const CRYSTALS = { 1: [[-11, -144], [11, -144]], 2: [[0, -136], [-9, -156], [9, -156]] };

// 4. bölüm (b): uzaylıların ele geçirdiği istasyon. Bölmeleri temizle, Kraliçe'yi durdur.
export class StationMission {
  constructor(game) {
    this.game = game;
    this.level = 4;
    game.children = [];
    this.room = 0;
    this.groups = STATION.rooms.map(() => []);
    this.queen = null;
    this.phase = 1;
    this.queenDead = false;
    this.winTimer = 0;
    this.said = new Set();
    this.pulse = 0;
  }

  start() {
    const g = this.game;
    const S = STATION.start;
    g.player.pos.set(S.x, 0, S.z);
    g.player.yaw = 0;
    g.player.gravity = SPACE_GRAVITY;
    g.explosives.gravity = SPACE_THROW_GRAVITY;
    this.spawnRoom(0);
    g.hud.banner('UZAY İSTASYONU', 4);
    g.radio.say('Komutan', 'İstasyona yanaştın! Yerçekimi düşük: zıplayınca süzülürsün, bombalar yavaş düşer.', 6);
    g.radio.say('Komutan', 'Uzaylılar istasyonu ele geçirmiş. Her bölmeyi temizle, enerji kapıları açılacak.', 6);
  }

  spawnRoom(i) {
    const g = this.game;
    const r = STATION.rooms[i];
    const [aliens, drones] = ROOM_ENEMIES[i];
    const list = this.groups[i];
    const put = (type, n) => {
      for (let k = 0, made = 0; k < 60 && made < n; k++) {
        const x = rand(r.x - r.w / 2 + 2.5, r.x + r.w / 2 - 2.5);
        // Oyuncudan uzak yarıda (kuzeyde) doğarlar
        const z = rand(r.z - r.d / 2 + 2.5, r.z - (i === 0 ? 1 : -r.d / 4));
        if (g.collision.blockedAt(x, z, 0.8, 2)) continue;
        if (Math.hypot(x - g.player.pos.x, z - g.player.pos.z) < 8) continue;
        list.push(g.zombies.spawn(type, x, z, { alerted: i > 0 }));
        made++;
      }
    };
    put('alien', aliens);
    put('alienDrone', drones);
    if (i === STATION.rooms.length - 1) this.spawnQueen();
  }

  spawnQueen() {
    const g = this.game;
    this.queen = g.zombies.spawn('alienQueen', QUEEN_POS.x, QUEEN_POS.z, {});
    this.queen.shielded = true;
    this.groups[this.groups.length - 1].push(this.queen);
    this.spawnCrystals(1);
    g.hud.banner('KRALİÇE!', 3);
    g.radio.say('Uzaylı Kraliçe', 'Küçük insan... Gezegenin artık bizim!', 4.5);
    g.radio.say('Komutan', 'Kraliçenin kalkanını pembe kristaller besliyor. Önce kristalleri yık!', 5);
    g.audio.play('alien', this.queen.pos, 1.4, 0.6);
  }

  spawnCrystals(phase) {
    const w = this.game.world;
    for (const [x, z] of CRYSTALS[phase] || []) w.addCrystalPylon(x, z);
  }

  get crystalsUp() {
    return (this.game.world.pylons || []).filter((p) => p.alive).length;
  }

  aliveIn(i) {
    return this.groups[i].filter((z) => z.alive).length;
  }

  objective() {
    const r = STATION.rooms[this.room];
    if (this.queenDead) return 'İstasyon kurtarıldı!';
    if (this.room < STATION.rooms.length - 1) return `${r.name}: uzaylıları temizle (${this.aliveIn(this.room)} kaldı)`;
    const q = this.queen;
    if (q && q.shielded) return `Uzaylı Kraliçe'nin kalkanı açık — pembe kristalleri yık (${this.crystalsUp})`;
    return "Uzaylı Kraliçe'yi durdur! Zayıf noktası kafası";
  }

  counters() {
    const list = [];
    const last = STATION.rooms.length - 1;
    if (this.room < last) {
      const n = this.groups[this.room].length;
      const a = this.aliveIn(this.room);
      list.push({ label: 'BÖLME', value: `${this.room + 1}/${last}`, frac: a / (n || 1), color: '#e040fb' });
    }
    const q = this.queen;
    if (q && q.alive) list.push({ label: 'KRALİÇE', value: q.shielded ? 'KALKANLI' : `%${Math.ceil((q.health / q.maxHealth) * 100)}`, frac: q.health / q.maxHealth, color: '#ff4081' });
    return list;
  }

  compassTargets() {
    if (this.queenDead) return [];
    const q = this.queen;
    if (q && q.alive) return [{ key: 'queen', x: q.pos.x, z: q.pos.z, label: 'KRALİÇE', cls: 'gas' }];
    // En yakın canlı uzaylı ya da bölme merkezi
    const r = STATION.rooms[this.room];
    return [{ key: 'room-' + this.room, x: r.x, z: r.z, label: r.name.toLocaleUpperCase('tr-TR'), cls: 'gas' }];
  }

  interaction() {
    return false;
  }

  sayOnce(key, from, text, sec) {
    if (this.said.has(key)) return;
    this.said.add(key);
    this.game.radio.say(from, text, sec);
  }

  update(dt) {
    const g = this.game;
    const w = g.world;
    const last = STATION.rooms.length - 1;
    // Bölme temizlendi: enerji kapısı açılır, sonraki bölmede uzaylılar belirir
    if (this.room < last && roomCleared(this.groups[this.room])) {
      w.openForceField(this.room);
      g.audio.play('door', null, 1);
      this.room++;
      g.hud.banner(this.room === last ? 'ÇEKİRDEK ODASI AÇILDI' : 'BÖLME TEMİZLENDİ — KAPI AÇILDI', 3);
      if (this.room === 1) g.radio.say('Komutan', 'Güzel! Laboratuvarda daha fazlası var. Uçan droneler yaklaşınca patlar, uzaktan vur!', 5.5);
      if (this.room === 2) g.radio.say('Komutan', 'Sera bölmesi. Uzaylı sarmaşıklar her yeri sarmış. Dikkat et!', 5);
      this.spawnRoom(this.room);
    }
    const q = this.queen;
    if (q) {
      q.shielded = q.alive && this.crystalsUp > 0;
      if (q.shieldMesh) q.shieldMesh.visible = q.shielded;
      if (q.alive) {
        const want = queenPhase(q.health / q.maxHealth);
        if (want > this.phase) this.nextPhase(this.phase + 1);
        if (q.pos.distanceTo(g.player.pos) < 35) this.sayOnce('queen-near', 'Uzaylı Kraliçe', 'Zombiler sadece başlangıçtı!', 4);
      } else if (!this.queenDead) {
        this.queenDied();
      }
    }
    // Çekirdek nabız gibi parlar
    this.pulse += dt;
    if (w.alienCore) {
      w.alienCore.rotation.y += dt * (this.queenDead ? 0 : 0.8);
      w.alienCore.material.emissiveIntensity = this.queenDead ? 0.1 : 1.2 + Math.sin(this.pulse * 3) * 0.5;
    }
    if (w.earth) w.earth.rotation.y += dt * 0.01;
    if (this.queenDead) {
      this.winTimer += dt;
      if (this.winTimer > 4.5) return 'win';
    }
    return null;
  }

  nextPhase(phase) {
    const g = this.game;
    const q = this.queen;
    this.phase = phase;
    // Tek atışla aşama atlanmasın: can bir sonraki eşiğin üstünde tutulur
    const floor = QUEEN_THRESHOLDS[phase - 1];
    if (floor) q.health = Math.max(q.health, floor * q.maxHealth + 1);
    if (PHASE_CRYSTALS[phase] > 0) {
      this.spawnCrystals(phase);
      g.hud.banner('KRALİÇE YENİ KALKAN AÇTI!', 3);
    } else {
      g.hud.banner('KRALİÇE ÖFKELENDİ!', 3);
    }
    g.radio.say('Uzaylı Kraliçe', phase === 2 ? 'Gelin çocuklarım!' : 'YETER! Hepiniz yok olacaksınız!', 3.5);
    g.audio.play('alien', q.pos, 1.4, 0.6);
    // Çağrılan uzaylılar
    const n = phase === 2 ? 3 : 2;
    const d = phase === 2 ? 2 : 5;
    for (let i = 0; i < n + d; i++) {
      const a = (i / (n + d)) * Math.PI * 2;
      const x = q.pos.x + Math.sin(a) * 9;
      const z = q.pos.z + Math.cos(a) * 9;
      if (Math.abs(x) > 17 || z > -126 || z < -158 || g.collision.blockedAt(x, z, 0.7, 2)) continue;
      g.zombies.spawn(i < n ? 'alien' : 'alienDrone', x, z, { alerted: true });
    }
  }

  queenDied() {
    const g = this.game;
    this.queenDead = true;
    g.hud.banner('KRALİÇE ÖLDÜ!', 4);
    g.radio.say('Komutan', 'Kraliçe öldü! Uzaylıların bağlantısı koptu... Dünyadaki zombiler duruyor! Başardın!', 6);
    g.addShake(0.8);
    g.input.rumble(0.8, 0.8, 1200);
    // Kalan uzaylılar çöker
    for (const z of g.zombies.list) {
      if (!z.alive || z === this.queen) continue;
      g.zombies.damage(z, 9999, 'body', 'bullet');
    }
    if (this.queen) g.particles.explosion(this.queen.pos.clone().setY(2), 8);
  }

  endText(win) {
    if (win) return { title: 'DÜNYA KURTARILDI!', sub: 'Uzaylı Kraliçe yok edildi, istasyon kurtarıldı ve zombi salgını sona erdi. ZONDI\'yi bitirdin!' };
    return { title: 'ÖLDÜN', sub: 'Uzaylılar istasyonu elinde tuttu...' };
  }

  dispose() {}
}

export { QUEEN_POS };
