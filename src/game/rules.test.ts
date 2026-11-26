import { describe, expect, it } from 'vitest';
import { evaluateShot, newGame, type GameState } from './rules';

const all = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);

function afterBreak(): GameState {
  return { ...newGame(), isBreak: false, ballInHand: false, kitchenOnly: false };
}

describe('8-ball rules', () => {
  it('a scratch on the break gives the opponent ball in hand', () => {
    const { state, action } = evaluateShot(newGame(), { firstHit: 1, potted: [0] }, all);
    expect(action).toBe('switch');
    expect(state.current).toBe(1);
    expect(state.ballInHand).toBe(true);
  });

  it('the 8 on the break re-racks', () => {
    const { action, state } = evaluateShot(newGame(), { firstHit: 1, potted: [8] }, all);
    expect(action).toBe('rerack');
    expect(state.isBreak).toBe(true);
  });

  it('the first pot on an open table assigns groups', () => {
    const { state, action } = evaluateShot(afterBreak(), { firstHit: 11, potted: [11] }, all);
    expect(action).toBe('continue');
    expect(state.groups).toEqual(['stripes', 'solids']);
  });

  it('hitting the wrong group first is a foul', () => {
    const s: GameState = { ...afterBreak(), groups: ['solids', 'stripes'] };
    const { state, action } = evaluateShot(s, { firstHit: 12, potted: [3] }, all);
    expect(action).toBe('switch');
    expect(state.ballInHand).toBe(true);
    expect(state.current).toBe(1);
  });

  it('pocketing the 8 early loses', () => {
    const s: GameState = { ...afterBreak(), groups: ['solids', 'stripes'] };
    const { state, action } = evaluateShot(s, { firstHit: 2, potted: [8] }, all);
    expect(action).toBe('gameover');
    expect(state.winner).toBe(1);
  });

  it('pocketing the 8 after clearing the group wins', () => {
    const s: GameState = { ...afterBreak(), groups: ['solids', 'stripes'] };
    const left = new Set([8, 9, 10]);
    const { state, action } = evaluateShot(s, { firstHit: 8, potted: [8] }, left);
    expect(action).toBe('gameover');
    expect(state.winner).toBe(0);
  });

  it('scratching on the 8 loses even when the group is cleared', () => {
    const s: GameState = { ...afterBreak(), groups: ['solids', 'stripes'] };
    const { state } = evaluateShot(s, { firstHit: 8, potted: [8, 0] }, new Set([8]));
    expect(state.winner).toBe(1);
  });
});
