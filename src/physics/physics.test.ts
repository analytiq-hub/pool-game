import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { E_CUSHION, HALF_L, PHYSICS_DT, R } from '../constants';
import { Ball, collideBalls, hanBounce, step, strike, type PhysicsEvent } from './physics';

function run(balls: Ball[], seconds: number): PhysicsEvent[] {
  const events: PhysicsEvent[] = [];
  const n = Math.round(seconds / PHYSICS_DT);
  for (let i = 0; i < n; i++) step(balls, PHYSICS_DT, events);
  return events;
}

describe('cloth friction', () => {
  it('a stun shot becomes natural roll and then stops', () => {
    const b = new Ball(0);
    b.place(-0.15, 0);
    strike(b, new Vector3(1, 0, 0), 0.5, 0, 0);
    expect(b.state).toBe('sliding');
    run([b], 0.1);
    expect(b.state).toBe('rolling');
    // Natural roll after a stun shot carries 5/7 of the speed.
    expect(b.vel.x).toBeGreaterThan(0.3);
    expect(b.vel.x).toBeLessThan(0.36);
    run([b], 10);
    expect(b.state).toBe('stationary');
  });

  it('draw makes the cue ball come back after a head-on hit', () => {
    const cue = new Ball(0);
    const obj = new Ball(1);
    cue.place(-0.1, 0);
    obj.place(0, 0);
    strike(cue, new Vector3(1, 0, 0), 1.0, 0, -0.5);
    run([cue, obj], 0.6);
    expect(cue.pos.x).toBeLessThan(-0.05);
    expect(obj.pos.x).toBeGreaterThan(0.05);
  });
});

describe('ball-ball collision', () => {
  it('a head-on hit transfers almost all the velocity', () => {
    const a = new Ball(0);
    const b = new Ball(1);
    a.place(0, 0);
    b.place(2 * R - 1e-5, 0);
    a.vel.set(1, 0, 0);
    a.state = 'rolling';
    collideBalls(a, b);
    expect(b.vel.x).toBeGreaterThan(0.95);
    expect(Math.abs(a.vel.x)).toBeLessThan(0.05);
  });

  it('a cut sends the object ball along the line of centres', () => {
    const a = new Ball(0);
    const b = new Ball(1);
    a.place(0, 0);
    const ang = Math.PI / 6;
    b.place(Math.cos(ang) * (2 * R - 1e-5), Math.sin(ang) * (2 * R - 1e-5));
    a.vel.set(1, 0, 0);
    collideBalls(a, b);
    const dir = Math.atan2(b.vel.z, b.vel.x);
    // Throw moves it off the line slightly.
    expect(Math.abs(dir - ang)).toBeLessThan(0.08);
  });
});

describe('Han cushion model', () => {
  it('reverses the normal velocity with restitution', () => {
    const b = new Ball(0);
    b.place(0, 0);
    b.vel.set(1, 0, 0);
    b.w.set(0, 0, -1 / R); // natural roll toward +x
    hanBounce(b, new Vector3(1, 0, 0));
    expect(b.vel.x).toBeLessThan(-0.6);
    expect(b.vel.x).toBeGreaterThan(-1.0);
    expect(Math.abs(b.vel.z)).toBeLessThan(1e-9);
    expect(-b.vel.x).toBeCloseTo(E_CUSHION, 0);
  });

  it('running english widens the rebound angle', () => {
    const plain = new Ball(0);
    plain.place(0, 0);
    plain.vel.set(0.7, 0, 0.7);
    const english = new Ball(1);
    english.place(0, 0);
    english.vel.set(0.7, 0, 0.7);
    // Counter-clockwise from above (+y): the contact point on the +x side moves toward −z,
    // so cushion friction pushes the ball toward +z (running english).
    english.w.set(0, 60, 0);
    hanBounce(plain, new Vector3(1, 0, 0));
    hanBounce(english, new Vector3(1, 0, 0));
    expect(english.vel.z).toBeGreaterThan(plain.vel.z);
  });

  it('a ball rolled into the short cushion comes back', () => {
    const b = new Ball(0);
    b.place(HALF_L - 0.1, 0);
    strike(b, new Vector3(1, 0, 0), 0.8, 0, 0);
    const events = run([b], 0.5);
    expect(events.some((e) => e.type === 'cushion')).toBe(true);
    expect(b.vel.x).toBeLessThan(0);
  });
});

describe('pockets', () => {
  it('a ball rolled into a corner is pocketed', () => {
    const b = new Ball(3);
    b.place(0, 0);
    strike(b, new Vector3(HALF_L, 0, 0.13), 1.2, 0, 0);
    const events = run([b], 2);
    expect(events.some((e) => e.type === 'pocket' && e.ball === 3)).toBe(true);
    expect(b.state).toBe('pocketed');
  });

  it('a ball rolled straight into the side pocket is pocketed', () => {
    const b = new Ball(5);
    b.place(0, 0);
    strike(b, new Vector3(0, 0, 1), 0.8, 0, 0);
    run([b], 2);
    expect(b.state).toBe('pocketed');
  });
});
