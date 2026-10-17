// Tüm dünya eksen hizalı kutulardan (AABB) oluşur; çarpışma ve ışın testleri burada.

export function makeBox(minX, minY, minZ, maxX, maxY, maxZ, data = null) {
  return { minX, minY, minZ, maxX, maxY, maxZ, data };
}

// Alt-merkez konum + boyut ile kutu
export function boxFromBase(x, y, z, w, h, d, data = null) {
  return makeBox(x - w / 2, y, z - d / 2, x + w / 2, y + h, z + d / 2, data);
}

// Slab yöntemi; isabet varsa mesafe (t), yoksa Infinity. Yön birim vektör olmalı.
export function rayAABB(ox, oy, oz, dx, dy, dz, b, maxT = Infinity) {
  let tmin = 0;
  let tmax = maxT;
  const o = [ox, oy, oz];
  const d = [dx, dy, dz];
  const mn = [b.minX, b.minY, b.minZ];
  const mx = [b.maxX, b.maxY, b.maxZ];
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-9) {
      if (o[i] < mn[i] || o[i] > mx[i]) return Infinity;
    } else {
      const inv = 1 / d[i];
      let t1 = (mn[i] - o[i]) * inv;
      let t2 = (mx[i] - o[i]) * inv;
      if (t1 > t2) [t1, t2] = [t2, t1];
      if (t1 > tmin) tmin = t1;
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return Infinity;
    }
  }
  return tmin;
}

export function pointInBox(x, y, z, b, pad = 0) {
  return (
    x >= b.minX - pad && x <= b.maxX + pad &&
    y >= b.minY - pad && y <= b.maxY + pad &&
    z >= b.minZ - pad && z <= b.maxZ + pad
  );
}

const CELL = 16;
const OFF = 4096;
const cellKey = (ix, iz) => (ix + OFF) * 8192 + (iz + OFF);

// Kutular 16 m'lik hücrelere dağıtılır; sorgular sadece yakın hücrelere bakar.
export class CollisionWorld {
  constructor() {
    this.boxes = [];
    this.grid = new Map();
    this.stamp = 0;
  }

  add(box) {
    this.boxes.push(box);
    box._cells = [];
    box._stamp = 0;
    const x0 = Math.floor(box.minX / CELL);
    const x1 = Math.floor(box.maxX / CELL);
    const z0 = Math.floor(box.minZ / CELL);
    const z1 = Math.floor(box.maxZ / CELL);
    for (let ix = x0; ix <= x1; ix++) {
      for (let iz = z0; iz <= z1; iz++) {
        const k = cellKey(ix, iz);
        let list = this.grid.get(k);
        if (!list) {
          list = [];
          this.grid.set(k, list);
        }
        list.push(box);
        box._cells.push(list);
      }
    }
    return box;
  }

  remove(box) {
    const i = this.boxes.indexOf(box);
    if (i < 0) return;
    this.boxes.splice(i, 1);
    for (const list of box._cells) {
      const j = list.indexOf(box);
      if (j >= 0) list.splice(j, 1);
    }
    box._cells = [];
  }

  // Dikdörtgen alana dokunan kutuları birer kez ziyaret eder
  query(minX, minZ, maxX, maxZ, fn) {
    const st = ++this.stamp;
    const x0 = Math.floor(minX / CELL);
    const x1 = Math.floor(maxX / CELL);
    const z0 = Math.floor(minZ / CELL);
    const z1 = Math.floor(maxZ / CELL);
    for (let ix = x0; ix <= x1; ix++) {
      for (let iz = z0; iz <= z1; iz++) {
        const list = this.grid.get(cellKey(ix, iz));
        if (!list) continue;
        for (let n = 0; n < list.length; n++) {
          const b = list[n];
          if (b._stamp === st) continue;
          b._stamp = st;
          fn(b);
        }
      }
    }
  }

  // Dikey silindiri (ayak y, yükseklik h, yarıçap r) kutulardan dışarı iter. pos değiştirilir.
  resolveCircle(pos, radius, height) {
    let hit = false;
    this.query(pos.x - radius, pos.z - radius, pos.x + radius, pos.z + radius, (b) => {
      if (pos.y >= b.maxY - 0.01 || pos.y + height <= b.minY) return;
      const cx = Math.max(b.minX, Math.min(pos.x, b.maxX));
      const cz = Math.max(b.minZ, Math.min(pos.z, b.maxZ));
      const dx = pos.x - cx;
      const dz = pos.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= radius * radius) return;
      hit = true;
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2);
        const push = radius - d;
        pos.x += (dx / d) * push;
        pos.z += (dz / d) * push;
      } else {
        // Merkez kutunun içinde: en kısa eksenden dışarı çıkar
        const pl = pos.x - b.minX + radius;
        const pr = b.maxX - pos.x + radius;
        const pb = pos.z - b.minZ + radius;
        const pf = b.maxZ - pos.z + radius;
        const m = Math.min(pl, pr, pb, pf);
        if (m === pl) pos.x -= pl;
        else if (m === pr) pos.x += pr;
        else if (m === pb) pos.z -= pb;
        else pos.z += pf;
      }
    });
    return hit;
  }

  // Ayak seviyesinin hemen altındaki/üstündeki (adım yüksekliği kadar) en yüksek zemin
  groundHeight(x, z, radius, feetY, step = 0.45) {
    let h = 0;
    this.query(x - radius, z - radius, x + radius, z + radius, (b) => {
      if (b.maxY > feetY + step || b.maxY <= h) return;
      const cx = Math.max(b.minX, Math.min(x, b.maxX));
      const cz = Math.max(b.minZ, Math.min(z, b.maxZ));
      const dx = x - cx;
      const dz = z - cz;
      if (dx * dx + dz * dz < radius * radius * 0.5) h = b.maxY;
    });
    return h;
  }

  // Başın üstündeki tavan (zıplarken kafa çarpması)
  ceilingHeight(x, z, radius, headY) {
    let c = Infinity;
    this.query(x - radius, z - radius, x + radius, z + radius, (b) => {
      if (b.minY < headY - 0.3 || b.minY >= c) return;
      const cx = Math.max(b.minX, Math.min(x, b.maxX));
      const cz = Math.max(b.minZ, Math.min(z, b.maxZ));
      const dx = x - cx;
      const dz = z - cz;
      if (dx * dx + dz * dz < radius * radius * 0.5) c = b.minY;
    });
    return c;
  }

  // En yakın kutu isabeti: { t, box, ground } ya da null. Hücreler ışın boyunca (DDA) taranır.
  raycast(ox, oy, oz, dx, dy, dz, maxT = 200, filter = null) {
    let best = maxT;
    let bestBox = null;
    const st = ++this.stamp;
    const test = (list) => {
      for (let n = 0; n < list.length; n++) {
        const b = list[n];
        if (b._stamp === st) continue;
        b._stamp = st;
        if (filter && !filter(b)) continue;
        const t = rayAABB(ox, oy, oz, dx, dy, dz, b, best);
        if (t < best) {
          best = t;
          bestBox = b;
        }
      }
    };
    let ix = Math.floor(ox / CELL);
    let iz = Math.floor(oz / CELL);
    const stepX = dx > 0 ? 1 : -1;
    const stepZ = dz > 0 ? 1 : -1;
    const tDX = Math.abs(dx) > 1e-9 ? CELL / Math.abs(dx) : Infinity;
    const tDZ = Math.abs(dz) > 1e-9 ? CELL / Math.abs(dz) : Infinity;
    let tMX = Math.abs(dx) > 1e-9 ? ((dx > 0 ? (ix + 1) * CELL - ox : ox - ix * CELL) / Math.abs(dx)) : Infinity;
    let tMZ = Math.abs(dz) > 1e-9 ? ((dz > 0 ? (iz + 1) * CELL - oz : oz - iz * CELL) / Math.abs(dz)) : Infinity;
    let tCell = 0;
    for (let guard = 0; guard < 512 && tCell <= best; guard++) {
      const list = this.grid.get(cellKey(ix, iz));
      if (list) test(list);
      if (tMX < tMZ) {
        tCell = tMX;
        tMX += tDX;
        ix += stepX;
      } else {
        tCell = tMZ;
        tMZ += tDZ;
        iz += stepZ;
      }
      if (tCell === Infinity) break;
    }
    // Zemin düzlemi
    if (dy < -1e-6) {
      const tg = -oy / dy;
      if (tg >= 0 && tg < best) return { t: tg, box: null, ground: true };
    }
    return bestBox ? { t: best, box: bestBox, ground: false } : null;
  }

  // İki nokta arasında görüş var mı?
  lineOfSight(ax, ay, az, bx, by, bz) {
    const dx = bx - ax;
    const dy = by - ay;
    const dz = bz - az;
    const len = Math.hypot(dx, dy, dz);
    if (len < 1e-6) return true;
    const hit = this.raycast(ax, ay, az, dx / len, dy / len, dz / len, len - 0.05);
    return !hit || hit.t >= len - 0.05;
  }

  blockedAt(x, z, radius, height = 1.8) {
    let blocked = false;
    this.query(x - radius, z - radius, x + radius, z + radius, (b) => {
      if (blocked || b.minY > height || b.maxY < 0.05) return;
      if (x + radius > b.minX && x - radius < b.maxX && z + radius > b.minZ && z - radius < b.maxZ) blocked = true;
    });
    return blocked;
  }
}
