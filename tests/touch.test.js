import { describe, it, expect } from 'vitest';
import { stickVector } from '../src/core/Touch.js';

describe('dokunmatik sanal çubuk', () => {
  it('küçük kaydırma ölü bölgede kalır', () => {
    expect(stickVector(3, 2)).toEqual({ x: 0, y: 0, sprint: false });
  });
  it('yukarı kaydırma ileri hareket, yarıçapta tam güç', () => {
    const v = stickVector(0, -56);
    expect(v.y).toBeCloseTo(1);
    expect(v.x).toBeCloseTo(0);
    expect(v.sprint).toBe(false);
  });
  it('yarıçapın ötesine itmek koşu sayılır ve güç 1 ile sınırlanır', () => {
    const v = stickVector(80, 0);
    expect(v.x).toBeCloseTo(1);
    expect(v.sprint).toBe(true);
  });
  it('yarım itiş yarım hız', () => {
    expect(stickVector(-28, 0).x).toBeCloseTo(-0.5);
  });
});
