import test from "node:test";
import assert from "node:assert/strict";
import { FIELD } from "../src/core/field.js";
import {
  createComet,
  applySpin,
  applyPickup,
  collidePair,
  stepWorld,
  previewTrajectory,
  cometSpeed,
} from "../src/core/physics.js";

function rock(spec) {
  return createComet({ id: 1, owner: 0, x: 200, y: 400, ...spec });
}

test("friction brings a comet to rest", () => {
  const comet = rock({ vx: 6, vy: -4 });
  for (let i = 0; i < 400; i++) stepWorld([comet], []);
  assert.equal(comet.atRest, true);
  assert.equal(cometSpeed(comet), 0);
  assert.equal(comet.eliminated, false);
});

test("gravity bends a shot toward the house", () => {
  const comet = rock({ x: 80, y: 460, vx: 0, vy: -6 });
  for (let i = 0; i < 40; i++) stepWorld([comet], []);
  assert.ok(comet.x > 80, `expected a pull toward the house, x=${comet.x}`);
});

test("equal-mass collision transfers momentum", () => {
  const a = rock({ id: 1, x: 0, y: 0, vx: 4, vy: 0, r: 11 });
  const b = rock({ id: 2, owner: 1, x: 20, y: 0, vx: 0, vy: 0, r: 11 });
  const result = collidePair(a, b);
  assert.equal(result, "hit");
  assert.ok(b.vx > 1.5, `struck comet should move, vx=${b.vx}`);
  assert.ok(a.vx < b.vx);
  assert.ok(Math.hypot(b.x - a.x, b.y - a.y) >= a.r + b.r - 0.001);
});

test("nova pickup makes the next collision harder and is consumed", () => {
  function pair(nova) {
    const a = rock({ id: 1, x: 0, y: 0, vx: 4, vy: 0, r: 11, nova });
    const b = rock({ id: 2, owner: 1, x: 20, y: 0, vx: 0, vy: 0, r: 11, mass: 1 });
    collidePair(a, b);
    return b.vx;
  }
  const plain = pair(false);
  const boosted = pair(true);
  assert.ok(boosted > plain, `nova vx ${boosted} should exceed ${plain}`);
  const comet = rock({ x: 0, y: 0, vx: 4, vy: 0, r: 11, nova: true });
  collidePair(comet, rock({ id: 2, x: 20, y: 0, vx: 0, vy: 0, r: 11 }));
  assert.equal(comet.nova, false);
});

test("anchor and drift pickups change mass and spin stock", () => {
  const comet = rock({ spinsLeft: 1, mass: 1 });
  applyPickup(comet, "anchor");
  applyPickup(comet, "drift");
  assert.equal(comet.mass, FIELD.anchorMass);
  assert.equal(comet.spinsLeft, 2);
  applyPickup(comet, "nova");
  assert.equal(comet.nova, true);
});

test("a comet collects a pickup by sliding over it", () => {
  const comet = rock({ x: 100, y: 100, vx: 4, vy: 0, atRest: false });
  const pickup = { id: 0, type: "nova", x: 112, y: 100, r: 10, taken: false };
  const events = stepWorld([comet], [pickup]);
  assert.equal(pickup.taken, true);
  assert.equal(comet.nova, true);
  assert.equal(events.pickups.length, 1);
  assert.equal(events.pickups[0].type, "nova");
});

test("comets that leave the rink are eliminated", () => {
  const comet = rock({ x: 30, y: 400, vx: -8, vy: 0 });
  let removed = null;
  for (let i = 0; i < 10; i++) {
    const events = stepWorld([comet], []);
    if (events.kos.length) removed = events.kos[0];
  }
  assert.equal(comet.eliminated, true);
  assert.equal(removed.owner, 0);
  const parked = rock({ x: 10, y: 10, atRest: true, vx: 0, vy: 0 });
  const events = stepWorld([parked], []);
  assert.equal(parked.eliminated, true);
  assert.equal(events.kos.length, 1);
});

test("spin nudges perpendicular to velocity once", () => {
  const comet = rock({ vx: 0, vy: -10, spinsLeft: 1 });
  assert.equal(applySpin(comet, 1), true);
  assert.ok(comet.vx > 0);
  assert.equal(comet.spinsLeft, 0);
  const vx = comet.vx;
  assert.equal(applySpin(comet, 1), false);
  assert.equal(comet.vx, vx);
});

test("trajectory preview covers the first fifth of the estimated path", () => {
  const parked = rock({ x: 220, y: 300, vx: 0, vy: 0, atRest: true });
  const before = parked.x;
  const preview = previewTrajectory(0.1, 1, [parked]);
  const cap = Math.ceil(preview.estimatedFull * FIELD.previewFraction);
  assert.ok(preview.points.length >= 2);
  assert.ok(preview.points.length <= cap + 1);
  assert.equal(parked.x, before);
  assert.ok(preview.estimatedFull > 10);
});
