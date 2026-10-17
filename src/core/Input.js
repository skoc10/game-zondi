import { BTN, getActivePad, readPad, lookCurve, rumble, isPlayStation } from './Gamepad.js';
import { settings } from './Settings.js';

const MOUSE_RAD_PER_PX = 0.0022;
const PAD_LOOK_SPEED = 3.2; // rad/s, tam çubukta

// Klavye/fare ve oyun kolunu tek bir "eylem" durumunda birleştirir.
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.keysPressed = new Set();
    this.mouseButtons = new Set();
    this.mousePressed = new Set();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.wheel = 0;
    this.locked = false;
    this.lastDevice = 'kbm';
    this.pad = null;
    this.padState = null;
    this.prevPadButtons = [];
    this.ps = false;
    this.onLockChange = null;
    this.state = this.emptyState();

    window.addEventListener('keydown', (e) => {
      if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'AltLeft'].includes(e.code)) e.preventDefault();
      if (!this.keys.has(e.code)) this.keysPressed.add(e.code);
      this.keys.add(e.code);
      this.lastDevice = 'kbm';
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.mouseButtons.clear();
    });
    window.addEventListener('mousedown', (e) => {
      if (!this.locked) return;
      // Fare yan tuşları tarayıcıda "geri" yapmasın
      if (e.button > 2) e.preventDefault();
      this.mouseButtons.add(e.button);
      this.mousePressed.add(e.button);
      this.lastDevice = 'kbm';
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button > 2) e.preventDefault();
      this.mouseButtons.delete(e.button);
    });
    window.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.mouseDX += e.movementX || 0;
      this.mouseDY += e.movementY || 0;
      if (Math.abs(e.movementX) + Math.abs(e.movementY) > 2) this.lastDevice = 'kbm';
    });
    window.addEventListener('wheel', (e) => {
      if (this.locked) this.wheel += Math.sign(e.deltaY);
    }, { passive: true });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.canvas;
      if (this.onLockChange) this.onLockChange(this.locked);
    });
  }

  requestLock() {
    if (this.locked || !this.canvas.requestPointerLock) return;
    try {
      const p = this.canvas.requestPointerLock();
      if (p && p.catch) p.catch(() => {});
    } catch {
      // Bazı tarayıcılar kullanıcı hareketi olmadan reddeder
    }
  }

  exitLock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  emptyState() {
    return {
      moveX: 0, moveY: 0, lookX: 0, lookY: 0,
      fire: false, firePressed: false, aim: false, sprint: false,
      interact: false, interactPressed: false,
      jump: false, reload: false, flashlight: false,
      next: false, prev: false, slot: -1, detonate: false, pause: false,
      menuUp: false, menuDown: false, menuLeft: false, menuRight: false,
      confirm: false, back: false,
      // Araç kontrolleri
      mouseFire: false, secondary: false, jumpHeld: false, descendHeld: false,
      rt: 0, lt: 0, rb: false, padActive: false,
    };
  }

  padPressed(i) {
    return !!(this.padState && this.padState.buttons[i] && !this.prevPadButtons[i]);
  }

  update(dt) {
    const s = this.emptyState();
    const k = this.keys;
    const kp = this.keysPressed;

    // Klavye / fare
    s.moveX = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0);
    s.moveY = (k.has('KeyW') ? 1 : 0) - (k.has('KeyS') ? 1 : 0);
    // Sağ tık basılıyken nişan: hassasiyet düşer
    // Nişan tuşu ayarlanabilir (sağ tık, Z, V, X, Alt, fare yan tuşu)
    const key = settings.aimKey || 'mouse2';
    const mouseBtn = key === 'mouse2' ? 2 : key === 'mouse3' ? 3 : -1;
    const aimDown = mouseBtn >= 0 ? this.mouseButtons.has(mouseBtn) : k.has(key);
    const aimPress = mouseBtn >= 0 ? this.mousePressed.has(mouseBtn) : kp.has(key);
    // Aç/kapa ayarında her basış nişanı değiştirir (touchpad için)
    if (settings.aimToggle && aimPress) this.aimToggled = !this.aimToggled;
    if (!this.locked) this.aimToggled = false;
    const aimHeld = settings.aimToggle ? !!this.aimToggled : aimDown;
    const sens = MOUSE_RAD_PER_PX * settings.mouseSens * (aimHeld ? 0.5 : 1);
    s.aim = aimHeld;
    s.lookX = this.mouseDX * sens;
    s.lookY = this.mouseDY * sens * (settings.invertY ? -1 : 1);
    s.fire = this.mouseButtons.has(0);
    s.mouseFire = s.fire;
    s.secondary = this.mousePressed.has(2);
    s.jumpHeld = k.has('Space');
    s.descendHeld = k.has('KeyC') || k.has('ControlLeft') || k.has('ControlRight');
    s.firePressed = this.mousePressed.has(0);
    s.sprint = k.has('ShiftLeft') || k.has('ShiftRight');
    s.interact = k.has('KeyE');
    s.interactPressed = kp.has('KeyE');
    s.jump = kp.has('Space');
    s.reload = kp.has('KeyR');
    s.flashlight = kp.has('KeyF');
    s.detonate = kp.has('KeyG');
    s.pause = kp.has('Escape') || kp.has('KeyP');
    s.next = this.wheel > 0 || kp.has('KeyQ');
    s.prev = this.wheel < 0;
    for (let i = 1; i <= 9; i++) if (kp.has('Digit' + i)) s.slot = i - 1;
    s.menuUp = kp.has('ArrowUp') || kp.has('KeyW');
    s.menuDown = kp.has('ArrowDown') || kp.has('KeyS');
    s.menuLeft = kp.has('ArrowLeft') || kp.has('KeyA');
    s.menuRight = kp.has('ArrowRight') || kp.has('KeyD');
    s.confirm = kp.has('Enter') || kp.has('Space');
    s.back = kp.has('Escape') || kp.has('Backspace');

    // Oyun kolu
    this.pad = getActivePad();
    this.padState = this.pad ? readPad(this.pad) : null;
    const p = this.padState;
    if (p) {
      this.ps = isPlayStation(this.pad);
      if (p.active) this.lastDevice = 'pad';
      const B = p.buttons;
      if (p.lx || p.ly) {
        s.moveX = p.lx;
        s.moveY = -p.ly;
      }
      const ps = PAD_LOOK_SPEED * settings.padSens * (B[BTN.LT] ? 0.55 : 1);
      s.lookX += lookCurve(p.rx) * ps * dt;
      s.lookY += lookCurve(p.ry) * ps * dt * (settings.invertY ? -1 : 1);
      s.fire = s.fire || B[BTN.RT];
      s.rt = p.rt > 0.08 ? p.rt : 0;
      s.lt = p.lt > 0.08 ? p.lt : 0;
      s.rb = B[BTN.RB];
      s.secondary = s.secondary || this.padPressed(BTN.LB);
      s.jumpHeld = s.jumpHeld || B[BTN.A];
      s.padActive = this.lastDevice === 'pad';
      s.firePressed = s.firePressed || this.padPressed(BTN.RT);
      s.aim = s.aim || B[BTN.LT];
      s.sprint = s.sprint || B[BTN.L3] || this.padSprint;
      s.interact = s.interact || B[BTN.X];
      s.interactPressed = s.interactPressed || this.padPressed(BTN.X);
      s.jump = s.jump || this.padPressed(BTN.A);
      s.reload = s.reload || this.padPressed(BTN.B);
      s.flashlight = s.flashlight || this.padPressed(BTN.Y);
      s.next = s.next || this.padPressed(BTN.RB);
      s.prev = s.prev || this.padPressed(BTN.LB);
      s.detonate = s.detonate || this.padPressed(BTN.UP);
      s.pause = s.pause || this.padPressed(BTN.START);
      // Menü gezintisi: D-pad veya sol çubuk (kenar algılama ile)
      const stickUp = p.ly < -0.6;
      const stickDown = p.ly > 0.6;
      const stickLeft = p.lx < -0.6;
      const stickRight = p.lx > 0.6;
      s.menuUp = s.menuUp || this.padPressed(BTN.UP) || (stickUp && !this.prevStick?.up);
      s.menuDown = s.menuDown || this.padPressed(BTN.DOWN) || (stickDown && !this.prevStick?.down);
      s.menuLeft = s.menuLeft || this.padPressed(BTN.LEFT) || (stickLeft && !this.prevStick?.left);
      s.menuRight = s.menuRight || this.padPressed(BTN.RIGHT) || (stickRight && !this.prevStick?.right);
      s.confirm = s.confirm || this.padPressed(BTN.A);
      s.back = s.back || this.padPressed(BTN.B);
      this.prevStick = { up: stickUp, down: stickDown, left: stickLeft, right: stickRight };
      // L3 bir kez basınca koşu açılır, çubuk bırakılınca kapanır
      if (this.padPressed(BTN.L3)) this.padSprint = true;
      if (Math.hypot(p.lx, p.ly) < 0.3) this.padSprint = false;
    }

    // Çapraz harekette hız artmasın
    const m = Math.hypot(s.moveX, s.moveY);
    if (m > 1) {
      s.moveX /= m;
      s.moveY /= m;
    }
    this.state = s;
    return s;
  }

  endFrame() {
    this.keysPressed.clear();
    this.mousePressed.clear();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.wheel = 0;
    this.prevPadButtons = this.padState ? this.padState.buttons.slice() : [];
  }

  rumble(strong, weak, ms) {
    if (settings.vibration && this.pad) rumble(this.pad, strong, weak, ms);
  }
}
