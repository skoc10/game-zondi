// Araç hareketinin saf (Three.js'siz, test edilebilir) adımları.
// Durum: { x, y, z, yaw, speed, vy, pitch, roll, fuel, onGround, throttleSet }
// Kontrol: { throttle -1..1, steer -1..1 (artı = sağ), handbrake, ascend 0..1, descend 0..1, pitch -1..1 }

export const GRAVITY = 9.8;

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const toward = (v, target, rate) => (v < target ? Math.min(target, v + rate) : Math.max(target, v - rate));

function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// Vites taklidi: hız oranına göre vites ve o vitesteki devir (0..1)
export function gearAndRpm(speed, spec, throttle = 0) {
  const gears = spec.gears || 4;
  const frac = clamp(Math.abs(speed) / spec.maxSpeed, 0, 1);
  if (frac < 0.02) return { gear: 1, rpm: 0.15 + Math.abs(throttle) * 0.25 };
  const pos = frac * gears;
  const gear = Math.min(gears, Math.floor(pos) + 1);
  const inGear = gear === gears ? pos - (gears - 1) : pos - (gear - 1);
  return { gear, rpm: clamp(0.3 + inGear * 0.7, 0, 1) };
}

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
  // Direksiyon ve gaz yumuşak geçişli; bırakınca direksiyon ortalanır
  st.steerSm = toward(st.steerSm || 0, c.steer, (Math.abs(c.steer) < 0.05 ? 4 : 2.8) * dt);
  st.thrSm = toward(st.thrSm || 0, hasFuel ? c.throttle : 0, 4 * dt);
  const thr = st.thrSm;
  const before = st.speed;
  if (thr > 0.05) {
    st.speed += (st.speed < -0.2 ? spec.brake : spec.accel) * thr * dt;
  } else if (thr < -0.05) {
    st.speed += (st.speed > 0.2 ? spec.brake : spec.accel * 0.6) * thr * dt;
  } else {
    st.speed = toward(st.speed, 0, 3 * dt);
  }
  if (c.handbrake) st.speed = toward(st.speed, 0, spec.brake * 1.2 * dt);
  st.speed = clamp(st.speed, -spec.reverse, spec.maxSpeed);
  // Hız arttıkça direksiyon azalır (tank yerinde döner)
  const frac = clamp(Math.abs(st.speed) / spec.maxSpeed, 0, 1);
  const steerGain = spec.pivot ? 1 : clamp(Math.abs(st.speed) / 6, 0, 1) * (1 - 0.45 * frac) * Math.sign(st.speed || 1);
  const handbrakeTurn = c.handbrake && !spec.pivot ? 1.6 : 1;
  st.yaw -= st.steerSm * spec.turn * steerGain * handbrakeTurn * dt;
  // Kayma: hareket yönü burnu tutuş oranıyla takip eder; el freni tutuşu düşürür
  if (st.moveYaw === undefined) st.moveYaw = st.yaw;
  const grip = (spec.grip || 8) * (c.handbrake ? 0.18 : 1);
  st.moveYaw += angleDiff(st.moveYaw, st.yaw) * Math.min(1, grip * dt);
  st.x += -Math.sin(st.moveYaw) * st.speed * dt;
  st.z += -Math.cos(st.moveYaw) * st.speed * dt;
  // Gövde: hızlanınca burun kalkar, frenlenince eğilir; motosiklet virajda yatar
  const accel = (st.speed - before) / Math.max(dt, 1e-4);
  st.pitch += (clamp(accel * 0.005 * Math.sign(st.speed || 1), -0.06, 0.06) - st.pitch) * Math.min(1, 6 * dt);
  const lean = spec.exposed ? 0.45 : 0.05;
  st.roll += (-st.steerSm * frac * lean - st.roll) * Math.min(1, 6 * dt);
  const gr = gearAndRpm(st.speed, spec, thr);
  st.gear = gr.gear;
  st.rpm = gr.rpm;
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
  // Dönüş hızı ataletli
  st.yawRate = toward(st.yawRate || 0, st.onGround ? 0 : -c.steer * spec.turn, 3 * dt);
  st.yaw += st.yawRate * dt;
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
  st.pitch += ((-st.speed / spec.maxSpeed) * 0.25 - st.pitch) * Math.min(1, 3 * dt);
  st.roll += ((st.yawRate || 0) * 0.15 - st.roll) * Math.min(1, 3 * dt);
  st.rpm = clamp(0.4 + Math.abs(st.speed) / spec.maxSpeed * 0.4 + Math.max(0, st.vy) / spec.climb * 0.2, 0, 1);
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
    // Yunuslama yumuşak; dönüş yatıştan doğar (koordineli dönüş), bırakınca kendi düzelir
    st.pitchRate = toward(st.pitchRate || 0, c.pitch * spec.pitchRate, 3 * dt);
    st.pitch = clamp(st.pitch + st.pitchRate * dt, -0.7, 0.6);
    const bankTarget = c.steer * 0.85;
    st.bank = toward(st.bank || 0, bankTarget, (Math.abs(c.steer) < 0.05 ? 0.9 : 1.6) * dt);
    st.yaw -= (GRAVITY * Math.tan(st.bank) / Math.max(st.speed, 12)) * spec.turn * 1.6 * dt;
    if (st.speed < spec.minSpeed) {
      // Stall: burun düşer, uçak çöker
      st.pitch = Math.max(-0.7, st.pitch - 0.6 * dt);
      st.vy = Math.sin(st.pitch) * st.speed - (spec.minSpeed - st.speed) * 0.9;
    } else {
      // Yatışta biraz irtifa kaybı
      st.vy = Math.sin(st.pitch) * st.speed - (1 - Math.cos(st.bank)) * 4;
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
  if (st.onGround) st.bank = toward(st.bank || 0, 0, 2 * dt);
  st.roll = -(st.bank || 0);
  st.rpm = clamp(0.2 + st.throttleSet * 0.6 + st.speed / spec.maxSpeed * 0.2, 0, 1);
  const h = Math.cos(st.pitch) * st.speed;
  st.x += -Math.sin(st.yaw) * h * dt;
  st.z += -Math.cos(st.yaw) * h * dt;
  if (hasFuel) st.fuel = Math.max(0, st.fuel - fuelUse(st.throttleSet, dt));
  return { crashed };
}
