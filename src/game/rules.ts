// Simplified 8-ball rules for two local players.
// - The break is legal unless the cue ball is pocketed. Pocketing the 8 on the break re-racks.
// - The table stays open until someone pockets an object ball after the break.
// - Fouls: scratching, hitting nothing, or hitting a ball outside your group first
//   (or the 8 first while the table is open). A foul gives the opponent ball in hand.
// - Pocketing the 8 wins only once your group is cleared and the shot is not a foul.

export type Group = 'solids' | 'stripes';

export interface GameState {
  current: 0 | 1;
  groups: [Group | null, Group | null];
  isBreak: boolean;
  ballInHand: boolean;
  /** Ball in hand restricted to behind the head string (only for the break). */
  kitchenOnly: boolean;
  winner: 0 | 1 | null;
  message: string;
}

export interface ShotResult {
  firstHit: number | null;
  /** Balls pocketed during the shot, in order. The cue ball is 0. */
  potted: number[];
}

export type ShotAction = 'continue' | 'switch' | 'rerack' | 'gameover';

export function groupOf(ball: number): Group | null {
  if (ball >= 1 && ball <= 7) return 'solids';
  if (ball >= 9 && ball <= 15) return 'stripes';
  return null;
}

export function otherGroup(g: Group): Group {
  return g === 'solids' ? 'stripes' : 'solids';
}

export function newGame(): GameState {
  return {
    current: 0,
    groups: [null, null],
    isBreak: true,
    ballInHand: true,
    kitchenOnly: true,
    winner: null,
    message: 'Player 1 to break. Place the cue ball behind the line.',
  };
}

const name = (p: 0 | 1) => `Player ${p + 1}`;

/** Group balls still on the table before the shot. */
export function remaining(group: Group, onTable: ReadonlySet<number>): number {
  let n = 0;
  for (const id of onTable) if (groupOf(id) === group) n++;
  return n;
}

/**
 * Applies a finished shot to the state.
 * onTableBefore holds the object balls (not the cue ball) on the table when the shot started.
 */
export function evaluateShot(
  prev: GameState,
  shot: ShotResult,
  onTableBefore: ReadonlySet<number>,
): { state: GameState; action: ShotAction } {
  const s: GameState = { ...prev, groups: [...prev.groups] as GameState['groups'] };
  const me = s.current;
  const opp: 0 | 1 = me === 0 ? 1 : 0;
  const scratch = shot.potted.includes(0);
  const potted8 = shot.potted.includes(8);
  const objectPots = shot.potted.filter((b) => b !== 0 && b !== 8);
  const myGroup = s.groups[me];
  const clearedBefore = myGroup !== null && remaining(myGroup, onTableBefore) === 0;

  s.ballInHand = false;
  s.kitchenOnly = false;

  if (s.isBreak) {
    s.isBreak = false;
    if (potted8) {
      s.isBreak = true;
      s.ballInHand = true;
      s.kitchenOnly = true;
      s.message = `8-ball on the break: re-rack. ${name(me)} breaks again.`;
      return { state: s, action: 'rerack' };
    }
    if (scratch) {
      s.current = opp;
      s.ballInHand = true;
      s.message = `Scratch on the break. ${name(opp)} has ball in hand.`;
      return { state: s, action: 'switch' };
    }
    if (objectPots.length > 0) {
      s.message = `Good break! ${name(me)} continues. The table is open.`;
      return { state: s, action: 'continue' };
    }
    s.current = opp;
    s.message = `${name(opp)} to shoot. The table is open.`;
    return { state: s, action: 'switch' };
  }

  // Foul detection.
  let foul: string | null = null;
  if (shot.firstHit === null) foul = 'No ball was hit';
  else if (myGroup === null) {
    if (shot.firstHit === 8) foul = 'Hit the 8-ball first on an open table';
  } else {
    const legal = clearedBefore ? shot.firstHit === 8 : groupOf(shot.firstHit) === myGroup;
    if (!legal) foul = clearedBefore ? 'You must hit the 8-ball first' : `You must hit ${myGroup} first`;
  }
  if (scratch) foul = foul ? `${foul}, and the cue ball was pocketed` : 'Scratch: the cue ball was pocketed';

  if (potted8) {
    s.winner = !foul && clearedBefore ? me : opp;
    s.message =
      s.winner === me
        ? `${name(me)} pockets the 8-ball and wins! 🎉`
        : `${name(me)} pocketed the 8-ball ${foul ? 'on a foul' : 'too early'}. ${name(opp)} wins!`;
    return { state: s, action: 'gameover' };
  }

  if (foul) {
    s.current = opp;
    s.ballInHand = true;
    s.message = `Foul: ${foul}. ${name(opp)} has ball in hand.`;
    return { state: s, action: 'switch' };
  }

  // Open table: the first object ball pocketed decides the groups.
  if (myGroup === null && objectPots.length > 0) {
    const g = groupOf(objectPots[0])!;
    s.groups[me] = g;
    s.groups[opp] = otherGroup(g);
    s.message = `${name(me)} takes ${g}. Shoot again.`;
    return { state: s, action: 'continue' };
  }

  const ownPots = myGroup ? objectPots.filter((b) => groupOf(b) === myGroup) : [];
  if (ownPots.length > 0) {
    s.message = `${name(me)} pockets ${ownPots.join(', ')}. Shoot again.`;
    return { state: s, action: 'continue' };
  }

  s.current = opp;
  s.message = `${name(opp)} to shoot.`;
  return { state: s, action: 'switch' };
}
