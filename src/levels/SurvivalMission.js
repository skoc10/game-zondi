import * as THREE from 'three';
import {
  SURVIVAL_LEVEL, START_HUNGER, START_THIRST, LOW, CANTEEN_MAX, COOK_TIME, DRINK_TIME,
  tickNeeds, eat, sip, survivalTime, formatSurvival, loadRecord, updateRecord,
} from './survivalLogic.js';
import { rand } from '../core/math.js';

const START = { x: -100, z: 34 };
const MAX_MEAT = 8;

// Bağımsız hayatta kalma modu: aç ve susuz kalma, geyik avı, su kaynakları, zombiler. Sonsuz; rekor için.
export class SurvivalMission {
  constructor(game) {
    this.game = game;
    this.level = SURVIVAL_LEVEL;
    game.children = [];
    this.hunger = START_HUNGER;
    this.thirst = START_THIRST;
    this.canteen = 0;
    this.raw = 0;
    this.cooked = 0;
    this.elapsed = 0;
    this.day = 1;
    this.progress = 0;
    this.needHitAt = -10;
    this.needCause = null;
    this.warned = {};
    this.counts = { deer: 0, eaten: 0, drinks: 0 };
    this.fxTimer = 0;
    this.lureTimer = 0;
    this.growlTimer = 20;
    // Bu oyun başlamadan önceki rekor (yeni rekor mu kararı için)
    this.startRecord = loadRecord();
  }

  start() {
    const g = this.game;
    g.dayNight.time = 20;
    g.wasNight = false;
    g.player.pos.set(START.x, 0, START.z);
    g.player.yaw = Math.PI / 2;
    g.animals.populate(g.player.pos, 3);
    g.hud.banner('HAYATTA KAL — 1. GÜN', 4);
    g.radio.say('Sen', 'Erzak bitti, matara boş... Bir şeyler bulmam lazım.', 4.5);
    g.radio.say('Telsiz', 'Kuzeybatıda göl, köyde kuyu, çiftlikte pompa var. Geyikler meralarda otluyor.', 6);
    g.radio.say('Telsiz', 'Eti kamp ateşinde pişir; çiğ et midene dokunur. Ne kadar dayanabilirsin?', 5.5);
  }

  get time() {
    return survivalTime(this.elapsed);
  }

  objective() {
    if (this.thirst < LOW) return 'SUSUZLUK! Su kaynağına git (pusulada SU) ya da mataradan iç';
    if (this.hunger < LOW) return this.cooked || this.raw ? 'AÇLIK! Yemek ye' : 'AÇLIK! Geyik avla, eti ateşte pişir';
    if (this.raw > 0) return 'Çiğ eti kamp ateşinde pişir (pusulada ATEŞ)';
    if (this.canteen === 0) return 'Matarayı bir su kaynağında doldur';
    return `${this.day}. gün — hayatta kal: avlan, su bul, zombilerden uzak dur`;
  }

  counters() {
    return [
      { label: 'AÇLIK', value: `${Math.ceil(this.hunger)}`, frac: this.hunger / 100, color: '#ff9800', warn: this.hunger < LOW },
      { label: 'SU', value: `${Math.ceil(this.thirst)}`, frac: this.thirst / 100, color: '#29b6f6', warn: this.thirst < LOW },
      { label: 'MATARA', value: `${this.canteen}/${CANTEEN_MAX}`, frac: this.canteen / CANTEEN_MAX, color: '#4dd0e1' },
      { label: 'ET', value: `${this.raw} çiğ ${this.cooked} piş.`, frac: Math.min(1, (this.raw + this.cooked) / 4), color: '#e57373' },
      { label: 'GÜN', value: `${this.day}. gün`, frac: (this.elapsed % 360) / 360, color: '#9ccc65' },
    ];
  }

  nearest(list, n = 1) {
    const p = this.game.player.pos;
    return [...list].sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z)).slice(0, n);
  }

  compassTargets() {
    const g = this.game;
    const w = g.world;
    const list = [];
    if (this.thirst < 60 || this.canteen === 0) {
      this.nearest(w.waterSources, 2).forEach((s, i) => list.push({ key: 'water-' + i, x: s.x, z: s.z, label: 'SU', cls: 'safe' }));
    }
    if (this.raw > 0) {
      const [f] = this.nearest(w.campfires);
      if (f) list.push({ key: 'fire', x: f.x, z: f.z, label: 'ATEŞ', cls: 'gas' });
    }
    if (this.hunger < 50 && !this.raw && !this.cooked) {
      const p = g.player.pos;
      const deer = g.animals.list.filter((d) => d.alive && d.pos.distanceTo(p) < 120);
      const [d] = this.nearest(deer.map((x) => ({ x: x.pos.x, z: x.pos.z })));
      if (d) list.push({ key: 'deer', x: d.x, z: d.z, label: 'GEYİK', cls: 'child' });
    }
    return list;
  }

  near(list) {
    const p = this.game.player.pos;
    return list.find((s) => Math.hypot(s.x - p.x, s.z - p.z) < s.r);
  }

  interaction(s) {
    const g = this.game;
    const dt = g.lastDt || 1 / 30;
    const water = this.near(g.world.waterSources);
    if (water) {
      if (this.thirst < 99) {
        if (s.interact) {
          this.progress += dt / DRINK_TIME;
          if (this.progress >= 1) {
            this.progress = 0;
            this.thirst = 100;
            this.counts.drinks++;
            this.warned.thirst = 0;
            g.audio.play('drink');
            g.hud.toast(`${water.name}: kana kana içtin`);
          }
        } else {
          this.progress = Math.max(0, this.progress - dt);
        }
        g.prompt = { text: `Su iç (${water.name})`, hold: true, progress: this.progress };
        return true;
      }
      if (this.canteen < CANTEEN_MAX) {
        g.prompt = { text: `Matarayı doldur (${this.canteen}/${CANTEEN_MAX})` };
        if (s.interactPressed) {
          this.canteen = CANTEEN_MAX;
          g.audio.play('drink', null, 0.7, 1.3);
          g.hud.toast(`Matara doldu (${CANTEEN_MAX} yudum) — ${g.input.lastDevice === 'pad' ? 'D-pad ►' : 'J'} ile iç`);
        }
        return true;
      }
    }
    const fire = this.near(g.world.campfires);
    if (fire && this.raw > 0) {
      if (s.interact) {
        this.progress += dt / COOK_TIME;
        if (this.progress >= 1) {
          this.progress = 0;
          this.raw--;
          this.cooked++;
          g.audio.play('sizzle', fire.light.position);
          g.hud.toast(`Et pişti (${this.cooked} pişmiş) — ${g.input.lastDevice === 'pad' ? 'D-pad ◄' : 'H'} ile ye`);
        }
      } else {
        this.progress = Math.max(0, this.progress - dt);
      }
      g.prompt = { text: `Eti pişir (${this.raw} çiğ)`, hold: true, progress: this.progress };
      return true;
    }
    if (!water && !fire) this.progress = 0;
    return false;
  }

  // H / D-pad ◄ ye, J / D-pad ► mataradan iç (araçtayken de)
  onInput(s) {
    const g = this.game;
    const p = g.player;
    if (!p.alive) return;
    if (s.eat) {
      const r = eat(this);
      if (!r.ate) {
        g.hud.toast('Yiyecek yok — geyik avla');
        g.audio.play('empty');
      } else {
        Object.assign(this, { hunger: r.hunger, raw: r.raw, cooked: r.cooked });
        this.counts.eaten++;
        this.warned.hunger = 0;
        g.audio.play('eat');
        if (r.heal > 0) {
          p.health = Math.min(100, p.health + r.heal);
          g.hud.toast('Pişmiş et: doydun');
        } else {
          p.takeDamage(-r.heal, null);
          g.hud.toast('Çiğ et! Midem bulandı...');
        }
      }
    }
    if (s.drink) {
      const r = sip(this);
      if (!r.drank) {
        g.hud.toast('Matara boş — su kaynağında doldur');
        g.audio.play('empty');
      } else {
        this.canteen = r.canteen;
        this.thirst = r.thirst;
        this.warned.thirst = 0;
        g.audio.play('drink', null, 0.7);
        g.hud.toast(`Mataradan içtin (${this.canteen}/${CANTEEN_MAX})`);
      }
    }
  }

  addMeat(n) {
    const room = MAX_MEAT - this.raw - this.cooked;
    const add = Math.max(0, Math.min(n, room));
    this.raw += add;
    return add;
  }

  get meatFull() {
    return this.raw + this.cooked >= MAX_MEAT;
  }

  warn(key, value) {
    const g = this.game;
    const level = value <= 0 ? 3 : value < LOW ? 2 : value < 50 ? 1 : 0;
    if (level <= (this.warned[key] || 0)) {
      if (level < (this.warned[key] || 0)) this.warned[key] = level;
      return;
    }
    this.warned[key] = level;
    const t = {
      hunger: [null, 'Karnım acıktı...', 'Çok açım, bir şey yemeliyim!', 'Açlıktan bayılacağım!'],
      thirst: [null, 'Boğazım kurudu...', 'Çok susadım, su bulmalıyım!', 'Susuzluktan ölüyorum!'],
    }[key][level];
    g.radio.say('Sen', t, 3.5);
    if (level >= 2) g.audio.play(key === 'hunger' ? 'growl' : 'hurt', null, 0.6);
  }

  update(dt) {
    const g = this.game;
    const p = g.player;
    g.lastDt = dt;
    if (!p.alive) return null;
    this.elapsed += dt;

    const r = tickNeeds(this, dt, !p.vehicle && p.speed > 6);
    this.hunger = r.hunger;
    this.thirst = r.thirst;
    if (r.damage > 0) {
      p.health = Math.max(0, p.health - r.damage);
      p.hurt = Math.min(0.6, p.hurt + dt * 0.8);
      this.needHitAt = this.elapsed;
      this.needCause = r.cause;
      if (p.health <= 0) {
        p.alive = false;
        p.deathTime = 0;
      }
    }
    this.warn('hunger', this.hunger);
    this.warn('thirst', this.thirst);
    p.staminaMult = this.hunger < LOW || this.thirst < LOW ? 0.45 : 1;
    // Açken mide guruldar
    this.growlTimer -= dt;
    if (this.hunger < 35 && this.growlTimer <= 0) {
      this.growlTimer = rand(15, 25);
      g.audio.play('growl', null, 0.5);
    }

    // Yeni gün: zombiler artar
    const day = this.time.day;
    if (day > this.day) {
      this.day = day;
      g.hud.banner(`${day}. GÜN`, 3.5);
      g.radio.say('Sen', `${day}. gün... Hâlâ hayattayım.`, 3.5);
      this.saveRecord();
    }
    g.spawner.boost = Math.min(1.8, 1 + (this.day - 1) * 0.15);

    this.updateFires(dt);
    return null;
  }

  // Kamp ateşleri titrer; gece ışığı zombileri çeker
  updateFires(dt) {
    const g = this.game;
    const p = g.player.pos;
    const t = performance.now() / 1000;
    this.fxTimer -= dt;
    const emit = this.fxTimer <= 0;
    if (emit) this.fxTimer = 0.12;
    for (const [i, f] of g.world.campfires.entries()) {
      const flick = 0.85 + Math.sin(t * 13 + i) * 0.08 + Math.sin(t * 7.3 + i * 2) * 0.07;
      f.light.intensity = 8 * flick;
      f.flame.scale.set(1, flick, 1);
      f.inner.scale.set(1, 2 - flick, 1);
      if (emit && Math.hypot(f.x - p.x, f.z - p.z) < 90) {
        g.particles.emit({ pos: new THREE.Vector3(f.x, 0.8, f.z), count: 1, colors: ['#ffab40', '#ffd180', '#ff6d00'], speed: 0.5, up: 2.5, spread: 0.4, life: 1, size: 0.06, gravity: -1, glow: true });
        g.particles.emit({ pos: new THREE.Vector3(f.x, 1.3, f.z), count: 1, colors: ['#616161', '#757575'], speed: 0.2, up: 1.2, spread: 0.3, life: 2, size: 0.18, gravity: -0.4, drag: 0.5, grow: 1.2 });
      }
    }
    this.lureTimer -= dt;
    if (this.lureTimer <= 0 && g.dayNight.night > 0.5) {
      this.lureTimer = 5;
      for (const f of g.world.campfires) {
        for (const z of g.zombies.list) {
          if (!z.alive || z.alerted || Math.hypot(z.pos.x - f.x, z.pos.z - f.z) > 45) continue;
          z.wanderTarget = new THREE.Vector3(f.x + rand(-6, 6), 0, f.z + rand(-6, 6));
          z.wanderTimer = 6;
        }
      }
    }
  }

  saveRecord() {
    return updateRecord(Math.floor(this.elapsed), { deer: this.counts.deer });
  }

  get deathCause() {
    return this.elapsed - this.needHitAt < 1.5 ? this.needCause : null;
  }

  saveBlock() {
    return null;
  }

  saveState() {
    return {
      hunger: this.hunger, thirst: this.thirst, canteen: this.canteen, raw: this.raw, cooked: this.cooked,
      elapsed: this.elapsed, warned: this.warned, counts: this.counts, deer: this.game.animals.serialize(),
    };
  }

  restoreState(d) {
    const num = (v, def) => (Number.isFinite(v) ? v : def);
    this.hunger = num(d.hunger, START_HUNGER);
    this.thirst = num(d.thirst, START_THIRST);
    this.canteen = Math.max(0, Math.min(CANTEEN_MAX, num(d.canteen, 0)));
    this.raw = num(d.raw, 0);
    this.cooked = num(d.cooked, 0);
    this.elapsed = num(d.elapsed, 0);
    this.day = this.time.day;
    this.warned = d.warned || {};
    this.counts = { deer: 0, eaten: 0, drinks: 0, ...(d.counts || {}) };
    // Kayıttan dönünce aç/susuz ölüm döngüsü olmasın
    this.hunger = Math.max(this.hunger, 20);
    this.thirst = Math.max(this.thirst, 20);
    this.game.animals.restore(d.deer || []);
    if (this.game.animals.aliveCount < 3) this.game.animals.populate(this.game.player.pos, 2);
  }

  endStats() {
    const g = this.game;
    return [
      ['Hayatta kalınan', formatSurvival(this.elapsed)],
      ['Öldürülen zombi', g.stats.kills],
      ['Kafadan vuruş', g.stats.headshots],
      ['Avlanan geyik', this.counts.deer],
      ['Yenen et', this.counts.eaten],
      ['İçilen su', this.counts.drinks],
    ];
  }

  endText() {
    const prev = this.startRecord;
    const { record } = this.saveRecord();
    const isNew = !prev || this.elapsed > prev.seconds;
    const cause = this.deathCause;
    const title = cause === 'thirst' ? 'SUSUZLUKTAN ÖLDÜN' : cause === 'hunger' ? 'AÇLIKTAN ÖLDÜN' : 'ÖLDÜN';
    const best = isNew && prev ? 'YENİ REKOR!' : isNew ? 'İlk rekorun!' : `Rekor: ${formatSurvival(record.seconds)}`;
    return { title, sub: `${formatSurvival(this.elapsed)} hayatta kaldın. ${best}` };
  }

  dispose() {
    this.game.player.staminaMult = 1;
  }
}
