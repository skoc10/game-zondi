// Sürülebilir araç tablosu. İleri yön -Z, yaw oyuncuyla aynı (artı = sola dönüş).
export const VEHICLE_TYPES = {
  motorcycle: {
    name: 'Motosiklet', seats: 1, enter: 'Motosiklete bin', kind: 'ground',
    maxSpeed: 28, reverse: 5, accel: 13, brake: 26, turn: 2.6,
    hp: 120, fuel: 120, ram: 0.4, exposed: true, armor: 1, grip: 7, gears: 5,
    length: 2.1, width: 0.8, height: 1.3, seat: [0, 0.55, 0.25], cam: [5, 2.2],
  },
  jeep: {
    name: 'Askeri cip', seats: 3, enter: 'Cipe bin', kind: 'ground',
    maxSpeed: 22, reverse: 8, accel: 10, brake: 22, turn: 2.0,
    hp: 300, fuel: 150, ram: 1.0, armor: 1, grip: 6, gears: 4,
    length: 4.2, width: 2.0, height: 1.9, seat: [-0.45, 0.75, 0.2], cam: [8, 3.2],
  },
  pickup: {
    name: 'Pikap', seats: 3, enter: 'Pikaba bin', kind: 'ground',
    maxSpeed: 18, reverse: 7, accel: 8, brake: 20, turn: 1.8,
    hp: 400, fuel: 180, ram: 1.2, armor: 0.9, grip: 5, gears: 4,
    length: 5.0, width: 2.1, height: 2.0, seat: [-0.45, 0.8, -0.3], cam: [9, 3.4],
  },
  sedan: {
    name: 'Mavi araba', seats: 3, enter: 'Arabaya bin', kind: 'ground',
    maxSpeed: 24, reverse: 8, accel: 11, brake: 22, turn: 2.0,
    hp: 350, fuel: 200, ram: 1.0, armor: 0.9, grip: 6, gears: 5,
    length: 4.4, width: 2.0, height: 1.8, seat: [-0.45, 0.75, 0.3], cam: [8.5, 3.2],
  },
  tank: {
    name: 'Tank', seats: 2, enter: 'Tanka bin', kind: 'ground',
    maxSpeed: 8, reverse: 5, accel: 5, brake: 12, turn: 1.0, pivot: true,
    hp: 1500, fuel: 240, ram: 3, crush: true, armor: 0.1, grip: 20, gears: 2,
    length: 7, width: 3.4, height: 2.6, seat: [0, 2.2, 0.6], cam: [13, 5.5],
    cannon: { interval: 2, radius: 7, damage: 260, speed: 48 },
  },
  heli: {
    name: 'Helikopter', seats: 3, enter: 'Helikoptere bin', kind: 'heli',
    maxSpeed: 22, accel: 8, climb: 7, turn: 1.6,
    hp: 350, fuel: 150, ram: 0, armor: 0.6,
    length: 9, width: 2.4, height: 3, seat: [0, 0.9, -1.2], cam: [14, 5],
    gun: { interval: 0.1, damage: 30, spread: 0.025, range: 160 },
    bomb: { interval: 0.8, radius: 6.5, damage: 200 },
  },
  plane: {
    name: 'Uçak', seats: 0, enter: 'Uçağa bin', kind: 'plane',
    maxSpeed: 45, minSpeed: 20, takeoff: 25, accel: 9, pitchRate: 0.9, turn: 0.75,
    hp: 250, fuel: 150, ram: 0, armor: 0.7,
    length: 8, width: 10, height: 2.6, seat: [0, 1.3, -0.6], cam: [17, 5],
    bomb: { interval: 0.6, radius: 7, damage: 220 },
  },
};
