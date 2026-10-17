import { describe, it, expect } from 'vitest';
import { DEFEND_TIME, SPACE_GRAVITY, launchStage, defenseWave, queenPhase, PHASE_CRYSTALS, jumpHeight, roomCleared } from '../src/levels/spaceLogic.js';

describe('4. bölüm: roket üssü', () => {
  it('aşamalar sırayla ilerler', () => {
    expect(launchStage({ started: false, defendLeft: DEFEND_TIME, boarded: false })).toBe('reach');
    expect(launchStage({ started: true, defendLeft: 30, boarded: false })).toBe('defend');
    expect(launchStage({ started: true, defendLeft: 0, boarded: false })).toBe('board');
    expect(launchStage({ started: true, defendLeft: 0, boarded: true })).toBe('launch');
  });

  it('savunma dalgaları sayım ilerledikçe sıklaşır ve büyür', () => {
    const early = defenseWave(DEFEND_TIME);
    const late = defenseWave(1);
    expect(late.interval).toBeLessThan(early.interval);
    expect(late.count).toBeGreaterThan(early.count);
  });
});

describe('4. bölüm: uzay istasyonu', () => {
  it('düşük yerçekiminde zıplama 3 kattan fazla yüksek', () => {
    expect(jumpHeight(7.2, SPACE_GRAVITY)).toBeGreaterThan(jumpHeight(7.2, 22) * 3);
    expect(jumpHeight(7.2, SPACE_GRAVITY)).toBeLessThan(4.2); // koridor tavanı 4 m + baş payı
  });

  it('Kraliçe üç aşamalı: kristalli kalkan, yeni kalkan, öfke', () => {
    expect(queenPhase(1)).toBe(1);
    expect(queenPhase(0.7)).toBe(1);
    expect(queenPhase(0.6)).toBe(2);
    expect(queenPhase(0.3)).toBe(3);
    expect(PHASE_CRYSTALS[1]).toBeGreaterThan(0);
    expect(PHASE_CRYSTALS[2]).toBeGreaterThan(PHASE_CRYSTALS[1]);
    expect(PHASE_CRYSTALS[3]).toBe(0);
  });

  it('bölme ancak tüm düşmanlar ölünce temizlenir', () => {
    expect(roomCleared([])).toBe(false);
    expect(roomCleared([{ alive: false }, { alive: true }])).toBe(false);
    expect(roomCleared([{ alive: false }, { alive: false }])).toBe(true);
  });
});
