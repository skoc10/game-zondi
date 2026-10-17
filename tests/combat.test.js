import { describe, it, expect } from 'vitest';
import { applyPlayerDamage, explosionDamage, damageZombie, HEADSHOT_MULT } from '../src/core/combat.js';

describe('oyuncu hasarı', () => {
  it('zırh yokken hasarın tamamı candan düşer', () => {
    expect(applyPlayerDamage(100, 0, 30)).toEqual({ health: 70, armor: 0 });
  });
  it('zırh hasarın %60 kadarını emer', () => {
    const r = applyPlayerDamage(100, 100, 50);
    expect(r.armor).toBeCloseTo(70);
    expect(r.health).toBeCloseTo(80);
  });
  it('zırh azsa sadece kalan zırh kadar emer', () => {
    const r = applyPlayerDamage(100, 10, 50);
    expect(r.armor).toBe(0);
    expect(r.health).toBe(60);
  });
  it('can sıfırın altına düşmez', () => {
    expect(applyPlayerDamage(10, 0, 500).health).toBe(0);
  });
});

describe('patlama hasarı', () => {
  it('merkezde tam, kenarda %25, dışarıda sıfır', () => {
    expect(explosionDamage(0, 6, 100)).toBe(100);
    expect(explosionDamage(5.999, 6, 100)).toBeCloseTo(25, 0);
    expect(explosionDamage(6, 6, 100)).toBe(0);
    expect(explosionDamage(10, 6, 100)).toBe(0);
  });
  it('mesafe arttıkça azalır', () => {
    expect(explosionDamage(2, 6, 100)).toBeGreaterThan(explosionDamage(4, 6, 100));
  });
});

describe('zombi hasarı', () => {
  const base = { health: 60, armor: 0, helmet: 0 };
  it('kafadan vuruş iki kat hasar verir', () => {
    const r = damageZombie(base, 20, 'head');
    expect(r.health).toBe(60 - 20 * HEADSHOT_MULT);
    expect(r.headshot).toBe(true);
  });
  it('kask kafa vuruşunu önce emer ve çarpan uygulanmaz', () => {
    const r = damageZombie({ health: 80, armor: 0, helmet: 45 }, 30, 'head');
    expect(r.helmet).toBe(15);
    expect(r.health).toBe(80);
    expect(r.headshot).toBe(false);
  });
  it('yelek gövde hasarını emer, artan can\'a geçer', () => {
    const r = damageZombie({ health: 80, armor: 20, helmet: 0 }, 50, 'body');
    expect(r.armor).toBe(0);
    expect(r.health).toBe(50);
  });
  it('patlamada yelek hasarın sadece yarısını emer', () => {
    const r = damageZombie({ health: 80, armor: 70, helmet: 0 }, 100, 'blast');
    expect(r.armor).toBe(20);
    expect(r.health).toBe(30);
  });
});
