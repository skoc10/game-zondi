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
