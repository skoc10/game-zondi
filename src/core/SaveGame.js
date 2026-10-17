import { destroyPylon } from '../world/facility.js';

// Bölüm içi kayıt: oyuncu, envanter, zombiler, araçlar, yerdeki eşyalar, kırılan nesneler ve görev durumu.
// Tek kayıt yuvası; bölüm kazanılınca silinir.
const KEY = 'zondi-kayit';
export const SAVE_VERSION = 1;
// Kayıttan dönülünce can en az bu kadar olur (ölüm döngüsü olmasın)
export const RESPAWN_MIN_HEALTH = 50;

export function loadSave(storage = globalThis.localStorage) {
  try {
    const raw = storage && storage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d || d.v !== SAVE_VERSION || !Number.isInteger(d.level) || d.level < 1 || d.level > 4) return null;
    if (!d.player || !Number.isFinite(d.player.x) || !Number.isFinite(d.player.z)) return null;
    return d;
  } catch {
    return null;
  }
}

export function writeSave(data, storage = globalThis.localStorage) {
  try {
    if (!storage) return false;
    storage.setItem(KEY, JSON.stringify({ ...data, v: SAVE_VERSION }));
    return true;
  } catch {
    return false;
  }
}

export function clearSave(storage = globalThis.localStorage) {
  try {
    if (storage) storage.removeItem(KEY);
  } catch {
    // yok say
  }
}

// Kayıt bu bölüme mi ait
export function saveMatches(save, level, sub) {
  return !!save && save.level === level && (save.sub || null) === (sub || null);
}

export function respawnHealth(saved) {
  return Math.max(RESPAWN_MIN_HEALTH, Math.min(100, Number.isFinite(saved) ? saved : 100));
}

// Kaydedilemiyorsa nedeni, kaydedilebiliyorsa null
export function saveBlockReason(g) {
  if (g.state !== 'playing') return 'Şu an kaydedilemez';
  if (!g.player.alive) return 'Ölüyken kaydedilemez';
  if (g.deadChild) return 'Şu an kaydedilemez';
  const v = g.player.vehicle;
  if (v && v.isAir) {
    const st = v.state;
    const ground = g.collision.groundHeight(st.x, st.z, 1.2, st.y + 0.01, 0.5);
    if (st.y - ground > 1 || Math.abs(st.speed) > 3) return 'Havadayken kaydedilemez — önce in';
  }
  if (g.mission && g.mission.saveBlock) return g.mission.saveBlock();
  return null;
}

const round = (v) => Math.round(v * 100) / 100;

export function captureSave(g) {
  const p = g.player;
  const w = g.world;
  const alive = (list) => list.map((o, i) => (o.alive ? -1 : i)).filter((i) => i >= 0);
  return {
    level: g.level,
    sub: g.sub || null,
    savedAt: Date.now(),
    player: {
      x: round(p.pos.x), y: round(p.pos.y), z: round(p.pos.z), yaw: round(p.yaw), pitch: round(p.pitch),
      health: p.health, armor: p.armor, flashOn: !!p.flashOn, carryingGas: !!p.carryingGas,
      vehicle: p.vehicle ? g.vehicles.list.indexOf(p.vehicle) : -1,
    },
    inventory: g.inventory.serialize(),
    time: g.dayNight.time,
    wasNight: g.wasNight,
    nights: g.nights,
    gasDelivered: g.gasDelivered,
    stats: { ...g.stats },
    spawnerElapsed: g.spawner.elapsed,
    world: {
      barrels: alive(w.barrels),
      crates: alive(w.crates),
      barricades: alive(w.barricades),
      pylons: (w.pylons || []).map((py) => ({ x: round(py.pos.x), z: round(py.pos.z), hp: py.hp, alive: py.alive })),
    },
    zombies: g.zombies.list.filter((z) => z.alive).map((z) => ({
      t: z.typeKey, x: round(z.pos.x), z: round(z.pos.z), yaw: round(z.yaw),
      hp: z.health, armor: z.armor, helmet: z.helmet, weapon: z.weapon || null, tag: z.tag || null, spawned: !!z.spawned,
    })),
    pickups: g.pickups.list.map((pk) => ({
      type: pk.type, x: round(pk.pos.x), z: round(pk.pos.z), weapon: pk.weapon, ammo: pk.ammo, spot: pk.spot,
    })),
    vehicles: g.vehicles.list.map((v) => ({
      x: round(v.state.x), y: round(v.state.y), z: round(v.state.z), yaw: round(v.state.yaw),
      fuel: v.state.fuel, hp: v.hp, alive: v.alive,
    })),
    mission: g.mission && g.mission.saveState ? g.mission.saveState() : null,
  };
}

// buildScene(level, sub) sonrası çağrılır; görev start() yerine bu durum yüklenir
export function applySave(g, d) {
  const p = g.player;
  const w = g.world;
  g.inventory.restore(d.inventory);
  p.health = respawnHealth(d.player.health);
  p.armor = Math.max(0, Math.min(100, d.player.armor || 0));
  p.pos.set(d.player.x, d.player.y || 0, d.player.z);
  p.yaw = d.player.yaw || 0;
  p.pitch = d.player.pitch || 0;
  p.flashOn = !!d.player.flashOn;
  p.carryingGas = !!d.player.carryingGas;
  if (Number.isFinite(d.time)) g.dayNight.time = d.time;
  g.wasNight = !!d.wasNight;
  g.nights = d.nights || 0;
  g.gasDelivered = d.gasDelivered || 0;
  if (d.stats) Object.assign(g.stats, d.stats);
  if (Number.isFinite(d.spawnerElapsed)) g.spawner.elapsed = d.spawnerElapsed;

  // Dünya: patlayan variller, kırılan sandık ve barikatlar, yıkılan direkler
  const ws = d.world || {};
  for (const i of ws.barrels || []) if (w.barrels[i]) w.removeBarrel(w.barrels[i]);
  for (const i of ws.crates || []) if (w.crates[i]) w.removeCrate(w.crates[i]);
  for (const i of ws.barricades || []) if (w.barricades[i] && w.barricades[i].alive) w.removeBarricade(w.barricades[i]);
  if (w.addCrystalPylon) {
    // Uzayda kristaller görevle oluşur: sadece ayakta olanlar geri gelir
    for (const s of ws.pylons || []) if (s.alive) w.addCrystalPylon(s.x, s.z).hp = s.hp;
  } else {
    (ws.pylons || []).forEach((s, i) => {
      const py = (w.pylons || [])[i];
      if (!py) return;
      py.hp = s.hp;
      if (!s.alive) destroyPylon(w, py);
    });
  }

  // Yerdeki eşyalar
  g.pickups.clear();
  for (const pk of d.pickups || []) {
    const data = {};
    if (pk.weapon) data.weapon = pk.weapon;
    if (pk.ammo !== undefined) data.ammo = pk.ammo;
    if (pk.spot !== undefined) data.spot = pk.spot;
    g.pickups.spawn(pk.type, pk.x, pk.z, data);
  }

  // Zombiler (ve bilim insanları, uzaylılar)
  for (const z of g.zombies.list) g.scene.remove(z.mesh);
  g.zombies.list = [];
  for (const s of d.zombies || []) {
    const z = g.zombies.spawn(s.t, s.x, s.z, { weapon: s.weapon || undefined, spawned: s.spawned });
    if (Number.isFinite(s.hp)) z.health = Math.min(z.maxHealth, s.hp);
    if (Number.isFinite(s.armor)) z.armor = s.armor;
    if (Number.isFinite(s.helmet)) z.helmet = s.helmet;
    if (z.helmetMesh && z.helmet <= 0) z.helmetMesh.visible = false;
    if (z.vestMesh && z.armor <= 0) z.vestMesh.visible = false;
    z.yaw = s.yaw || 0;
    z.tag = s.tag || null;
  }

  // Araçlar (liste sırası her kurulumda aynı)
  (d.vehicles || []).forEach((s, i) => {
    const v = g.vehicles.list[i];
    if (!v) return;
    Object.assign(v.state, { x: s.x, y: s.y || 0, z: s.z, yaw: s.yaw, fuel: s.fuel, speed: 0, vy: 0, pitch: 0, roll: 0, onGround: true });
    v.hp = s.hp;
    v.syncMesh();
    if (s.alive) g.vehicles.park(v);
    else g.vehicles.wreck(v);
  });

  if (g.mission && g.mission.restoreState) g.mission.restoreState(d.mission || {});
  const vi = d.player.vehicle;
  const v = vi >= 0 ? g.vehicles.list[vi] : null;
  if (v && v.alive) g.vehicles.enter(v);
}
