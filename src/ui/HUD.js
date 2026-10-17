import { WEAPONS, SLOTS, THROWABLES } from '../weapons/weaponData.js';
import { glyph } from '../core/Gamepad.js';
import { angleDiff, formatTime } from '../core/math.js';

const SLOT_LABELS = ['Levye', 'Tabanca', 'Pompalı', 'Makineli', 'Roket', 'Bomba', 'TNT', 'C4'];
const $ = (id) => document.getElementById(id);

export class HUD {
  constructor() {
    this.root = $('hud');
    this.el = {
      health: $('health-fill'), healthText: $('health-text'),
      armor: $('armor-fill'), armorText: $('armor-text'),
      stamina: $('stamina-fill'),
      weapon: $('weapon-name'), ammo: $('ammo'),
      slots: $('slots'), objective: $('objective'), gas: $('gas-count'),
      time: $('time-label'), kills: $('kill-count'),
      prompt: $('prompt'), promptKey: $('prompt-key'), promptText: $('prompt-text'), promptBar: $('prompt-bar'),
      compass: $('compass-strip'), toasts: $('toasts'), hurt: $('hurt'), hurtDir: $('hurt-dir'),
      crosshair: $('crosshair'), hitmarker: $('hitmarker'), banner: $('banner'), flash: $('flashlight-state'),
      lowhp: $('lowhp'),
    };
    this.slotEls = SLOTS.map((_, i) => {
      const d = document.createElement('div');
      d.className = 'slot';
      d.innerHTML = `<span class="slot-key">${i + 1}</span><span class="slot-name">${SLOT_LABELS[i]}</span><span class="slot-count"></span>`;
      this.el.slots.appendChild(d);
      return d;
    });
    this.cache = {};
    this.hitTimer = 0;
    this.bannerTimer = 0;
    this.compassMarkers = new Map();
    // Pusula yön harfleri
    for (const [label, yaw] of [['K', 0], ['B', Math.PI / 2], ['G', Math.PI], ['D', -Math.PI / 2]]) {
      const m = document.createElement('div');
      m.className = 'compass-dir';
      m.textContent = label;
      this.el.compass.appendChild(m);
      this.compassMarkers.set('dir-' + label, { el: m, yaw });
    }
  }

  set(key, el, prop, value) {
    if (this.cache[key] === value) return;
    this.cache[key] = value;
    el[prop] = value;
  }

  show(on) {
    this.root.classList.toggle('hidden', !on);
  }

  toast(text) {
    const d = document.createElement('div');
    d.className = 'toast';
    d.textContent = text;
    this.el.toasts.appendChild(d);
    while (this.el.toasts.children.length > 4) this.el.toasts.firstChild.remove();
    setTimeout(() => d.classList.add('fade'), 2200);
    setTimeout(() => d.remove(), 2800);
  }

  banner(text, seconds = 3) {
    this.el.banner.textContent = text;
    this.el.banner.classList.add('show');
    this.bannerTimer = seconds;
  }

  hitMarker(kill) {
    this.el.hitmarker.classList.toggle('kill', kill);
    this.el.hitmarker.classList.add('show');
    this.hitTimer = kill ? 0.25 : 0.12;
  }

  compassMarker(key, label, cls) {
    let m = this.compassMarkers.get(key);
    if (!m) {
      const el = document.createElement('div');
      el.className = 'compass-mark ' + cls;
      el.innerHTML = `<b>${label}</b><small></small>`;
      this.el.compass.appendChild(el);
      m = { el, yaw: 0, dist: el.querySelector('small') };
      this.compassMarkers.set(key, m);
    }
    return m;
  }

  removeMarker(key) {
    const m = this.compassMarkers.get(key);
    if (m) {
      m.el.remove();
      this.compassMarkers.delete(key);
    }
  }

  update(dt, g) {
    const p = g.player;
    const inv = g.inventory;
    const dev = g.input.lastDevice;
    const ps = g.input.ps;

    this.set('hp', this.el.health.style, 'width', `${p.health}%`);
    this.set('hpt', this.el.healthText, 'textContent', String(Math.ceil(p.health)));
    this.set('ar', this.el.armor.style, 'width', `${p.armor}%`);
    this.set('art', this.el.armorText, 'textContent', String(Math.ceil(p.armor)));
    this.set('st', this.el.stamina.style, 'width', `${p.stamina * 100}%`);
    this.el.lowhp.style.opacity = p.health < 30 && p.alive ? String(0.4 + Math.sin(performance.now() / 200) * 0.2) : '0';

    // Silah ve mermi
    const id = inv.activeId;
    let wname = WEAPONS[id].name;
    let ammo = '';
    if (inv.mag[id] !== undefined) {
      ammo = `${inv.mag[id]} / ${inv.reserve[id]}`;
      if (g.weapons.reloading > 0) ammo = 'Dolduruluyor...';
    } else if (id === 'throwable') {
      wname = THROWABLES[inv.throwKind].name;
      ammo = `× ${inv.counts[inv.throwKind]}`;
      if (inv.counts.grenade > 0 && inv.counts.head > 0) wname += ' (6: değiştir)';
    } else if (id === 'tnt' || id === 'c4') {
      ammo = `× ${inv.counts[id]}`;
      if (id === 'c4' && g.explosives.c4Count > 0) ammo += `  (${g.explosives.c4Count} kurulu)`;
    } else ammo = '∞';
    this.set('wn', this.el.weapon, 'textContent', wname);
    this.set('am', this.el.ammo, 'textContent', ammo);

    // Eşya çubuğu
    for (let i = 0; i < SLOTS.length; i++) {
      const el = this.slotEls[i];
      const has = inv.hasSlot(i);
      const state = `${has}-${i === inv.active}`;
      if (el.dataset.state !== state) {
        el.dataset.state = state;
        el.classList.toggle('empty', !has);
        el.classList.toggle('active', i === inv.active);
      }
      const sid = SLOTS[i];
      let c = '';
      if (sid === 'throwable') c = inv.counts.grenade + inv.counts.head || '';
      else if (inv.counts[sid] !== undefined) c = inv.counts[sid] || '';
      else if (inv.mag[sid] !== undefined && has) c = inv.mag[sid] + inv.reserve[sid];
      const cel = el.lastChild;
      if (cel.textContent !== String(c)) cel.textContent = c;
    }
    this.el.slots.classList.toggle('pad', dev === 'pad');

    // Görev
    const delivered = g.gasDelivered;
    let obj;
    if (delivered >= 5) obj = 'Depo dolu! Arabaya bin ve KAÇ!';
    else if (p.carryingGas) obj = 'Benzini arabaya götür';
    else obj = 'Benzin bidonlarını bul (pusulada kırmızı)';
    this.set('obj', this.el.objective, 'textContent', obj);
    this.set('gas', this.el.gas, 'textContent', `${delivered} / 5`);

    const info = g.dayNight.phaseInfo();
    this.set('time', this.el.time, 'textContent', `${info.icon} ${info.label} · ${formatTime(info.remaining)}`);
    this.set('kills', this.el.kills, 'textContent', `☠ ${g.stats.kills}`);
    this.set('fl', this.el.flash, 'textContent', p.flashOn ? `Fener: AÇIK [${glyph('flashlight', dev, ps)}]` : `Fener: KAPALI [${glyph('flashlight', dev, ps)}]`);

    // Etkileşim ipucu
    const pr = g.prompt;
    if (pr) {
      this.el.prompt.classList.add('show');
      this.set('pk', this.el.promptKey, 'textContent', glyph('interact', dev, ps) + (pr.hold ? ' basılı tut' : ''));
      this.set('pt', this.el.promptText, 'textContent', pr.text);
      this.el.promptBar.style.width = `${(pr.progress || 0) * 100}%`;
    } else {
      this.el.prompt.classList.remove('show');
    }

    // Hasar efekti ve yönü
    this.el.hurt.style.opacity = String(p.hurt * 0.8);
    this.el.hurtDir.style.opacity = String(Math.min(1, p.hurt * 1.5));
    this.el.hurtDir.style.transform = `translate(-50%, -50%) rotate(${-p.hurtDir}rad)`;

    // Nişangah
    this.hitTimer -= dt;
    if (this.hitTimer <= 0) this.el.hitmarker.classList.remove('show');
    const spread = 1 + p.speed * 0.6 + (p.onGround ? 0 : 6) - g.weapons.aim * 4;
    this.el.crosshair.style.setProperty('--gap', `${Math.max(3, 6 + spread)}px`);
    this.el.crosshair.classList.toggle('melee', id === 'crowbar');

    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) this.el.banner.classList.remove('show');
    }

    this.updateCompass(g);
  }

  updateCompass(g) {
    const p = g.player;
    const W = this.el.compass.clientWidth || 420;
    const place = (m, targetYaw) => {
      const rel = angleDiff(p.yaw, targetYaw);
      const x = W / 2 - (rel / (Math.PI / 2)) * (W / 2);
      const vis = Math.abs(rel) < Math.PI / 2;
      m.el.style.display = vis ? '' : 'none';
      if (vis) m.el.style.transform = `translateX(${x.toFixed(1)}px)`;
    };
    for (const [key, m] of this.compassMarkers) {
      if (key.startsWith('dir-')) place(m, m.yaw);
    }
    const target = (key, x, z, label, cls) => {
      const m = this.compassMarker(key, label, cls);
      const dx = x - p.pos.x;
      const dz = z - p.pos.z;
      place(m, Math.atan2(-dx, -dz));
      const d = Math.round(Math.hypot(dx, dz));
      if (m.dist.textContent !== `${d}m`) m.dist.textContent = `${d}m`;
    };
    target('car', g.world.car.pos.x, g.world.car.pos.z, 'ARABA', 'car');
    const gasPickups = g.pickups.list.filter((pk) => pk.type === 'gas');
    const live = new Set();
    if (!p.carryingGas) {
      for (const pk of gasPickups) {
        const key = 'gas-' + pk.spot;
        live.add(key);
        target(key, pk.pos.x, pk.pos.z, 'BENZİN', 'gas');
      }
    }
    for (const key of [...this.compassMarkers.keys()]) {
      if (key.startsWith('gas-') && !live.has(key)) this.removeMarker(key);
    }
  }
}
