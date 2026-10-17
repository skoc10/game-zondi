import { describe, it, expect } from 'vitest';
import { radialDeadzone, lookCurve, readPad, BTN, isPlayStation, glyph } from '../src/core/Gamepad.js';

const pad = (axes = [0, 0, 0, 0], pressed = {}, id = 'Xbox Wireless Controller') => ({
  id,
  axes,
  buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: !!pressed[i], value: pressed[i] ? 1 : 0 })),
});

describe('oyun kolu', () => {
  it('ölü bölge içindeki küçük titreşimleri yok sayar', () => {
    expect(radialDeadzone(0.1, -0.1)).toEqual([0, 0]);
  });
  it('ölü bölge dışını 0..1 aralığına ölçekler', () => {
    const [x, y] = radialDeadzone(1, 0);
    expect(x).toBeCloseTo(1);
    expect(y).toBe(0);
    const [hx] = radialDeadzone(0.59, 0);
    expect(hx).toBeGreaterThan(0.45);
    expect(hx).toBeLessThan(0.55);
  });
  it('bakış eğrisi işareti korur ve küçük değerleri yumuşatır', () => {
    expect(lookCurve(-1)).toBe(-1);
    expect(lookCurve(0.5)).toBeLessThan(0.5);
    expect(lookCurve(-0.5)).toBeLessThan(0);
  });
  it('tetikler eşik değerine göre basılı sayılır', () => {
    const p = pad();
    p.buttons[BTN.RT] = { pressed: false, value: 0.2 };
    p.buttons[BTN.LT] = { pressed: false, value: 0.8 };
    const s = readPad(p);
    expect(s.buttons[BTN.RT]).toBe(false);
    expect(s.buttons[BTN.LT]).toBe(true);
  });
  it('hareketsiz kol aktif sayılmaz, tuşa basınca aktif olur', () => {
    expect(readPad(pad([0.05, 0.05, 0, 0])).active).toBe(false);
    expect(readPad(pad([0, 0, 0, 0], { [BTN.A]: true })).active).toBe(true);
  });
  it('PlayStation kolunu tanır ve doğru ipucunu verir', () => {
    expect(isPlayStation(pad([], {}, 'DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c)'))).toBe(true);
    expect(isPlayStation(pad())).toBe(false);
    expect(glyph('interact', 'pad', true)).toBe('□');
    expect(glyph('interact', 'pad', false)).toBe('X');
    expect(glyph('interact', 'kbm')).toBe('E');
  });
});
