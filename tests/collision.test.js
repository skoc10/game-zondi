import { describe, it, expect } from 'vitest';
import { CollisionWorld, boxFromBase, rayAABB } from '../src/core/Collision.js';
import { nightFactorAt, DUSK_START, NIGHT_START, DAWN_START } from '../src/world/DayNight.js';

describe('çarpışma', () => {
  it('ışın kutuya doğru mesafede çarpar', () => {
    const b = boxFromBase(0, 0, -10, 2, 2, 2);
    expect(rayAABB(0, 1, 0, 0, 0, -1, b)).toBeCloseTo(9);
    expect(rayAABB(0, 1, 0, 0, 0, 1, b)).toBe(Infinity);
  });
  it('karakter duvardan dışarı itilir', () => {
    const w = new CollisionWorld();
    w.add(boxFromBase(0, 0, 0, 2, 3, 2));
    const p = { x: 1.2, y: 0, z: 0 };
    w.resolveCircle(p, 0.4, 1.8);
    expect(p.x).toBeCloseTo(1.4);
  });
  it('alçak kutunun üstüne çıkılabilir, yüksek duvara çıkılamaz', () => {
    const w = new CollisionWorld();
    w.add(boxFromBase(0, 0, 0, 2, 0.4, 2));
    w.add(boxFromBase(10, 0, 0, 2, 3, 2));
    expect(w.groundHeight(0, 0, 0.4, 0.1)).toBeCloseTo(0.4);
    expect(w.groundHeight(10, 0, 0.4, 0)).toBe(0);
  });
  it('görüş hattı duvarla kesilir', () => {
    const w = new CollisionWorld();
    w.add(boxFromBase(0, 0, 5, 4, 3, 1));
    expect(w.lineOfSight(0, 1, 0, 0, 1, 10)).toBe(false);
    expect(w.lineOfSight(0, 1, 0, 0, 1, 3)).toBe(true);
  });
});

describe('gece-gündüz', () => {
  it('gündüz 0, gece 1, geçişler arada', () => {
    expect(nightFactorAt(100)).toBe(0);
    expect(nightFactorAt(NIGHT_START + 10)).toBe(1);
    const mid = nightFactorAt((DUSK_START + NIGHT_START) / 2);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
    expect(nightFactorAt(DAWN_START + 14)).toBeLessThan(0.1);
  });
});

import { mulberry32 } from '../src/core/math.js';
import { coveredExplosionDamage, explosionDamage, COVER_MULT } from '../src/core/combat.js';

describe('çarpışma ızgarası', () => {
  // Kaba kuvvet referansı: tüm kutuları dene
  function bruteRay(boxes, o, d, maxT) {
    let best = maxT;
    for (const b of boxes) {
      const t = rayAABB(o[0], o[1], o[2], d[0], d[1], d[2], b, best);
      if (t < best) best = t;
    }
    return best;
  }

  it('ızgaralı ışın testi kaba kuvvetle aynı sonucu verir', () => {
    const rng = mulberry32(42);
    const w = new CollisionWorld();
    for (let i = 0; i < 400; i++) {
      w.add(boxFromBase((rng() - 0.5) * 400, 0, (rng() - 0.5) * 400, 0.3 + rng() * 30, 0.5 + rng() * 6, 0.3 + rng() * 30));
    }
    for (let i = 0; i < 500; i++) {
      const o = [(rng() - 0.5) * 420, 0.5 + rng() * 4, (rng() - 0.5) * 420];
      const a = rng() * Math.PI * 2;
      const e = (rng() - 0.5) * 0.2;
      const d = [Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e)];
      const maxT = 20 + rng() * 250;
      const hit = w.raycast(o[0], o[1], o[2], d[0], d[1], d[2], maxT);
      const expected = bruteRay(w.boxes, o, d, maxT);
      const groundT = d[1] < -1e-6 ? -o[1] / d[1] : Infinity;
      const want = Math.min(expected, groundT);
      if (want >= maxT) expect(hit).toBeNull();
      else expect(hit.t).toBeCloseTo(want, 6);
    }
  });

  it('kaldırılan kutu artık çarpışmaz', () => {
    const w = new CollisionWorld();
    const b = w.add(boxFromBase(0, 0, 0, 40, 3, 2));
    expect(w.blockedAt(10, 0, 0.5)).toBe(true);
    w.remove(b);
    expect(w.blockedAt(10, 0, 0.5)).toBe(false);
    expect(w.raycast(10, 1, -10, 0, 0, 1, 50)).toBeNull();
  });

  it('hücre sınırındaki karakter yine itilir', () => {
    const w = new CollisionWorld();
    w.add(boxFromBase(16.5, 0, 0, 1, 3, 1));
    const p = { x: 15.7, y: 0, z: 0 };
    w.resolveCircle(p, 0.4, 1.8);
    expect(p.x).toBeCloseTo(15.6);
  });
});

describe('siper', () => {
  it('duvar arkasında patlama hasarı azalır', () => {
    expect(coveredExplosionDamage(2, 6, 100, false)).toBe(explosionDamage(2, 6, 100));
    expect(coveredExplosionDamage(2, 6, 100, true)).toBeCloseTo(explosionDamage(2, 6, 100) * COVER_MULT);
    expect(coveredExplosionDamage(7, 6, 100, true)).toBe(0);
  });
});
