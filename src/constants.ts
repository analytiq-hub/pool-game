// All units are SI (metres, seconds, kilograms).
// Proportions follow the tabletop toy table in docs/images:
// a small table with big pockets and ~25 mm balls.
//
// Table frame: x runs along the length, z across the width, y is up.
// The cloth surface is y = 0 and the table centre is the origin.

export const R = 0.0127; // ball radius (1" diameter toy balls)
export const BALL_MASS = 0.03;

/** Playing area between cushion noses. */
export const TABLE_L = 0.48;
export const TABLE_W = 0.26;
export const HALF_L = TABLE_L / 2;
export const HALF_W = TABLE_W / 2;

/** Cushion depth from nose to rail, and its height. */
export const CUSHION_DEPTH = 0.02;
export const CUSHION_HEIGHT = 0.019;
/** Height of the cushion contact point above the cloth (Han 2005 uses ~0.635 * diameter). */
export const CUSHION_CONTACT_HEIGHT = 1.27 * R;

/** Wooden rail strip on top of the box, outside the cushions. */
export const RAIL_WIDTH = 0.03;
export const RAIL_TOP = 0.021;
export const OUTER_X = HALF_L + CUSHION_DEPTH + RAIL_WIDTH;
export const OUTER_Z = HALF_W + CUSHION_DEPTH + RAIL_WIDTH;
export const BODY_BOTTOM = -0.07;

/** Pockets (centre offsets beyond the nose lines, and radii). */
export const CORNER_POCKET_R = 0.0245;
export const CORNER_POCKET_OFFSET = 0.007;
export const CORNER_MOUTH = 0.031; // distance from nose corner to where cushion ends
export const SIDE_POCKET_R = 0.0215;
export const SIDE_POCKET_OFFSET = 0.012;
export const SIDE_MOUTH = 0.022; // half-width of side pocket opening on the nose line
export const POCKET_DEPTH = 0.05;

/** Physics parameters. */
export const G = 9.81;
export const MU_SLIDE = 0.2; // ball-cloth sliding friction
export const MU_ROLL = 0.014; // rolling resistance (toy cloth is slow)
export const MU_SPIN = 0.044; // spin (about vertical) decay coefficient
export const E_BALL = 0.93; // ball-ball restitution
export const MU_BALL = 0.06; // ball-ball friction (throw)
export const E_CUSHION = 0.8;
export const MU_CUSHION = 0.2;

export const MAX_SHOT_SPEED = 1.9;
export const MAX_TIP_OFFSET = 0.5; // fraction of R

export const PHYSICS_DT = 1 / 1200;

/** Foot spot (rack apex) and head string (kitchen line for the break). */
export const FOOT_SPOT_X = HALF_L / 2;
export const HEAD_STRING_X = -HALF_L / 2;
