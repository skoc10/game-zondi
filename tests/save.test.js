import { describe, it, expect } from 'vitest';
import { loadSave, writeSave, clearSave, saveMatches, respawnHealth, RESPAWN_MIN_HEALTH } from '../src/core/SaveGame.js';

function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}

describe('bölüm içi kayıt', () => {
  it('yazılır, okunur ve silinir', () => {
    const st = memoryStorage();
    expect(loadSave(st)).toBeNull();
    expect(writeSave({ level: 2, player: { x: 1, z: 2, health: 70 } }, st)).toBe(true);
    const d = loadSave(st);
    expect(d.level).toBe(2);
    expect(d.player.x).toBe(1);
    clearSave(st);
    expect(loadSave(st)).toBeNull();
  });

  it('bozuk ya da eksik kayıt yok sayılır', () => {
    const st = memoryStorage();
    st.setItem('zondi-kayit', '{bozuk');
    expect(loadSave(st)).toBeNull();
    st.setItem('zondi-kayit', JSON.stringify({ v: 1, level: 9, player: { x: 0, z: 0 } }));
    expect(loadSave(st)).toBeNull();
    st.setItem('zondi-kayit', JSON.stringify({ v: 1, level: 2 }));
    expect(loadSave(st)).toBeNull();
    st.setItem('zondi-kayit', JSON.stringify({ v: 0, level: 2, player: { x: 0, z: 0 } }));
    expect(loadSave(st)).toBeNull();
    expect(loadSave(undefined)).toBeNull();
  });

  it('kayıt sadece aynı bölüm ve sahneye uyar', () => {
    expect(saveMatches({ level: 4, sub: 'space' }, 4, 'space')).toBe(true);
    expect(saveMatches({ level: 4 }, 4, 'space')).toBe(false);
    expect(saveMatches({ level: 3 }, 3, null)).toBe(true);
    expect(saveMatches(null, 3, null)).toBe(false);
  });

  it('kayıttan dönünce can en az belirli bir değerde', () => {
    expect(respawnHealth(5)).toBe(RESPAWN_MIN_HEALTH);
    expect(respawnHealth(90)).toBe(90);
    expect(respawnHealth(undefined)).toBe(100);
  });
});
