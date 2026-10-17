import { describe, it, expect } from 'vitest';
import { followSpeed, followDistance, pickBreadcrumb, boardingRule, inSafeZone, rescueStatus, CHILD_FOLLOW_DIST, CHILD_RUN, CHILD_WALK } from '../src/entities/childLogic.js';
import { VEHICLE_TYPES } from '../src/vehicles/vehicleTypes.js';
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
  it('sıradaki çocuk biraz daha geride durur', () => {
    expect(followDistance(0)).toBe(CHILD_FOLLOW_DIST);
    expect(followDistance(2)).toBeGreaterThan(followDistance(1));
    expect(followSpeed(3.5, false, followDistance(2))).toBe(0);
    expect(followSpeed(3.5, false, followDistance(0))).toBeGreaterThan(0);
  });
  it('koltuk sayısı: araç dolunca binemez, uçağa hiç binemez', () => {
    expect(VEHICLE_TYPES.sedan.seats).toBe(3);
    expect(VEHICLE_TYPES.motorcycle.seats).toBe(1);
    expect(boardingRule(VEHICLE_TYPES.sedan.seats, 2).ok).toBe(true);
    expect(boardingRule(VEHICLE_TYPES.sedan.seats, 3).ok).toBe(false);
    expect(boardingRule(VEHICLE_TYPES.motorcycle.seats, 1).ok).toBe(false);
    expect(boardingRule(VEHICLE_TYPES.plane.seats, 0).ok).toBe(false);
  });
});

describe('üç çocuklu kurtarma görevi', () => {
  const kid = (state, alive = true) => ({ state, alive });
  it('hepsi güvende olunca biter', () => {
    expect(rescueStatus([kid('hiding'), kid('hiding'), kid('hiding')])).toMatchObject({ done: false, hiding: 3, safe: 0 });
    expect(rescueStatus([kid('safe'), kid('following'), kid('inVehicle')])).toMatchObject({ done: false, safe: 1, withYou: 2 });
    expect(rescueStatus([kid('safe'), kid('safe'), kid('safe')])).toMatchObject({ done: true, safe: 3 });
  });
  it('bir çocuk ölürse görev başarısız', () => {
    expect(rescueStatus([kid('safe'), kid('dead', false), kid('hiding')]).failed).toBe(true);
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
    saveProgress({ level: 4 }, st);
    expect(loadProgress(st)).toEqual({ level: 4 });
    expect(loadProgress(undefined)).toBeNull();
  });
});
