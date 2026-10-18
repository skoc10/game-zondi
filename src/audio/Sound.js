import { buildEngine } from './engines.js';
import { settings } from '../core/Settings.js';

// Tüm sesler WebAudio ile kodla üretilir (dosya yok).
export class Sound {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.listener = { x: 0, z: 0, yaw: 0 };
    this.night = 0;
    this.nextNote = 0;
    this.step = 0;
    this.pourNode = null;
  }

  ensure() {
    if (this.ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = settings.volume;
    this.master.connect(this.ctx.destination);
    this.sfx = this.ctx.createGain();
    this.sfx.connect(this.master);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = settings.music * 0.35;
    this.musicGain.connect(this.master);
    const len = this.ctx.sampleRate * 2;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }

  resume() {
    if (!this.ensure()) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  get ready() {
    return this.ctx && this.ctx.state === 'running';
  }

  applySettings() {
    if (!this.ctx) return;
    this.master.gain.value = settings.volume;
    this.musicGain.gain.value = settings.music * 0.35;
  }

  setListener(x, z, yaw) {
    this.listener.x = x;
    this.listener.z = z;
    this.listener.yaw = yaw;
  }

  // Konuma göre ses seviyesi ve stereo yön
  spatial(pos, maxDist = 60) {
    if (!pos) return { gain: 1, pan: 0 };
    const dx = pos.x - this.listener.x;
    const dz = pos.z - this.listener.z;
    const dist = Math.hypot(dx, dz);
    const gain = Math.max(0, 1 - dist / maxDist) ** 1.5;
    // Dinleyicinin sağ vektörü: (cos yaw, -sin yaw)
    const rx = Math.cos(this.listener.yaw);
    const rz = -Math.sin(this.listener.yaw);
    const pan = dist > 0.01 ? Math.max(-1, Math.min(1, (dx * rx + dz * rz) / dist)) : 0;
    return { gain, pan };
  }

  out(pos, maxDist, vol = 1) {
    const { gain, pan } = this.spatial(pos, maxDist);
    if (gain * vol < 0.01) return null;
    const g = this.ctx.createGain();
    g.gain.value = gain * vol;
    const p = this.ctx.createStereoPanner();
    p.pan.value = pan * 0.8;
    g.connect(p);
    p.connect(this.sfx);
    return g;
  }

  noiseBurst(dest, { dur = 0.2, type = 'lowpass', freq = 2000, freqEnd = null, q = 1, vol = 1, attack = 0.002 }) {
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(dest);
    src.start(t, Math.random() * 1.5);
    src.stop(t + dur + 0.05);
  }

  tone(dest, { type = 'sine', freq = 440, freqEnd = null, dur = 0.2, vol = 0.5, attack = 0.005, delay = 0 }) {
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(dest);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  play(name, pos = null, vol = 1, pitch = 1) {
    if (!this.ready) return;
    const d = this.out(pos, name === 'explosion' ? 160 : 70, vol);
    if (!d) return;
    switch (name) {
      case 'pistol':
        this.noiseBurst(d, { dur: 0.18, freq: 3000, freqEnd: 400, vol: 0.9 });
        this.tone(d, { type: 'square', freq: 180, freqEnd: 60, dur: 0.08, vol: 0.3 });
        break;
      case 'shotgun':
        this.noiseBurst(d, { dur: 0.4, freq: 2200, freqEnd: 200, vol: 1.2 });
        this.tone(d, { type: 'sawtooth', freq: 120, freqEnd: 40, dur: 0.2, vol: 0.5 });
        this.noiseBurst(d, { dur: 0.08, type: 'highpass', freq: 2500, vol: 0.25, attack: 0.001 });
        break;
      case 'smg':
        this.noiseBurst(d, { dur: 0.1, freq: 3500, freqEnd: 600, vol: 0.7 });
        this.tone(d, { type: 'square', freq: 220, freqEnd: 90, dur: 0.05, vol: 0.2 });
        break;
      case 'rocket':
        this.noiseBurst(d, { dur: 0.7, type: 'bandpass', freq: 800, freqEnd: 300, q: 0.7, vol: 0.9, attack: 0.02 });
        break;
      case 'enemyShot':
        this.noiseBurst(d, { dur: 0.2, freq: 1800, freqEnd: 300, vol: 0.7 });
        break;
      case 'explosion':
        this.noiseBurst(d, { dur: 1.6, freq: 1200, freqEnd: 60, vol: 1.6, attack: 0.005 });
        this.tone(d, { type: 'sine', freq: 90, freqEnd: 25, dur: 0.9, vol: 1.2 });
        this.noiseBurst(d, { dur: 0.15, type: 'highpass', freq: 1500, vol: 0.4 });
        break;
      case 'cannon':
        this.noiseBurst(d, { dur: 1.0, freq: 900, freqEnd: 80, vol: 1.5 });
        this.tone(d, { type: 'sine', freq: 70, freqEnd: 30, dur: 0.6, vol: 1.2 });
        break;
      case 'swing':
        this.noiseBurst(d, { dur: 0.18, type: 'bandpass', freq: 600, freqEnd: 1800, q: 1.5, vol: 0.35, attack: 0.04 });
        break;
      case 'clank':
        this.tone(d, { type: 'triangle', freq: 900, freqEnd: 700, dur: 0.25, vol: 0.4 });
        this.tone(d, { type: 'triangle', freq: 1420, dur: 0.18, vol: 0.2 });
        break;
      case 'hit':
        this.noiseBurst(d, { dur: 0.12, freq: 900, freqEnd: 200, vol: 0.6 });
        break;
      case 'headshot':
        this.noiseBurst(d, { dur: 0.25, freq: 1400, freqEnd: 150, vol: 0.8 });
        this.tone(d, { type: 'sine', freq: 1200, dur: 0.08, vol: 0.25 });
        break;
      case 'wood':
        this.noiseBurst(d, { dur: 0.3, type: 'bandpass', freq: 500, q: 2, vol: 0.9 });
        this.tone(d, { type: 'square', freq: 140, freqEnd: 80, dur: 0.12, vol: 0.2 });
        break;
      case 'empty':
        this.tone(d, { type: 'square', freq: 1500, dur: 0.03, vol: 0.15 });
        break;
      case 'reload':
        this.tone(d, { type: 'square', freq: 800, dur: 0.04, vol: 0.15 });
        this.tone(d, { type: 'square', freq: 500, dur: 0.05, vol: 0.15, delay: 0.25 });
        this.tone(d, { type: 'square', freq: 1100, dur: 0.04, vol: 0.15, delay: 0.5 });
        break;
      case 'pickup':
        this.tone(d, { type: 'triangle', freq: 660, dur: 0.08, vol: 0.3 });
        this.tone(d, { type: 'triangle', freq: 990, dur: 0.12, vol: 0.3, delay: 0.07 });
        break;
      case 'gas':
        this.tone(d, { type: 'triangle', freq: 440, dur: 0.1, vol: 0.3 });
        this.tone(d, { type: 'triangle', freq: 660, dur: 0.1, vol: 0.3, delay: 0.1 });
        this.tone(d, { type: 'triangle', freq: 880, dur: 0.2, vol: 0.3, delay: 0.2 });
        break;
      case 'throw':
        this.noiseBurst(d, { dur: 0.2, type: 'bandpass', freq: 900, freqEnd: 400, q: 1.2, vol: 0.3, attack: 0.03 });
        break;
      case 'beep':
        this.tone(d, { type: 'square', freq: 1800, dur: 0.06, vol: 0.12 });
        break;
      case 'fuse':
        this.noiseBurst(d, { dur: 0.3, type: 'highpass', freq: 4000, vol: 0.15 });
        break;
      case 'hurt':
        this.tone(d, { type: 'sawtooth', freq: 220, freqEnd: 110, dur: 0.25, vol: 0.35 });
        this.noiseBurst(d, { dur: 0.15, freq: 700, vol: 0.4 });
        break;
      case 'step':
        this.noiseBurst(d, { dur: 0.08, freq: 400, vol: 0.12 });
        break;
      case 'jump':
        this.noiseBurst(d, { dur: 0.1, freq: 500, vol: 0.12 });
        break;
      case 'groan': {
        const base = pitch;
        const t = this.ctx.currentTime;
        const o = this.ctx.createOscillator();
        o.type = 'sawtooth';
        const f0 = (70 + Math.random() * 40) * base;
        o.frequency.setValueAtTime(f0, t);
        o.frequency.linearRampToValueAtTime(f0 * (0.7 + Math.random() * 0.2), t + 0.9);
        const lfo = this.ctx.createOscillator();
        lfo.frequency.value = 5 + Math.random() * 4;
        const lg = this.ctx.createGain();
        lg.gain.value = 8 * base;
        lfo.connect(lg);
        lg.connect(o.frequency);
        const f = this.ctx.createBiquadFilter();
        f.type = 'bandpass';
        f.frequency.value = 500 * base;
        f.Q.value = 2;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.5, t + 0.15);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 1);
        o.connect(f);
        f.connect(g);
        g.connect(d);
        o.start(t);
        lfo.start(t);
        o.stop(t + 1.05);
        lfo.stop(t + 1.05);
        break;
      }
      case 'roar': {
        // Fark etme kükremesi: hızla yükselip düşen hırıltılı çığlık
        const t = this.ctx.currentTime;
        const o = this.ctx.createOscillator();
        o.type = 'sawtooth';
        const f0 = (120 + Math.random() * 40) * pitch;
        o.frequency.setValueAtTime(f0, t);
        o.frequency.exponentialRampToValueAtTime(f0 * 2.2, t + 0.18);
        o.frequency.exponentialRampToValueAtTime(f0 * 0.8, t + 0.8);
        const lfo = this.ctx.createOscillator();
        lfo.frequency.value = 28;
        const lg = this.ctx.createGain();
        lg.gain.value = 25 * pitch;
        lfo.connect(lg);
        lg.connect(o.frequency);
        const f = this.ctx.createBiquadFilter();
        f.type = 'bandpass';
        f.frequency.value = 900 * pitch;
        f.Q.value = 1.2;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.8, t + 0.06);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
        o.connect(f);
        f.connect(g);
        g.connect(d);
        o.start(t);
        lfo.start(t);
        o.stop(t + 0.95);
        lfo.stop(t + 0.95);
        this.noiseBurst(d, { dur: 0.6, type: 'bandpass', freq: 1400 * pitch, q: 1.5, vol: 0.35, attack: 0.03 });
        break;
      }
      case 'laser':
        this.tone(d, { type: 'sawtooth', freq: 1800, freqEnd: 300, dur: 0.14, vol: 0.35 });
        this.tone(d, { type: 'square', freq: 900, freqEnd: 200, dur: 0.1, vol: 0.15 });
        break;
      case 'deer':
        // Ürken geyiğin kısa böğürmesi
        this.tone(d, { type: 'sawtooth', freq: 700 * pitch, freqEnd: 380 * pitch, dur: 0.35, vol: 0.25, attack: 0.02 });
        this.noiseBurst(d, { dur: 0.2, type: 'bandpass', freq: 1200, q: 1.5, vol: 0.15 });
        break;
      case 'hooves':
        for (let i = 0; i < 4; i++) this.noiseBurst(d, { dur: 0.05, type: 'bandpass', freq: 300 + i * 40, q: 2, vol: 0.35, delay: i * 0.09 });
        break;
      case 'drink':
        for (let i = 0; i < 3; i++) this.tone(d, { type: 'sine', freq: 380 * pitch + i * 40, freqEnd: 220 * pitch, dur: 0.12, vol: 0.3, delay: i * 0.22 });
        break;
      case 'eat':
        for (let i = 0; i < 4; i++) this.noiseBurst(d, { dur: 0.08, type: 'bandpass', freq: 900, q: 1.2, vol: 0.35, delay: i * 0.16 });
        break;
      case 'sizzle':
        this.noiseBurst(d, { dur: 0.9, type: 'highpass', freq: 3500, vol: 0.3, attack: 0.05 });
        break;
      case 'growl':
        this.tone(d, { type: 'sawtooth', freq: 90, freqEnd: 60, dur: 0.6, vol: 0.25, attack: 0.1 });
        this.tone(d, { type: 'sine', freq: 140, freqEnd: 80, dur: 0.5, vol: 0.2, delay: 0.3 });
        break;
      case 'siren':
        this.tone(d, { type: 'sawtooth', freq: 500, freqEnd: 950, dur: 0.6, vol: 0.25, attack: 0.05 });
        this.tone(d, { type: 'sawtooth', freq: 950, freqEnd: 500, dur: 0.6, vol: 0.25, delay: 0.6 });
        break;
      case 'shield':
        this.tone(d, { type: 'sine', freq: 300, freqEnd: 900, dur: 0.18, vol: 0.3 });
        this.noiseBurst(d, { dur: 0.15, type: 'highpass', freq: 3000, vol: 0.2 });
        break;
      case 'glass':
        this.noiseBurst(d, { dur: 0.25, type: 'highpass', freq: 3500, vol: 0.6 });
        this.tone(d, { type: 'triangle', freq: 2400, dur: 0.12, vol: 0.2 });
        break;
      case 'nuke':
        this.noiseBurst(d, { dur: 4, freq: 900, freqEnd: 40, vol: 2, attack: 0.01 });
        this.tone(d, { type: 'sine', freq: 60, freqEnd: 18, dur: 3.5, vol: 1.6 });
        break;
      case 'alien':
        this.tone(d, { type: 'sine', freq: 900 * pitch, freqEnd: 1600 * pitch, dur: 0.25, vol: 0.3 });
        this.tone(d, { type: 'triangle', freq: 1500 * pitch, freqEnd: 700 * pitch, dur: 0.3, vol: 0.25, delay: 0.2 });
        break;
      case 'launch':
        this.noiseBurst(d, { dur: 7, freq: 600, freqEnd: 120, vol: 1.6, attack: 0.8 });
        this.tone(d, { type: 'sawtooth', freq: 40, freqEnd: 90, dur: 6.5, vol: 0.8, attack: 0.5 });
        break;
      case 'door':
        this.tone(d, { type: 'sine', freq: 400, freqEnd: 1200, dur: 0.35, vol: 0.3 });
        this.noiseBurst(d, { dur: 0.4, type: 'bandpass', freq: 800, q: 1, vol: 0.3, attack: 0.05 });
        break;
      case 'radio':
        this.noiseBurst(d, { dur: 0.35, type: 'bandpass', freq: 2200, q: 0.8, vol: 0.35, attack: 0.01 });
        this.tone(d, { type: 'square', freq: 1400, dur: 0.07, vol: 0.12, delay: 0.32 });
        break;
      case 'child': {
        // Kısa, tiz hıçkırık/imdat tonu
        const f = 520 * pitch;
        this.tone(d, { type: 'triangle', freq: f, freqEnd: f * 1.25, dur: 0.18, vol: 0.35 });
        this.tone(d, { type: 'triangle', freq: f * 1.2, freqEnd: f * 0.8, dur: 0.35, vol: 0.3, delay: 0.2 });
        break;
      }
      case 'turret':
        this.noiseBurst(d, { dur: 0.09, freq: 4000, freqEnd: 900, vol: 0.6 });
        this.tone(d, { type: 'square', freq: 300, freqEnd: 120, dur: 0.05, vol: 0.2 });
        break;
      case 'bite':
        this.noiseBurst(d, { dur: 0.22, type: 'bandpass', freq: 500 * pitch, q: 2, vol: 0.8 });
        this.tone(d, { type: 'sawtooth', freq: 90 * pitch, freqEnd: 60 * pitch, dur: 0.25, vol: 0.4 });
        break;
      case 'engine': {
        const t = this.ctx.currentTime;
        const o = this.ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(40, t);
        o.frequency.exponentialRampToValueAtTime(140, t + 3);
        const f = this.ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 600;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.6, t + 0.3);
        g.gain.setValueAtTime(0.6, t + 3);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 4);
        o.connect(f);
        f.connect(g);
        g.connect(d);
        o.start(t);
        o.stop(t + 4.1);
        break;
      }
      default:
        break;
    }
  }

  startEngine(kind) {
    this.stopEngine();
    if (!this.ready) {
      this.pendingEngine = kind;
      return;
    }
    this.engine = { kind, ...buildEngine(this.ctx, this.sfx, kind, this.noise) };
  }

  // rpm 0..1 (devir), speedFrac 0..1
  setEngine(rpm, speedFrac = 0, running = true) {
    if (!this.engine && this.pendingEngine && this.ready) this.startEngine(this.pendingEngine);
    const e = this.engine;
    if (!e) return;
    const vol = e.update(rpm, speedFrac);
    e.out.gain.setTargetAtTime(running ? vol : 0, this.ctx.currentTime, 0.1);
  }

  stopEngine() {
    this.pendingEngine = null;
    const e = this.engine;
    if (!e) return;
    for (const n of e.nodes) {
      try {
        n.stop();
      } catch {
        // zaten durmuş
      }
    }
    e.out.disconnect();
    this.engine = null;
  }

  // Benzin dökme gurultusu (döngü)
  setPouring(on) {
    if (!this.ready) return;
    if (on && !this.pourNode) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noise;
      src.loop = true;
      const f = this.ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 350;
      f.Q.value = 3;
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = 7;
      const lg = this.ctx.createGain();
      lg.gain.value = 120;
      lfo.connect(lg);
      lg.connect(f.frequency);
      const g = this.ctx.createGain();
      g.gain.value = 0.5;
      src.connect(f);
      f.connect(g);
      g.connect(this.sfx);
      src.start();
      lfo.start();
      this.pourNode = { src, lfo };
    } else if (!on && this.pourNode) {
      this.pourNode.src.stop();
      this.pourNode.lfo.stop();
      this.pourNode = null;
    }
  }

  // Basit prosedürel müzik: gündüz sakin, gece gergin
  updateMusic(night, playing) {
    if (!this.ready) return;
    this.night = night;
    const ctx = this.ctx;
    const look = 0.2;
    while (this.nextNote < ctx.currentTime + look) {
      if (this.nextNote < ctx.currentTime - 0.5) this.nextNote = ctx.currentTime;
      if (playing) this.scheduleStep(this.nextNote, this.step);
      const tempo = night > 0.5 ? 0.22 : 0.42;
      this.nextNote += tempo;
      this.step++;
    }
  }

  scheduleStep(t, step) {
    const ctx = this.ctx;
    const d = this.musicGain;
    const night = this.night > 0.5;
    // A minör ölçek
    const scale = [220, 246.9, 261.6, 293.7, 329.6, 349.2, 392];
    const note = (freq, dur, vol, type = 'triangle') => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g);
      g.connect(d);
      o.start(t);
      o.stop(t + dur + 0.05);
    };
    if (night) {
      if (step % 4 === 0) note(55, 0.35, 0.5, 'sine');
      if (step % 4 === 1) note(55, 0.2, 0.3, 'sine');
      if (step % 2 === 0) note(110 * (step % 16 < 8 ? 1 : 1.06), 0.18, 0.12, 'sawtooth');
      if (step % 8 === 6) note(scale[(step / 8) % 7 | 0] * 2, 0.4, 0.06, 'square');
    } else {
      if (step % 8 === 0) note(110, 2.5, 0.12, 'sine');
      if (step % 2 === 1 && Math.random() < 0.6) note(scale[Math.floor(Math.random() * 7)], 0.8, 0.07);
    }
  }
}
