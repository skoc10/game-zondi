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

export class CollisionWorld {
  constructor() {
    this.boxes = [];
  }

  add(box) {
    this.boxes.push(box);
    return box;
  }

  remove(box) {
    const i = this.boxes.indexOf(box);
    if (i >= 0) this.boxes.splice(i, 1);
  }

  // Dikey silindiri (ayak y, yükseklik h, yarıçap r) kutulardan dışarı iter. pos değiştirilir.
  resolveCircle(pos, radius, height) {
    let hit = false;
    for (const b of this.boxes) {
      if (pos.y >= b.maxY - 0.01 || pos.y + height <= b.minY) continue;
      const cx = Math.max(b.minX, Math.min(pos.x, b.maxX));
      const cz = Math.max(b.minZ, Math.min(pos.z, b.maxZ));
      const dx = pos.x - cx;
      const dz = pos.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= radius * radius) continue;
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
    }
    return hit;
  }

  // Ayak seviyesinin hemen altındaki/üstündeki (adım yüksekliği kadar) en yüksek zemin
  groundHeight(x, z, radius, feetY, step = 0.45) {
    let h = 0;
    for (const b of this.boxes) {
      if (b.maxY > feetY + step || b.maxY <= h) continue;
      const cx = Math.max(b.minX, Math.min(x, b.maxX));
      const cz = Math.max(b.minZ, Math.min(z, b.maxZ));
      const dx = x - cx;
      const dz = z - cz;
      if (dx * dx + dz * dz < radius * radius * 0.5) h = b.maxY;
    }
    return h;
  }

  // Başın üstündeki tavan (zıplarken kafa çarpması)
  ceilingHeight(x, z, radius, headY) {
    let c = Infinity;
    for (const b of this.boxes) {
      if (b.minY < headY - 0.3 || b.minY >= c) continue;
      const cx = Math.max(b.minX, Math.min(x, b.maxX));
      const cz = Math.max(b.minZ, Math.min(z, b.maxZ));
      const dx = x - cx;
      const dz = z - cz;
      if (dx * dx + dz * dz < radius * radius * 0.5) c = b.minY;
    }
    return c;
  }

  // En yakın kutu isabeti: { t, box } ya da null
  raycast(ox, oy, oz, dx, dy, dz, maxT = 200, filter = null) {
    let best = maxT;
    let bestBox = null;
    for (const b of this.boxes) {
      if (filter && !filter(b)) continue;
      const t = rayAABB(ox, oy, oz, dx, dy, dz, b, best);
      if (t < best) {
        best = t;
        bestBox = b;
      }
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
    for (const b of this.boxes) {
      if (b.minY > height || b.maxY < 0.05) continue;
      if (x + radius > b.minX && x - radius < b.maxX && z + radius > b.minZ && z - radius < b.maxZ) return true;
    }
    return false;
  }
}
