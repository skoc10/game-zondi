import { describe, it, expect } from 'vitest';
import {
  tickNeeds, eat, sip, survivalTime, formatSurvival, spookRange, loadRecord, updateRecord,
  HUNGER_RATE, THIRST_RATE, SPRINT_DRAIN, COOKED_FOOD, RAW_FOOD, RAW_HARM, SIP, CANTEEN_MAX, DAY_LENGTH,
} from '../src/levels/survivalLogic.js';

function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}

describe('hayatta kalma: açlık ve susuzluk', () => {
  it('zamanla düşer, koşarken daha hızlı', () => {
    const walk = tickNeeds({ hunger: 50, thirst: 50 }, 10);
    expect(walk.hunger).toBeCloseTo(50 - HUNGER_RATE * 10);
    expect(walk.thirst).toBeCloseTo(50 - THIRST_RATE * 10);
    const run = tickNeeds({ hunger: 50, thirst: 50 }, 10, true);
    expect(50 - run.thirst).toBeCloseTo((50 - walk.thirst) * SPRINT_DRAIN);
    expect(walk.damage).toBe(0);
  });

  it('susuzluk açlıktan hızlı biter; sıfırda can gider', () => {
    expect(THIRST_RATE).toBeGreaterThan(HUNGER_RATE);
    const r = tickNeeds({ hunger: 0, thirst: 0 }, 1);
    expect(r.damage).toBeGreaterThan(2);
    expect(r.cause).toBe('thirst');
    expect(tickNeeds({ hunger: 0, thirst: 80 }, 1).cause).toBe('hunger');
    expect(tickNeeds({ hunger: 5, thirst: 5 }, 100).hunger).toBe(0);
  });

  it('pişmiş et tam doyurur, çiğ et az doyurur ve can götürür', () => {
    const c = eat({ hunger: 20, raw: 1, cooked: 1 });
    expect(c.ate).toBe('cooked');
    expect(c.hunger).toBe(20 + COOKED_FOOD);
    expect(c.cooked).toBe(0);
    expect(c.raw).toBe(1);
    const r = eat({ hunger: 20, raw: 1, cooked: 0 });
    expect(r.ate).toBe('raw');
    expect(r.hunger).toBe(20 + RAW_FOOD);
    expect(r.heal).toBe(-RAW_HARM);
    expect(eat({ hunger: 20, raw: 0, cooked: 0 }).ate).toBeNull();
    expect(eat({ hunger: 90, raw: 0, cooked: 1 }).hunger).toBe(100);
  });

  it('matara en fazla 3 yudum', () => {
    let s = { thirst: 10, canteen: CANTEEN_MAX };
    for (let i = 0; i < 5; i++) s = sip(s);
    expect(s.canteen).toBe(0);
    expect(s.thirst).toBe(Math.min(100, 10 + SIP * CANTEEN_MAX));
    expect(sip({ thirst: 10, canteen: 0 }).drank).toBe(false);
  });
});

describe('hayatta kalma: gün ve rekor', () => {
  it('gün hesabı', () => {
    expect(survivalTime(0).day).toBe(1);
    expect(survivalTime(DAY_LENGTH * 2 + DAY_LENGTH / 2)).toEqual({ days: 2, hours: 12, day: 3 });
    expect(formatSurvival(DAY_LENGTH / 4)).toBe('6 saat');
    expect(formatSurvival(DAY_LENGTH + DAY_LENGTH / 2)).toBe('1 gün 12 saat');
  });

  it('rekor sadece daha uzun sürede güncellenir; bozuk kayıt yok sayılır', () => {
    const st = memoryStorage();
    expect(loadRecord(st)).toBeNull();
    expect(updateRecord(100, {}, st).isNew).toBe(true);
    expect(updateRecord(50, {}, st).isNew).toBe(false);
    expect(loadRecord(st).seconds).toBe(100);
    expect(updateRecord(400, { deer: 3 }, st).record.deer).toBe(3);
    st.setItem('zondi-rekor', '{bozuk');
    expect(loadRecord(st)).toBeNull();
  });
});

describe('geyik ürkme mesafesi', () => {
  it('koşarken uzaktan, gece daha yakından ürker', () => {
    expect(spookRange({ sprinting: true })).toBeGreaterThan(spookRange());
    expect(spookRange({ night: 1 })).toBeLessThan(spookRange());
  });
});
