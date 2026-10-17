// Araç motoru ses grafikleri. Her tür belirgin şekilde farklı:
// motosiklet: tiz, cırlak, hızlı patlama  · cip/pikap: kalın gürleme + vites
// tank: çok kalın uğultu + metalik palet şakırtısı · helikopter: güçlü "vop-vop" + türbin vınlaması
// uçak: pervane vızıltısı + rüzgâr
// ctx: AudioContext ya da OfflineAudioContext. Döner: { out, set(rpm, speedFrac), nodes[] }

function distortionCurve(amount) {
  const n = 1024;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * amount);
  }
  return curve;
}

export function buildEngine(ctx, dest, kind, noiseBuffer) {
  const nodes = [];
  const out = ctx.createGain();
  out.gain.value = 0;
  out.connect(dest);
  const now = () => ctx.currentTime;
  const osc = (type, freq) => {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    o.start();
    nodes.push(o);
    return o;
  };
  const noise = () => {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    src.loop = true;
    src.start(0, Math.random());
    nodes.push(src);
    return src;
  };
  const filter = (type, freq, q = 1) => {
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    return f;
  };
  const gain = (v) => {
    const g = ctx.createGain();
    g.gain.value = v;
    return g;
  };
  // Genlik modülasyonu: src → am → dest; am.gain = (1-depth) + depth·lfo
  const tremolo = (src, dest2, rate, depth, shape = 'sine') => {
    const am = gain(1 - depth);
    const lfo = osc(shape, rate);
    const lg = gain(depth);
    lfo.connect(lg);
    lg.connect(am.gain);
    src.connect(am);
    am.connect(dest2);
    return lfo;
  };
  const shaper = (amount) => {
    const w = ctx.createWaveShaper();
    w.curve = distortionCurve(amount);
    return w;
  };
  const set = (param, v, tc = 0.05) => param.setTargetAtTime(v, now(), tc);

  let update;
  if (kind === 'motorcycle') {
    const a = osc('sawtooth', 110);
    const b = osc('sawtooth', 112);
    const dist = shaper(6);
    const bp = filter('bandpass', 1500, 1.2);
    const mix = gain(0.5);
    a.connect(mix);
    b.connect(mix);
    mix.connect(dist);
    dist.connect(bp);
    const lfo = tremolo(bp, out, 55, 0.7, 'square');
    update = (rpm) => {
      const f = 110 + rpm * 310;
      set(a.frequency, f);
      set(b.frequency, f * 1.02);
      set(bp.frequency, 1100 + rpm * 1600);
      set(lfo.frequency, f / 2);
      return (0.28 + rpm * 0.22) * 3;
    };
  } else if (kind === 'jeep' || kind === 'pickup' || kind === 'sedan') {
    const base = kind === 'jeep' ? 55 : kind === 'sedan' ? 62 : 46;
    const a = osc('sawtooth', base);
    const sub = osc('square', base / 2);
    const subG = gain(0.6);
    sub.connect(subG);
    const lp = filter('lowpass', 500, 1.5);
    a.connect(lp);
    subG.connect(lp);
    const lfo = tremolo(lp, out, base / 2, 0.45);
    // Emme/egzoz hışırtısı
    const n = noise();
    const nf = filter('bandpass', 250, 1);
    const ng = gain(0.12);
    n.connect(nf);
    nf.connect(ng);
    ng.connect(out);
    update = (rpm) => {
      const f = base + rpm * 115;
      set(a.frequency, f, 0.04);
      set(sub.frequency, f / 2, 0.04);
      set(lp.frequency, 450 + rpm * 1000);
      set(lfo.frequency, f / 2, 0.04);
      return 0.3 + rpm * 0.25;
    };
  } else if (kind === 'tank') {
    const a = osc('sawtooth', 32);
    const lp = filter('lowpass', 170, 2);
    a.connect(lp);
    lp.connect(out);
    const rumble = osc('sine', 24);
    const rg = gain(0.5);
    rumble.connect(rg);
    rg.connect(out);
    // Metalik palet şakırtısı: dar bantlı gürültü, keskin darbeler
    const n = noise();
    const bp = filter('bandpass', 2200, 9);
    const clank = gain(0);
    n.connect(bp);
    const pre = gain(6);
    bp.connect(pre);
    const lfo = tremolo(pre, clank, 5, 1, 'square');
    clank.connect(out);
    update = (rpm, sp) => {
      set(a.frequency, 32 + rpm * 38, 0.15);
      set(lfo.frequency, 3 + sp * 14, 0.1);
      set(clank.gain, Math.min(1, sp * 3) * 0.45, 0.1);
      return (0.4 + rpm * 0.2) * 0.6;
    };
  } else if (kind === 'heli') {
    // Rotor: gürültü + alçak sinüs, keskin darbeli genlik (vop-vop)
    const n = noise();
    const lp = filter('lowpass', 320, 1);
    n.connect(lp);
    const thump = osc('sine', 65);
    const mix = gain(1);
    lp.connect(mix);
    thump.connect(mix);
    const sharp = shaper(4);
    const pulse = gain(0);
    const lfo = osc('square', 7);
    const lg = gain(0.5);
    lfo.connect(lg);
    lg.connect(pulse.gain);
    const bias = ctx.createConstantSource();
    bias.offset.value = 0.5;
    bias.start();
    nodes.push(bias);
    bias.connect(pulse.gain);
    mix.connect(sharp);
    sharp.connect(pulse);
    pulse.connect(out);
    const turbine = osc('sine', 1700);
    const tg = gain(0.07);
    turbine.connect(tg);
    tg.connect(out);
    update = (rpm) => {
      set(lfo.frequency, 6 + rpm * 4, 0.3);
      set(turbine.frequency, 1500 + rpm * 700, 0.3);
      return (0.45 + rpm * 0.2) * 0.6;
    };
  } else {
    // Uçak: tiz pervane vızıltısı + hızla artan rüzgâr
    const a = osc('sawtooth', 150);
    const b = osc('square', 151);
    const bg = gain(0.4);
    b.connect(bg);
    const lp = filter('lowpass', 2400, 0.8);
    a.connect(lp);
    bg.connect(lp);
    const lfo = tremolo(lp, out, 60, 0.55);
    const n = noise();
    const hp = filter('highpass', 1800, 0.6);
    const wind = gain(0);
    n.connect(hp);
    hp.connect(wind);
    wind.connect(out);
    update = (rpm, sp) => {
      const f = 150 + rpm * 190;
      set(a.frequency, f, 0.1);
      set(b.frequency, f * 1.007, 0.1);
      set(lfo.frequency, 50 + rpm * 50, 0.1);
      set(wind.gain, sp * 0.6, 0.2);
      return (0.25 + rpm * 0.2) * 1.3;
    };
  }
  return { out, nodes, update };
}
