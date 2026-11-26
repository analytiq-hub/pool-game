import { Vector3 } from 'three';
import { expect, it } from 'vitest';
import { FOOT_SPOT_X, HALF_L, HALF_W, HEAD_STRING_X, MAX_SHOT_SPEED, PHYSICS_DT, R } from '../constants';
import { anyMoving, Ball, step, strike, type PhysicsEvent } from './physics';

it('a full-power break settles with every ball on the table or in a pocket', () => {
  for (let trial = 0; trial < 10; trial++) {
    const balls = Array.from({ length: 16 }, (_, i) => new Ball(i));
    balls[0].place(HEAD_STRING_X - 0.03, (trial - 5) * 0.004);
    let k = 1;
    for (let row = 0; row < 5; row++)
      for (let j = 0; j <= row; j++)
        balls[k++].place(FOOT_SPOT_X + row * (Math.sqrt(3) * R + 1e-5), (j - row / 2) * (2 * R + 2e-5));
    strike(balls[0], new Vector3(1, 0, 0), MAX_SHOT_SPEED, 0, 0);
    const events: PhysicsEvent[] = [];
    let t = 0;
    while (anyMoving(balls) && t < 30) {
      step(balls, PHYSICS_DT, events);
      t += PHYSICS_DT;
    }
    expect(t).toBeLessThan(30);
    for (const b of balls) {
      if (!b.onTable) continue;
      expect(Math.abs(b.pos.x)).toBeLessThanOrEqual(HALF_L);
      expect(Math.abs(b.pos.z)).toBeLessThanOrEqual(HALF_W);
    }
  }
});
