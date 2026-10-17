import { describe, it, expect } from 'vitest';
import { Inventory } from '../src/player/Inventory.js';
import { SLOTS, WEAPONS } from '../src/weapons/weaponData.js';

describe('envanter', () => {
  it('başlangıçta sadece levye var', () => {
    const inv = new Inventory();
    expect(inv.activeId).toBe('crowbar');
    expect(SLOTS.filter((_, i) => inv.hasSlot(i))).toEqual(['crowbar']);
  });

  it('yeni silah şarjörü doldurur, kalan yedeğe gider', () => {
    const inv = new Inventory();
    expect(inv.addWeapon('pistol', 20)).toBe(true);
    expect(inv.mag.pistol).toBe(12);
    expect(inv.reserve.pistol).toBe(8);
    expect(inv.addWeapon('pistol', 10)).toBe(false);
    expect(inv.reserve.pistol).toBe(18);
  });

  it('yedek mermi sınırı aşılmaz', () => {
    const inv = new Inventory();
    inv.addWeapon('rocket', 100);
    expect(inv.reserve.rocket).toBe(WEAPONS.rocket.maxReserve);
  });

  it('şarjör değiştirme yedekten alır', () => {
    const inv = new Inventory();
    inv.addWeapon('smg', 40);
    for (let i = 0; i < 25; i++) inv.useAmmo('smg');
    expect(inv.canReload('smg')).toBe(true);
    expect(inv.reload('smg')).toBe(10);
    expect(inv.mag.smg).toBe(15);
    expect(inv.reserve.smg).toBe(0);
    expect(inv.canReload('smg')).toBe(false);
  });

  it('olmayan slot seçilemez, döngü sahip olunanlarda gezer', () => {
    const inv = new Inventory();
    expect(inv.select(3)).toBe(false);
    inv.addWeapon('shotgun', 6);
    inv.addItem('tnt', 1);
    inv.cycle(1);
    expect(inv.activeId).toBe('shotgun');
    inv.cycle(1);
    expect(inv.activeId).toBe('tnt');
    inv.cycle(1);
    expect(inv.activeId).toBe('crowbar');
    inv.cycle(-1);
    expect(inv.activeId).toBe('tnt');
  });

  it('fırlatılabilir slotu bomba ve zombi kafası arasında geçiş yapar', () => {
    const inv = new Inventory();
    inv.addItem('grenade', 1);
    inv.addItem('head', 1);
    inv.select(5);
    expect(inv.throwKind).toBe('grenade');
    inv.select(5);
    expect(inv.throwKind).toBe('head');
  });

  it('son eşya kullanılınca en iyi silaha döner', () => {
    const inv = new Inventory();
    inv.addWeapon('pistol', 12);
    inv.addItem('c4', 1);
    inv.select(7);
    inv.useItem('c4');
    expect(inv.activeId).toBe('pistol');
  });

  it('eşya taşıma sınırı', () => {
    const inv = new Inventory();
    expect(inv.addItem('head', 10)).toBe(4);
    expect(inv.addItem('head', 1)).toBe(0);
  });

  it('mermi kutusu silah yoksa tabancaya gider', () => {
    const inv = new Inventory();
    expect(inv.ammoBoxTarget()).toBe('pistol');
    inv.addWeapon('shotgun', 6);
    expect(inv.ammoBoxTarget(() => 0)).toBe('shotgun');
  });
});
