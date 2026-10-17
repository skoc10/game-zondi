import { describe, it, expect } from 'vitest';
import { survivesNuke, summonWaves, reactorStage, SAFE_DIST, BOMB_TIME } from '../src/levels/reactorLogic.js';
import { ZOMBIE_TYPES } from '../src/entities/zombieTypes.js';
import { damageZombie } from '../src/core/combat.js';
import { WEAPONS } from '../src/weapons/weaponData.js';

describe('3. bölüm: nükleer tesis', () => {
  it('patlama yarıçapı dışında kalan kurtulur', () => {
    expect(survivesNuke(SAFE_DIST + 1)).toBe(true);
    expect(survivesNuke(SAFE_DIST - 1)).toBe(false);
    expect(BOMB_TIME).toBe(90);
  });
  it('boss %50 ve %25 eşiklerinde birer kez zombi çağırır', () => {
    expect(summonWaves(1, 0.6)).toBe(0);
    expect(summonWaves(0.6, 0.45)).toBe(1);
    expect(summonWaves(0.45, 0.3)).toBe(0);
    expect(summonWaves(0.3, 0.2)).toBe(1);
    expect(summonWaves(1, 0.1)).toBe(2);
  });
  it('görev aşamaları: boss → bomba → kaç → bitti', () => {
    expect(reactorStage({ bossAlive: true, planted: false, nuked: false })).toBe('boss');
    expect(reactorStage({ bossAlive: false, planted: false, nuked: false })).toBe('plant');
    expect(reactorStage({ bossAlive: false, planted: true, nuked: false })).toBe('escape');
    expect(reactorStage({ bossAlive: false, planted: true, nuked: true })).toBe('done');
  });
  it('bilim insanları insandır; Dr. Kaos kafadan 6, gövdeden 12 vuruşta ölür', () => {
    expect(ZOMBIE_TYPES.scientist.human).toBe(true);
    const t = ZOMBIE_TYPES.drKaos;
    const shots = (part) => {
      let s = { health: t.hp, armor: 0, helmet: 0 };
      let n = 0;
      while (s.health > 0 && n < 50) { s = damageZombie(s, WEAPONS.laser.damage, part, t.headMult); n++; }
      return n;
    };
    expect(shots('head')).toBe(6);
    expect(shots('body')).toBe(12);
  });
  it('lazer tabancası 1 vuruşluk otomatik silahtır', () => {
    expect(WEAPONS.laser.damage).toBe(30);
    expect(WEAPONS.laser.auto).toBe(true);
  });
});
