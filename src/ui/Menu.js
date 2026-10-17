import { settings, saveSettings } from '../core/Settings.js';

// Fare, klavye ve oyun koluyla gezilebilen menüler.
// Her ekran .menu-item öğeleri içerir: button | range (data-key) | toggle (data-key)
export class Menu {
  constructor(game) {
    this.game = game;
    this.screens = {};
    for (const el of document.querySelectorAll('.screen')) this.screens[el.id] = el;
    this.current = null;
    this.focus = 0;
    this.backTarget = null;
    this.previous = null;

    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (btn) this.activate(btn);
    });
    for (const el of document.querySelectorAll('input[type=range][data-key]')) {
      el.value = settings[el.dataset.key];
      el.addEventListener('input', () => this.setValue(el.dataset.key, parseFloat(el.value)));
    }
    for (const el of document.querySelectorAll('.toggle[data-key]')) {
      this.renderToggle(el);
    }
    for (const el of document.querySelectorAll('.menu-item')) {
      el.addEventListener('mouseenter', () => {
        const items = this.items();
        const i = items.indexOf(el);
        if (i >= 0) this.setFocus(i);
      });
    }
  }

  items() {
    if (!this.current) return [];
    return [...this.screens[this.current].querySelectorAll('.menu-item')].filter((e) => e.offsetParent !== null);
  }

  open(id, back = null) {
    for (const [k, el] of Object.entries(this.screens)) el.classList.toggle('show', k === id);
    if (id !== this.current) this.previous = this.current;
    this.current = id;
    this.backTarget = back;
    this.setFocus(0);
  }

  close() {
    for (const el of Object.values(this.screens)) el.classList.remove('show');
    this.current = null;
  }

  setFocus(i) {
    const items = this.items();
    if (!items.length) return;
    this.focus = (i + items.length) % items.length;
    items.forEach((el, k) => el.classList.toggle('focused', k === this.focus));
  }

  setValue(key, v) {
    settings[key] = v;
    saveSettings();
    this.game.audio.applySettings();
  }

  renderToggle(el) {
    const on = !!settings[el.dataset.key];
    el.classList.toggle('on', on);
    el.querySelector('.val').textContent = on ? 'AÇIK' : 'KAPALI';
  }

  activate(el) {
    this.game.audio.resume();
    if (el.classList.contains('toggle')) {
      settings[el.dataset.key] = !settings[el.dataset.key];
      saveSettings();
      this.renderToggle(el);
      return;
    }
    const action = el.dataset.action;
    if (action) this.game.menuAction(action);
  }

  adjust(el, dir) {
    if (el.classList.contains('toggle')) {
      this.activate(el);
      return;
    }
    const input = el.querySelector('input[type=range]');
    if (!input) return;
    const step = parseFloat(input.step) || 0.1;
    const v = Math.min(parseFloat(input.max), Math.max(parseFloat(input.min), parseFloat(input.value) + dir * step));
    input.value = v;
    this.setValue(input.dataset.key, v);
  }

  update(s) {
    if (!this.current) return;
    const items = this.items();
    if (s.menuUp) this.setFocus(this.focus - 1);
    if (s.menuDown) this.setFocus(this.focus + 1);
    const el = items[this.focus];
    if (el && s.menuLeft) this.adjust(el, -1);
    if (el && s.menuRight) this.adjust(el, 1);
    if (el && s.confirm) this.activate(el);
    if (s.back && this.backTarget) this.game.menuAction(this.backTarget);
  }
}
