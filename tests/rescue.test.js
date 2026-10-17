import { describe, it, expect } from 'vitest';
import { followSpeed, pickBreadcrumb, boardingRule, inSafeZone, rescueStage, CHILD_FOLLOW_DIST, CHILD_RUN, CHILD_WALK } from '../src/entities/childLogic.js';
import { Inventory } from '../src/player/Inventory.js';
import { loadProgress, saveProgress } from '../src/core/Progress.js';

const memoryStorage = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
};

describe('çocuğun takibi', () => {
  it('oyuncuya yakınken durur, uzaklaştıkça hızlanır', () => {
    expect(followSpeed(CHILD_FOLLOW_DIST - 0.5)).toBe(0);
    expect(followSpeed(3.5)).toBeGreaterThan(0);
    expect(followSpeed(3.5)).toBeLessThan(followSpeed(6));
    expect(followSpeed(6)).toBeLessThanOrEqual(CHILD_WALK);
    expect(followSpeed(20)).toBe(CHILD_RUN);
  });
  it('panikte koşar', () => {
    expect(followSpeed(4, true)).toBe(CHILD_RUN);
  });
  it('görüş yoksa görülebilen en yeni ize gider', () => {
    const trail = [{ x: 0, z: 0 }, { x: 5, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 10 }];
    expect(pickBreadcrumb(trail, (t) => t.z === 0)).toEqual({ x: 10, z: 0 });
    expect(pickBreadcrumb(trail, () => false)).toBeNull();
  });
  it('uçağa binemez, diğer araçlara biner', () => {
    expect(boardingRule('plane').ok).toBe(false);
    expect(boardingRule('sedan').ok).toBe(true);
    expect(boardingRule('motorcycle').ok).toBe(true);
  });
});

describe('kurtarma görevi aşamaları', () => {
  const base = { barricadeBroken: false, childState: 'hiding', childAlive: true, childSafe: false };
  it('okul → içeri gir → eşlik → bitti', () => {
    expect(rescueStage(base)).toBe('school');
    expect(rescueStage({ ...base, barricadeBroken: true })).toBe('reach');
    expect(rescueStage({ ...base, barricadeBroken: true, childState: 'following' })).toBe('escort');
    expect(rescueStage({ ...base, barricadeBroken: true, childState: 'inVehicle' })).toBe('escort');
    expect(rescueStage({ ...base, barricadeBroken: true, childState: 'safe', childSafe: true })).toBe('done');
  });
  it('çocuk ölürse görev başarısız', () => {
    expect(rescueStage({ ...base, childAlive: false })).toBe('failed');
  });
  it('güvenli bölge sınırı', () => {
    const zone = { minX: -18, maxX: 18, minZ: 162, maxZ: 192 };
    expect(inSafeZone(0, 170, zone)).toBe(true);
    expect(inSafeZone(0, 158, zone)).toBe(false);
    expect(inSafeZone(25, 170, zone)).toBe(false);
  });
});

describe('bölümler arası taşıma', () => {
  it('envanter kaydedilip geri yüklenir', () => {
    const a = new Inventory();
    a.addWeapon('shotgun', 20);
    a.addWeapon('smg', 50);
    a.addItem('c4', 2);
    a.select(3);
    const b = new Inventory();
    b.restore(JSON.parse(JSON.stringify(a.serialize())));
    expect(b.owned.shotgun).toBe(true);
    expect(b.owned.smg).toBe(true);
    expect(b.reserve.shotgun).toBe(a.reserve.shotgun);
    expect(b.mag.smg).toBe(a.mag.smg);
    expect(b.counts.c4).toBe(2);
    expect(b.activeId).toBe('smg');
  });
  it('bozuk/aşırı veri güvenle sınırlanır', () => {
    const b = new Inventory();
    b.restore({ owned: { crowbar: false, rocket: true }, mag: { rocket: 99 }, reserve: { rocket: -5 }, counts: { c4: 999 }, active: 'x' });
    expect(b.owned.crowbar).toBe(true);
    expect(b.mag.rocket).toBe(1);
    expect(b.reserve.rocket).toBe(0);
    expect(b.counts.c4).toBe(5);
    b.restore(null);
    expect(b.activeId).toBe('crowbar');
  });
  it('ilerleme kaydı yazılır ve okunur; bozuk kayıt yok sayılır', () => {
    const st = memoryStorage();
    expect(loadProgress(st)).toBeNull();
    saveProgress({ level: 2, health: 80 }, st);
    expect(loadProgress(st)).toEqual({ level: 2, health: 80 });
    st.setItem('zondi-ilerleme', '{bozuk');
    expect(loadProgress(st)).toBeNull();
    st.setItem('zondi-ilerleme', JSON.stringify({ level: 7 }));
    expect(loadProgress(st)).toBeNull();
    expect(loadProgress(undefined)).toBeNull();
  });
});
