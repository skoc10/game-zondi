import { WEAPONS, SLOTS, GUNS, ITEM_MAX } from '../weapons/weaponData.js';

export class Inventory {
  constructor() {
    this.reset();
  }

  reset() {
    this.owned = { crowbar: true, pistol: false, shotgun: false, smg: false, rocket: false };
    this.mag = { pistol: 0, shotgun: 0, smg: 0, rocket: 0 };
    this.reserve = { pistol: 0, shotgun: 0, smg: 0, rocket: 0 };
    this.counts = { grenade: 0, head: 0, tnt: 0, c4: 0 };
    this.throwKind = 'grenade';
    this.active = 0;
  }

  get activeId() {
    return SLOTS[this.active];
  }

  hasSlot(i) {
    const id = SLOTS[i];
    if (id in this.owned) return this.owned[id];
    if (id === 'throwable') return this.counts.grenade + this.counts.head > 0;
    return this.counts[id] > 0;
  }

  fixThrowKind() {
    if (this.counts[this.throwKind] <= 0) {
      this.throwKind = this.counts.grenade > 0 ? 'grenade' : 'head';
    }
  }

  // Aynı fırlatılabilir slotuna tekrar basınca bomba ↔ kafa değişir.
  select(i) {
    if (i < 0 || i >= SLOTS.length || !this.hasSlot(i)) return false;
    if (i === this.active && SLOTS[i] === 'throwable') {
      const other = this.throwKind === 'grenade' ? 'head' : 'grenade';
      if (this.counts[other] > 0) this.throwKind = other;
    }
    this.active = i;
    this.fixThrowKind();
    return true;
  }

  cycle(dir) {
    const n = SLOTS.length;
    for (let k = 1; k <= n; k++) {
      const i = (this.active + dir * k + n * 2) % n;
      if (this.hasSlot(i)) {
        this.active = i;
        this.fixThrowKind();
        return true;
      }
    }
    return false;
  }

  // Elde biten eşya slotu boşaldıysa en iyi silaha geç
  ensureValid() {
    if (this.hasSlot(this.active)) {
      this.fixThrowKind();
      return;
    }
    for (const id of ['smg', 'shotgun', 'pistol', 'rocket']) {
      if (this.owned[id]) {
        this.active = SLOTS.indexOf(id);
        return;
      }
    }
    this.active = 0;
  }

  // Yeni silahsa true döner (otomatik seçim için)
  addWeapon(id, ammo) {
    const w = WEAPONS[id];
    const isNew = !this.owned[id];
    this.owned[id] = true;
    if (isNew) {
      const inMag = Math.min(ammo, w.mag);
      this.mag[id] = inMag;
      ammo -= inMag;
    }
    this.reserve[id] = Math.min(w.maxReserve, this.reserve[id] + ammo);
    return isNew;
  }

  addAmmo(id, n) {
    const before = this.reserve[id];
    this.reserve[id] = Math.min(WEAPONS[id].maxReserve, before + n);
    return this.reserve[id] - before;
  }

  // Mermi kutusu: sahip olunan silahlardan rastgele birine; hiç yoksa tabancaya
  ammoBoxTarget(rng = Math.random) {
    const owned = GUNS.filter((g) => this.owned[g] && this.reserve[g] < WEAPONS[g].maxReserve);
    if (owned.length === 0) return 'pistol';
    return owned[Math.floor(rng() * owned.length)];
  }

  addItem(kind, n = 1) {
    const before = this.counts[kind];
    this.counts[kind] = Math.min(ITEM_MAX[kind], before + n);
    return this.counts[kind] - before;
  }

  useItem(kind) {
    if (this.counts[kind] <= 0) return false;
    this.counts[kind]--;
    this.ensureValid();
    return true;
  }

  canReload(id) {
    const w = WEAPONS[id];
    return !!w && w.mag !== undefined && this.mag[id] < w.mag && this.reserve[id] > 0;
  }

  reload(id) {
    const need = WEAPONS[id].mag - this.mag[id];
    const take = Math.min(need, this.reserve[id]);
    this.mag[id] += take;
    this.reserve[id] -= take;
    return take;
  }

  useAmmo(id) {
    if (this.mag[id] <= 0) return false;
    this.mag[id]--;
    return true;
  }
}
