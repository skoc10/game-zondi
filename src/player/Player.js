import * as THREE from 'three';
import { clamp, damp } from '../core/math.js';
import { applyPlayerDamage, PLAYER_TOUGHNESS } from '../core/combat.js';
import { MAP_HALF, PLAYER_START } from '../world/World.js';

const EYE = 1.65;
const RADIUS = 0.4;
const HEIGHT = 1.8;
const WALK = 5.2;
const SPRINT = 8.2;
const GRAVITY = 22;
const JUMP = 7.2;

export class Player {
  constructor(camera, collision, audio) {
    this.camera = camera;
    this.collision = collision;
    this.audio = audio;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.knock = new THREE.Vector3();
    this.flashlight = new THREE.SpotLight('#fff4d6', 0, 48, 0.42, 0.55, 1.1);
    this.flashlight.castShadow = true;
    this.flashlight.shadow.mapSize.set(1024, 1024);
    this.flashlight.shadow.camera.near = 0.3;
    this.flashlight.shadow.bias = -0.002;
    this.flashlight.position.set(0.2, -0.15, 0.1);
    this.flashlight.target.position.set(0, -0.3, -10);
    camera.add(this.flashlight);
    camera.add(this.flashlight.target);
    this.reset();
  }

  reset() {
    this.pos.set(PLAYER_START.x, 0, PLAYER_START.z);
    this.vel.set(0, 0, 0);
    this.knock.set(0, 0, 0);
    this.yaw = PLAYER_START.yaw;
    this.pitch = 0;
    this.health = 100;
    this.armor = 0;
    this.stamina = 1;
    this.alive = true;
    this.onGround = true;
    this.carryingGas = false;
    this.vehicle = null;
    this.flashOn = true;
    this.bobPhase = 0;
    this.bob = 0;
    this.hurt = 0;
    this.hurtDir = 0;
    this.kick = 0;
    this.deathTime = 0;
    this.speed = 0;
    this.lastStep = 0;
  }

  get eye() {
    return new THREE.Vector3(this.pos.x, this.pos.y + EYE, this.pos.z);
  }

  get center() {
    return new THREE.Vector3(this.pos.x, this.pos.y + 1, this.pos.z);
  }

  forward(out = new THREE.Vector3()) {
    const cp = Math.cos(this.pitch);
    return out.set(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp);
  }

  update(dt, s, night, shake) {
    if (!this.alive) {
      // Ölüm: kamera yere düşer
      this.deathTime += dt;
      const k = Math.min(1, this.deathTime / 0.8);
      this.camera.position.set(this.pos.x, this.pos.y + EYE - k * 1.35, this.pos.z);
      this.camera.rotation.set(this.pitch * (1 - k) - 0.2 * k, this.yaw, k * 1.2, 'YXZ');
      return;
    }
    this.yaw -= s.lookX;
    this.pitch = clamp(this.pitch - s.lookY, -1.5, 1.5);

    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    const fx = -sin;
    const fz = -cos;
    const rx = cos;
    const rz = -sin;
    const moving = s.moveX !== 0 || s.moveY !== 0;
    const wantSprint = s.sprint && moving && s.moveY > 0.2 && !this.carryingGas;
    const canSprint = wantSprint && this.stamina > 0.05;
    if (canSprint) this.stamina = Math.max(0, this.stamina - dt * 0.22);
    else this.stamina = Math.min(1, this.stamina + dt * (moving ? 0.12 : 0.25));
    let speed = canSprint ? SPRINT : WALK;
    if (this.carryingGas) speed *= 0.72;

    const tx = (fx * s.moveY + rx * s.moveX) * speed;
    const tz = (fz * s.moveY + rz * s.moveX) * speed;
    const accel = this.onGround ? 14 : 3;
    this.vel.x = damp(this.vel.x, tx, accel, dt);
    this.vel.z = damp(this.vel.z, tz, accel, dt);

    if (s.jump && this.onGround) {
      this.vel.y = JUMP;
      this.onGround = false;
      this.audio.play('jump', null, 0.8);
    }
    this.vel.y -= GRAVITY * dt;

    this.pos.x += (this.vel.x + this.knock.x) * dt;
    this.pos.z += (this.vel.z + this.knock.z) * dt;
    this.pos.y += this.vel.y * dt;
    this.knock.multiplyScalar(Math.max(0, 1 - 6 * dt));

    this.collision.resolveCircle(this.pos, RADIUS, HEIGHT);
    this.pos.x = clamp(this.pos.x, -MAP_HALF, MAP_HALF);
    this.pos.z = clamp(this.pos.z, -MAP_HALF, MAP_HALF);

    const ceil = this.collision.ceilingHeight(this.pos.x, this.pos.z, RADIUS, this.pos.y + HEIGHT);
    if (this.pos.y + HEIGHT > ceil && this.vel.y > 0) {
      this.pos.y = ceil - HEIGHT;
      this.vel.y = 0;
    }
    const ground = this.collision.groundHeight(this.pos.x, this.pos.z, RADIUS, this.pos.y);
    if (this.pos.y <= ground) {
      if (!this.onGround && this.vel.y < -4) this.audio.play('step', null, 1.5);
      this.pos.y = ground;
      this.vel.y = 0;
      this.onGround = true;
    } else if (this.pos.y > ground + 0.05) {
      this.onGround = false;
    }

    // Kafa sallanması ve adım sesleri
    this.speed = Math.hypot(this.vel.x, this.vel.z);
    if (this.onGround && this.speed > 0.5) {
      this.bobPhase += dt * this.speed * 1.7;
      if (Math.floor(this.bobPhase / Math.PI) !== this.lastStep) {
        this.lastStep = Math.floor(this.bobPhase / Math.PI);
        this.audio.play('step', null, canSprint ? 1.3 : 0.9);
      }
    }
    this.bob = damp(this.bob, this.onGround ? Math.min(1, this.speed / WALK) : 0, 10, dt);
    const by = Math.abs(Math.sin(this.bobPhase)) * 0.06 * this.bob;
    const bx = Math.cos(this.bobPhase) * 0.035 * this.bob;

    const sx = (Math.random() - 0.5) * shake * 0.3;
    const sy = (Math.random() - 0.5) * shake * 0.3;
    this.camera.position.set(this.pos.x + rx * bx, this.pos.y + EYE + by, this.pos.z + rz * bx);
    this.kick = damp(this.kick, 0, 14, dt);
    this.camera.rotation.set(this.pitch + this.kick + sy * 0.3, this.yaw + sx * 0.3, sx * 0.2, 'YXZ');

    this.flashlight.intensity = this.flashOn ? 2 + 70 * night : 0;
    this.hurt = Math.max(0, this.hurt - dt * 1.5);
  }

  takeDamage(amount, fromPos = null) {
    if (!this.alive || amount <= 0) return;
    amount /= PLAYER_TOUGHNESS;
    const r = applyPlayerDamage(this.health, this.armor, amount);
    this.health = r.health;
    this.armor = r.armor;
    this.hurt = Math.min(1, this.hurt + 0.35 + amount / 60);
    if (fromPos) {
      // Hasarın geldiği yön (HUD göstergesi için), kameraya göre
      const target = Math.atan2(-(fromPos.x - this.pos.x), -(fromPos.z - this.pos.z));
      this.hurtDir = target - this.yaw;
    }
    this.audio.play('hurt', null, 0.8);
    if (this.health <= 0) {
      this.alive = false;
      this.deathTime = 0;
    }
  }

  push(dx, dz, force) {
    const len = Math.hypot(dx, dz) || 1;
    this.knock.x += (dx / len) * force;
    this.knock.z += (dz / len) * force;
  }
}

export { EYE, RADIUS as PLAYER_RADIUS };
