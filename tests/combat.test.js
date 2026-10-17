import { describe, it, expect } from 'vitest';
import { applyPlayerDamage, explosionDamage, damageZombie, HEADSHOT_MULT, PLAYER_TOUGHNESS } from '../src/core/combat.js';
import { ZOMBIE_TYPES } from '../src/entities/zombieTypes.js';
import { WEAPONS } from '../src/weapons/weaponData.js';

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
  it('kafadan vuruş türün çarpanı kadar hasar verir', () => {
    const r = damageZombie(base, 20, 'head');
    expect(r.health).toBe(60 - 20 * HEADSHOT_MULT);
    expect(r.headshot).toBe(true);
  });
  it('kask ilk kafa vuruşunu tamamen yutar', () => {
    const r = damageZombie({ health: 60, armor: 0, helmet: 30 }, 30, 'head');
    expect(r.helmet).toBe(0);
    expect(r.health).toBe(60);
    expect(r.headshot).toBe(false);
  });
  it('yelek ilk gövde vuruşunu tamamen yutar', () => {
    const r = damageZombie({ health: 60, armor: 30, helmet: 0 }, 30, 'body');
    expect(r.armor).toBe(0);
    expect(r.health).toBe(60);
  });
  it('patlamada yelek hasarın sadece yarısını emer', () => {
    const r = damageZombie({ health: 80, armor: 70, helmet: 0 }, 100, 'blast');
    expect(r.armor).toBe(20);
    expect(r.health).toBe(30);
  });
});

describe('vuruş sayıları (tabanca/levye)', () => {
  const shotsToKill = (typeKey, part, dmg = WEAPONS.pistol.damage) => {
    const t = ZOMBIE_TYPES[typeKey];
    let s = { health: t.hp, armor: t.armor || 0, helmet: t.helmet || 0 };
    let n = 0;
    while (s.health > 0 && n < 20) {
      s = damageZombie(s, dmg, part, t.headMult);
      n++;
    }
    return n;
  };
  const table = [
    ['small', 1, 1], ['normal', 2, 1], ['gunner', 2, 1], ['exploder', 2, 1],
    ['big', 3, 2], ['armored', 3, 2], ['soldier', 3, 2],
  ];
  for (const [type, body, head] of table) {
    it(`${type}: gövde ${body}, kafa ${head} vuruş`, () => {
      expect(shotsToKill(type, 'body')).toBe(body);
      expect(shotsToKill(type, 'head')).toBe(head);
      expect(shotsToKill(type, 'body', WEAPONS.crowbar.damage)).toBe(body);
      expect(shotsToKill(type, 'body', WEAPONS.smg.damage)).toBe(body);
    });
  }
  it('pompalı yakından normal zombiyi tek atışta öldürür', () => {
    const t = ZOMBIE_TYPES.normal;
    const r = damageZombie({ health: t.hp, armor: 0, helmet: 0 }, WEAPONS.shotgun.damage * WEAPONS.shotgun.pellets, 'body', t.headMult);
    expect(r.health).toBe(0);
  });
  it('oyuncu %20 daha dayanıklı', () => {
    expect(PLAYER_TOUGHNESS).toBeCloseTo(1.2);
  });
});
