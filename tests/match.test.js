import test from "node:test";
import assert from "node:assert/strict";
import { FIELD } from "../src/core/field.js";
import { blankAction } from "../src/core/inputmap.js";
import { createMatch, runMatch, stepMatch } from "../src/core/match.js";

function press(partial) {
  return { ...blankAction(), ...partial };
}

function digest(match) {
  return JSON.stringify({
    scores: match.players.map((player) => player.score),
    winners: match.winners.map((player) => player.id),
    comets: match.comets.map((comet) => [
      comet.owner,
      comet.eliminated,
      Math.round(comet.x * 1000),
      Math.round(comet.y * 1000),
    ]),
    stats: match.stats,
  });
}

test("shot clock auto-launches a human who never aims", () => {
  const match = createMatch({ seed: 3, ends: 1, kinds: ["human", "human", "human", "human"] });
  for (let i = 0; i < FIELD.shotFrames - 1; i++) stepMatch(match, {});
  assert.equal(match.phase, "aim");
  assert.equal(match.stats.thrown[0], 0);
  stepMatch(match, {});
  assert.equal(match.phase, "flight");
  assert.equal(match.stats.thrown[0], 1);
  assert.equal(match.comets.length, 1);
});

test("holding action oscillates power and release launches", () => {
  const match = createMatch({ seed: 3, ends: 1, kinds: ["human", "off", "off", "off"] });
  stepMatch(match, { 0: press({ actionPressed: true }) });
  assert.equal(match.phase, "charge");
  for (let i = 0; i < 9; i++) stepMatch(match, { 0: press({ action: true }) });
  assert.ok(Math.abs(match.power - 0.4) < 1e-9);
  stepMatch(match, { 0: press({ actionReleased: true }) });
  assert.equal(match.phase, "flight");
  assert.equal(match.comets[0].owner, 0);
});

test("secondary during flight applies one spin nudge", () => {
  const match = createMatch({ seed: 3, ends: 1, kinds: ["human", "off", "off", "off"] });
  stepMatch(match, { 0: press({ actionPressed: true, actionReleased: true }) });
  assert.equal(match.phase, "flight");
  const before = match.comets[0].vx;
  stepMatch(match, { 0: press({ secondaryPressed: true, right: true }) });
  assert.ok(match.comets[0].vx > before);
  assert.equal(match.stats.spins, 1);
  assert.equal(match.comets[0].spinsLeft, 0);
  stepMatch(match, { 0: press({ secondaryPressed: true, right: true }) });
  assert.equal(match.stats.spins, 1);
});

test("a hard angled shot is eliminated when it leaves the rink", () => {
  const match = createMatch({ seed: 5, ends: 1, kinds: ["human", "off", "off", "off"] });
  for (let i = 0; i < 40 && match.phase === "aim"; i++) {
    stepMatch(match, { 0: press({ left: true }) });
  }
  assert.ok(match.angle <= -FIELD.maxAim + 0.001);
  stepMatch(match, { 0: press({ actionPressed: true }) });
  let guard = 0;
  while (match.phase === "charge" && guard < 80) {
    guard += 1;
    if (match.power >= 0.99) stepMatch(match, { 0: press({ actionReleased: true }) });
    else stepMatch(match, { 0: press({ action: true }) });
  }
  assert.equal(match.phase, "flight");
  let removed = false;
  for (let i = 0; i < FIELD.flightCap + 5 && match.phase === "flight"; i++) {
    const events = stepMatch(match, {});
    if (events.kos.length) removed = true;
  }
  assert.equal(removed, true);
  assert.ok(match.stats.kos >= 1);
  assert.equal(match.comets[0].eliminated, true);
});

test("four bots play a full end and the result is seeded", () => {
  const left = createMatch({ seed: 42, ends: 1 });
  const right = createMatch({ seed: 42, ends: 1 });
  const frames = runMatch(left);
  runMatch(right);
  assert.equal(left.phase, "matchOver");
  assert.ok(frames < 20000, `match took ${frames} frames`);
  assert.deepEqual(left.stats.thrown, [3, 3, 3, 3]);
  assert.deepEqual(digest(left), digest(right));
  const total = left.players.reduce((sum, player) => sum + player.score, 0);
  assert.ok(total > 0, `expected ring points, scores=${left.players.map((player) => player.score).join(",")}`);
  const best = Math.max(...left.players.map((player) => player.score));
  assert.ok(left.winners.every((player) => player.score === best));
  assert.ok(left.winners.length >= 1);
});

test("a second seed repeats and an empty seat does not throw", () => {
  const once = createMatch({ seed: 7, ends: 2, kinds: ["bot", "bot", "bot", "off"] });
  const twice = createMatch({ seed: 7, ends: 2, kinds: ["bot", "bot", "bot", "off"] });
  runMatch(once);
  runMatch(twice);
  assert.equal(once.phase, "matchOver");
  assert.deepEqual(digest(once), digest(twice));
  assert.deepEqual(once.stats.thrown, [6, 6, 6, 0]);
  assert.equal(once.endIndex, 1);
});

test("default match length finishes with six ends of twelve throws", () => {
  const match = createMatch({ seed: 11, ends: 6 });
  const frames = runMatch(match, 80000);
  assert.equal(match.phase, "matchOver");
  assert.equal(match.endsTotal, 6);
  assert.deepEqual(match.stats.thrown, [18, 18, 18, 18]);
  assert.ok(frames < 80000);
  const best = Math.max(...match.players.map((player) => player.score));
  assert.ok(match.winners.length >= 1);
  assert.ok(match.winners.every((player) => player.score === best));
});
