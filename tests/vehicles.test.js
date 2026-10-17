import { describe, it, expect } from 'vitest';
import { ramDamage, fuelUse, stepGround, stepHeli, stepPlane } from '../src/vehicles/vehiclePhysics.js';
import { VEHICLE_TYPES } from '../src/vehicles/vehicleTypes.js';

const state = (o = {}) => ({ x: 0, y: 0, z: 0, yaw: 0, speed: 0, vy: 0, pitch: 0, roll: 0, fuel: 100, onGround: true, throttleSet: 0, ...o });
const ctl = (o = {}) => ({ throttle: 0, steer: 0, handbrake: false, ascend: 0, descend: 0, pitch: 0, ...o });
const run = (fn, st, c, spec, sec, ...rest) => {
  let last;
  for (let t = 0; t < sec; t += 1 / 60) last = fn(st, c, spec, 1 / 60, ...rest);
  return last;
};

describe('ezme ve yakıt', () => {
  it('ezme hasarı hızın karesiyle artar', () => {
    expect(ramDamage(10, 1)).toBeCloseTo(60);
    expect(ramDamage(20, 1)).toBeCloseTo(240);
    expect(ramDamage(10, 0.4)).toBeLessThan(ramDamage(10, 1));
  });
  it('tam gaz rölantiden çok yakar', () => {
    expect(fuelUse(1, 1)).toBeCloseTo(1);
    expect(fuelUse(0, 1)).toBeCloseTo(0.3);
  });
});

describe('kara aracı', () => {
  const spec = VEHICLE_TYPES.jeep;
  it('gaza basınca ileri (-Z) gider ve azami hızı aşmaz', () => {
    const st = state();
    run(stepGround, st, ctl({ throttle: 1 }), spec, 10);
    expect(st.speed).toBeCloseTo(spec.maxSpeed);
    expect(st.z).toBeLessThan(-50);
    expect(st.fuel).toBeLessThan(100);
  });
  it('yakıt bitince hızlanmaz, yavaşlayıp durur', () => {
    const st = state({ fuel: 0, speed: 10 });
    run(stepGround, st, ctl({ throttle: 1 }), spec, 6);
    expect(st.speed).toBe(0);
  });
  it('sağa direksiyon yaw değerini azaltır; dururken dönmez', () => {
    const moving = state({ speed: 10 });
    stepGround(moving, ctl({ steer: 1, throttle: 0.5 }), spec, 0.1);
    expect(moving.yaw).toBeLessThan(0);
    const stopped = state();
    stepGround(stopped, ctl({ steer: 1 }), spec, 0.1);
    expect(stopped.yaw).toBe(0);
  });
  it('tank yerinde dönebilir', () => {
    const st = state();
    stepGround(st, ctl({ steer: 1 }), VEHICLE_TYPES.tank, 0.5);
    expect(st.yaw).toBeLessThan(0);
  });
});

describe('helikopter', () => {
  const spec = VEHICLE_TYPES.heli;
  it('yükselir ve kontrol bırakılınca havada durur', () => {
    const st = state();
    run(stepHeli, st, ctl({ ascend: 1 }), spec, 4);
    expect(st.y).toBeGreaterThan(10);
    const y = st.y;
    run(stepHeli, st, ctl(), spec, 3);
    expect(Math.abs(st.y - y)).toBeLessThan(3);
    expect(Math.abs(st.vy)).toBeLessThan(0.1);
  });
  it('yakıt bitince alçalıp yere iner', () => {
    const st = state({ y: 20, onGround: false, fuel: 0 });
    run(stepHeli, st, ctl({ ascend: 1 }), spec, 10);
    expect(st.y).toBe(0);
    expect(st.onGround).toBe(true);
  });
});

describe('uçak', () => {
  const spec = VEHICLE_TYPES.plane;
  it('kalkış hızına ulaşmadan yerden kalkmaz', () => {
    const st = state();
    run(stepPlane, st, ctl({ throttle: 1, pitch: 1 }), spec, 1.5);
    expect(st.speed).toBeLessThan(spec.takeoff);
    expect(st.onGround).toBe(true);
    expect(st.y).toBe(0);
  });
  it('tam gazda hızlanıp kalkar ve yükselir', () => {
    const st = state();
    run(stepPlane, st, ctl({ throttle: 1 }), spec, 6);
    expect(st.speed).toBeGreaterThan(spec.takeoff);
    run(stepPlane, st, ctl({ throttle: 1, pitch: 1 }), spec, 0.3);
    run(stepPlane, st, ctl({ throttle: 1 }), spec, 3);
    expect(st.onGround).toBe(false);
    expect(st.y).toBeGreaterThan(3);
  });
  it('havada yavaşlarsa stall olup düşer, sert iniş kaza sayılır', () => {
    const st = state({ y: 40, onGround: false, speed: 12, throttleSet: 0, pitch: 0 });
    let crashed = false;
    for (let t = 0; t < 20 && !crashed && !st.onGround; t += 1 / 60) {
      crashed = stepPlane(st, ctl({ throttle: -1 }), spec, 1 / 60).crashed;
    }
    expect(crashed).toBe(true);
  });
});

import { gearAndRpm } from '../src/vehicles/vehiclePhysics.js';

describe('akıcı kontroller', () => {
  it('direksiyon bırakılınca kendiliğinden ortalanır', () => {
    const st = state({ speed: 15 });
    run(stepGround, st, ctl({ steer: 1, throttle: 0.5 }), VEHICLE_TYPES.jeep, 0.6);
    expect(st.steerSm).toBeGreaterThan(0.9);
    run(stepGround, st, ctl({ throttle: 0.5 }), VEHICLE_TYPES.jeep, 0.4);
    expect(st.steerSm).toBe(0);
  });
  it('el freniyle dönünce araç kayar (drift)', () => {
    const st = state({ speed: 20 });
    run(stepGround, st, ctl({ steer: 1, handbrake: true }), VEHICLE_TYPES.jeep, 0.6);
    const slip = Math.abs(st.moveYaw - st.yaw);
    const grip = state({ speed: 20 });
    run(stepGround, grip, ctl({ steer: 1 }), VEHICLE_TYPES.jeep, 0.6);
    expect(slip).toBeGreaterThan(0.15);
    expect(slip).toBeGreaterThan(Math.abs(grip.moveYaw - grip.yaw) * 2);
  });
  it('vites hızla artar, devir 0..1 aralığında kalır', () => {
    const spec = VEHICLE_TYPES.jeep;
    let lastGear = 0;
    for (let v = 1; v <= spec.maxSpeed; v += 1) {
      const { gear, rpm } = gearAndRpm(v, spec);
      expect(gear).toBeGreaterThanOrEqual(lastGear);
      expect(rpm).toBeGreaterThanOrEqual(0);
      expect(rpm).toBeLessThanOrEqual(1);
      lastGear = gear;
    }
    expect(lastGear).toBe(spec.gears);
  });
  it('uçak yatış alarak döner ve bırakınca düzelir', () => {
    const spec = VEHICLE_TYPES.plane;
    const st = state({ y: 60, onGround: false, speed: 35, throttleSet: 0.8 });
    run(stepPlane, st, ctl({ steer: 1 }), spec, 2);
    expect(st.bank).toBeGreaterThan(0.5);
    expect(st.yaw).toBeLessThan(-0.3);
    run(stepPlane, st, ctl(), spec, 3);
    expect(Math.abs(st.bank)).toBeLessThan(0.05);
  });
});
