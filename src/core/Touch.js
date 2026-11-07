import { settings } from './Settings.js';

// Tablet ve telefon için dokunmatik kontroller:
// sol yarıda sanal çubuk (hareket), sağda kaydırarak bakış, sağ altta butonlar.
const LOOK_RAD_PER_PX = 0.0048;
const STICK_R = 56;

// Parmak bölgeden çıksa da olayları almaya devam et
function capture(el, id) {
  try {
    el.setPointerCapture(id);
  } catch {
    // bazı tarayıcılar yapay olaylarda izin vermez
  }
}

export function isTouchDevice() {
  return typeof window !== 'undefined' && (('ontouchstart' in window) || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches));
}

// Çubuk kaydırması → hareket (-1..1); kenara yakın tam itiş koşu sayılır
export function stickVector(dx, dy, radius = STICK_R) {
  const len = Math.hypot(dx, dy);
  if (len < radius * 0.12) return { x: 0, y: 0, sprint: false };
  const k = Math.min(1, len / radius);
  return { x: (dx / len) * k, y: (-dy / len) * k, sprint: len > radius * 1.15 };
}

const BUTTONS = [
  // [id, yazı, sınıflar] — sınıflar hangi durumda göründüğünü belirler
  ['fire', 'ATEŞ', 'big foot drive'],
  ['aim', 'NİŞAN', 'foot'],
  ['jump', 'ZIPLA', 'foot'],
  ['interact', 'E', 'foot drive'],
  ['reload', 'R', 'foot'],
  ['next', 'SİLAH', 'foot'],
  ['flashlight', 'FENER', 'foot'],
  ['detonate', 'C4', 'foot c4'],
  ['eat', 'YE', 'foot drive survival'],
  ['drink', 'İÇ', 'foot drive survival'],
  ['secondary', 'BOMBA', 'drive air'],
  ['up', 'YÜKSEL', 'drive heli'],
  ['down', 'ALÇAL', 'drive heli'],
  ['gas', 'GAZ', 'drive plane'],
  ['brake', 'FREN', 'drive plane'],
];

export class TouchControls {
  constructor(input) {
    this.input = input;
    this.active = false;
    this.held = new Set();
    this.pressed = new Set();
    this.lookDX = 0;
    this.lookDY = 0;
    this.stick = null; // { id, ox, oy, x, y }
    this.lookers = new Map(); // pointerId → { x, y }
    this.aimToggled = false;
    this.slot = -1;
    this.build();
  }

  build() {
    const root = document.createElement('div');
    root.id = 'touch-ui';
    root.innerHTML = `
      <div class="t-zone t-left"></div>
      <div class="t-zone t-right"></div>
      <div class="t-stick"><i></i></div>
      <div class="t-btn t-pause" data-b="pause">II</div>
      <div class="t-buttons">${BUTTONS.map(([id, label, cls]) => `<div class="t-btn ${cls}" data-b="${id}">${label}</div>`).join('')}</div>`;
    document.body.appendChild(root);
    this.root = root;
    this.stickEl = root.querySelector('.t-stick');
    this.knob = this.stickEl.firstElementChild;
    const left = root.querySelector('.t-left');
    const right = root.querySelector('.t-right');
    const opts = { passive: false };

    left.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (this.stick) return;
      capture(left, e.pointerId);
      this.stick = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY };
      this.showStick();
    }, opts);
    left.addEventListener('pointermove', (e) => {
      if (!this.stick || e.pointerId !== this.stick.id) return;
      this.stick.x = e.clientX;
      this.stick.y = e.clientY;
      this.showStick();
    });
    const endStick = (e) => {
      if (!this.stick || e.pointerId !== this.stick.id) return;
      this.stick = null;
      this.stickEl.classList.remove('show');
    };
    left.addEventListener('pointerup', endStick);
    left.addEventListener('pointercancel', endStick);

    // Sağ taraf ve ATEŞ butonu: parmak kaydıkça bakış döner
    const lookStart = (e) => {
      e.preventDefault();
      capture(e.currentTarget, e.pointerId);
      this.lookers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    };
    const lookMove = (e) => {
      const l = this.lookers.get(e.pointerId);
      if (!l) return;
      this.lookDX += e.clientX - l.x;
      this.lookDY += e.clientY - l.y;
      l.x = e.clientX;
      l.y = e.clientY;
    };
    const lookEnd = (e) => this.lookers.delete(e.pointerId);
    right.addEventListener('pointerdown', lookStart, opts);
    right.addEventListener('pointermove', lookMove);
    right.addEventListener('pointerup', lookEnd);
    right.addEventListener('pointercancel', lookEnd);

    for (const btn of root.querySelectorAll('.t-btn')) {
      const id = btn.dataset.b;
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        capture(btn, e.pointerId);
        this.held.add(id);
        this.pressed.add(id);
        btn.classList.add('down');
        if (id === 'aim') this.aimToggled = !this.aimToggled;
        if (id === 'fire') this.lookers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        this.input.rumble(0.1, 0.1, 20);
      }, opts);
      btn.addEventListener('pointermove', (e) => {
        if (id === 'fire') lookMove(e);
      });
      const up = (e) => {
        this.held.delete(id);
        btn.classList.remove('down');
        if (id === 'fire') lookEnd(e);
      };
      btn.addEventListener('pointerup', up);
      btn.addEventListener('pointercancel', up);
    }
    // Uzun basışta seçim, büyüteç ve sağ tık menüsü çıkmasın
    root.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('touchstart', () => this.wake(), { passive: true });
  }

  wake() {
    this.input.lastDevice = 'touch';
    this.active = true;
  }

  showStick() {
    const s = this.stick;
    const el = this.stickEl;
    el.classList.add('show');
    el.style.left = `${s.ox}px`;
    el.style.top = `${s.oy}px`;
    const dx = s.x - s.ox;
    const dy = s.y - s.oy;
    const len = Math.hypot(dx, dy);
    const k = len > STICK_R ? STICK_R / len : 1;
    this.knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
  }

  // Oyunun durumuna göre hangi butonların görüneceği
  setContext(ctx) {
    const r = this.root;
    r.classList.toggle('show', !!ctx.visible);
    r.classList.toggle('driving', !!ctx.vehicle);
    r.classList.toggle('heli', ctx.vehicle === 'heli');
    r.classList.toggle('plane', ctx.vehicle === 'plane');
    r.classList.toggle('air', ctx.vehicle === 'heli' || ctx.vehicle === 'plane');
    r.classList.toggle('survival', !!ctx.survival);
    r.classList.toggle('c4', !!ctx.c4);
    r.classList.toggle('aiming', this.aimToggled);
    if (!ctx.visible) {
      this.stick = null;
      this.stickEl.classList.remove('show');
      this.lookers.clear();
      this.held.clear();
      this.aimToggled = false;
    }
  }

  // Input.update içinde durum nesnesine eklenir
  apply(s) {
    if (!this.active) return;
    const h = this.held;
    const p = this.pressed;
    if (this.stick) {
      const v = stickVector(this.stick.x - this.stick.ox, this.stick.y - this.stick.oy);
      s.moveX = v.x;
      s.moveY = v.y;
      if (v.sprint) s.sprint = true;
    }
    const sens = LOOK_RAD_PER_PX * settings.mouseSens * (this.aimToggled ? 0.5 : 1);
    s.lookX += this.lookDX * sens;
    s.lookY += this.lookDY * sens * (settings.invertY ? -1 : 1);
    s.fire = s.fire || h.has('fire');
    s.mouseFire = s.mouseFire || h.has('fire');
    s.rb = s.rb || h.has('fire');
    s.firePressed = s.firePressed || p.has('fire');
    s.aim = s.aim || this.aimToggled;
    s.jump = s.jump || p.has('jump');
    s.jumpHeld = s.jumpHeld || h.has('jump') || h.has('up');
    s.descendHeld = s.descendHeld || h.has('down');
    s.interact = s.interact || h.has('interact');
    s.interactPressed = s.interactPressed || p.has('interact');
    s.reload = s.reload || p.has('reload');
    s.next = s.next || p.has('next');
    s.flashlight = s.flashlight || p.has('flashlight');
    s.detonate = s.detonate || p.has('detonate');
    s.secondary = s.secondary || p.has('secondary');
    s.eat = s.eat || p.has('eat');
    s.drink = s.drink || p.has('drink');
    s.pause = s.pause || p.has('pause');
    if (h.has('gas') || h.has('brake')) {
      // Uçakta gaz/fren tetik gibi; yönlendirme çubukla
      s.padActive = true;
      s.rt = h.has('gas') ? 1 : 0;
      s.lt = h.has('brake') ? 1 : 0;
    }
    if (this.slot >= 0) s.slot = this.slot;
  }

  endFrame() {
    this.pressed.clear();
    this.lookDX = 0;
    this.lookDY = 0;
    this.slot = -1;
  }
}
