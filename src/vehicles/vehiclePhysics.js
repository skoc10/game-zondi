// Araç hareketinin saf (Three.js'siz, test edilebilir) adımları.
// Durum: { x, y, z, yaw, speed, vy, pitch, roll, fuel, onGround, throttleSet }
// Kontrol: { throttle -1..1, steer -1..1 (artı = sağ), handbrake, ascend 0..1, descend 0..1, pitch -1..1 }

export const GRAVITY = 9.8;

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const toward = (v, target, rate) => (v < target ? Math.min(target, v + rate) : Math.max(target, v - rate));

// Ezme hasarı hızın karesiyle artar
export function ramDamage(speed, mult) {
  return mult * 0.6 * speed * speed;
}

// Tam gazda saniyede 1 birim; rölantide %30
export function fuelUse(throttle, dt) {
  return dt * (0.3 + 0.7 * Math.min(1, Math.abs(throttle)));
}

export function stepGround(st, c, spec, dt) {
  const hasFuel = st.fuel > 0;
  const thr = hasFuel ? c.throttle : 0;
  if (thr > 0.05) {
    st.speed += (st.speed < -0.2 ? spec.brake : spec.accel) * thr * dt;
  } else if (thr < -0.05) {
    st.speed += (st.speed > 0.2 ? spec.brake : spec.accel * 0.6) * thr * dt;
  } else {
    st.speed = toward(st.speed, 0, 3 * dt);
  }
  if (c.handbrake) st.speed = toward(st.speed, 0, spec.brake * 1.5 * dt);
  st.speed = clamp(st.speed, -spec.reverse, spec.maxSpeed);
  // Direksiyon: hız arttıkça etkili (tank yerinde döner)
  const steerGain = spec.pivot ? 1 : clamp(Math.abs(st.speed) / 6, 0, 1) * Math.sign(st.speed || 1);
  st.yaw -= c.steer * spec.turn * steerGain * dt;
  st.x += -Math.sin(st.yaw) * st.speed * dt;
  st.z += -Math.cos(st.yaw) * st.speed * dt;
  st.roll = -c.steer * clamp(Math.abs(st.speed) / spec.maxSpeed, 0, 1) * (spec.exposed ? 0.35 : 0.04);
  if (hasFuel) st.fuel = Math.max(0, st.fuel - fuelUse(thr, dt));
  return st;
}

export function stepHeli(st, c, spec, dt, groundY = 0) {
  const hasFuel = st.fuel > 0;
  // Yakıt biterse yavaşça alçalır (otorotasyon)
  const targetVy = hasFuel ? (c.ascend - c.descend) * spec.climb : -4;
  st.vy += (targetVy - st.vy) * Math.min(1, 2.5 * dt);
  const targetSpeed = st.onGround ? 0 : (hasFuel ? c.throttle : 0) * spec.maxSpeed;
  st.speed += (targetSpeed - st.speed) * Math.min(1, 1.2 * dt);
  if (!st.onGround) st.yaw -= c.steer * spec.turn * dt;
  st.y += st.vy * dt;
  if (st.y <= groundY) {
    st.y = groundY;
    if (st.vy < 0) st.vy = 0;
    st.onGround = true;
  } else if (st.y > groundY + 0.15) {
    st.onGround = false;
  }
  st.x += -Math.sin(st.yaw) * st.speed * dt;
  st.z += -Math.cos(st.yaw) * st.speed * dt;
  st.pitch = (-st.speed / spec.maxSpeed) * 0.25;
  st.roll = -c.steer * 0.2 * (st.onGround ? 0 : 1);
  if (hasFuel && (!st.onGround || c.ascend > 0)) st.fuel = Math.max(0, st.fuel - fuelUse(0.5 + 0.5 * Math.abs(c.throttle), dt));
  return st;
}

// Döndürür: { crashed } — sert inişte true
export function stepPlane(st, c, spec, dt, groundY = 0) {
  const hasFuel = st.fuel > 0;
  st.throttleSet = clamp((st.throttleSet || 0) + c.throttle * 0.6 * dt, 0, 1);
  if (!hasFuel) st.throttleSet = 0;
  const k = spec.accel / (spec.maxSpeed * spec.maxSpeed);
  const thrust = st.throttleSet * spec.accel;
  const drag = st.speed * st.speed * k + (st.onGround ? 0.4 : 0);
  st.speed = Math.max(0, st.speed + (thrust - drag - Math.sin(st.pitch) * GRAVITY) * dt);

  let crashed = false;
  if (st.onGround) {
    // Pistte: kalkış hızına kadar burun kalkmaz
    st.yaw -= c.steer * spec.turn * 0.6 * clamp(st.speed / 5, 0, 1) * dt;
    if (st.speed >= spec.takeoff && c.pitch > 0.1) {
      st.pitch = 0.12;
      st.onGround = false;
    } else {
      st.pitch = 0;
    }
    st.vy = 0;
    st.y = groundY;
  } else {
    st.pitch = clamp(st.pitch + c.pitch * spec.pitchRate * dt, -0.7, 0.6);
    st.yaw -= c.steer * spec.turn * dt;
    if (st.speed < spec.minSpeed) {
      // Stall: burun düşer, uçak çöker
      st.pitch = Math.max(-0.7, st.pitch - 0.6 * dt);
      st.vy = Math.sin(st.pitch) * st.speed - (spec.minSpeed - st.speed) * 0.9;
    } else {
      st.vy = Math.sin(st.pitch) * st.speed;
    }
    st.y += st.vy * dt;
    if (st.y <= groundY) {
      st.y = groundY;
      // Yumuşak iniş: düşük düşüş hızı ve burun fazla aşağıda değil
      if (st.vy < -6 || st.pitch < -0.3) crashed = true;
      st.onGround = true;
      st.vy = 0;
      st.pitch = 0;
    }
  }
  st.roll = -c.steer * (st.onGround ? 0.02 : 0.6);
  const h = Math.cos(st.pitch) * st.speed;
  st.x += -Math.sin(st.yaw) * h * dt;
  st.z += -Math.cos(st.yaw) * h * dt;
  if (hasFuel) st.fuel = Math.max(0, st.fuel - fuelUse(st.throttleSet, dt));
  return { crashed };
}
