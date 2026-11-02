import test from "node:test";
import assert from "node:assert/strict";
import { FIELD } from "../src/core/field.js";
import { ringPoints, scoreEnd, leaders } from "../src/core/scoring.js";

test("rings award 3, 2, and 1, and the boundary belongs to the inner ring", () => {
  const [bull, inner, outer] = FIELD.rings;
  assert.equal(ringPoints(0), 3);
  assert.equal(ringPoints(bull.r), 3);
  assert.equal(ringPoints(bull.r + 0.01), 2);
  assert.equal(ringPoints(inner.r), 2);
  assert.equal(ringPoints(inner.r + 0.01), 1);
  assert.equal(ringPoints(outer.r), 1);
  assert.equal(ringPoints(outer.r + 0.01), 0);
});

test("closest comet earns the bonus even outside the rings", () => {
  const comets = [
    { id: 1, owner: 0, x: FIELD.house.x, y: FIELD.house.y, eliminated: false },
    { id: 2, owner: 1, x: FIELD.house.x + 50, y: FIELD.house.y, eliminated: false },
    { id: 3, owner: 2, x: FIELD.house.x, y: FIELD.house.y + 400, eliminated: false },
    { id: 4, owner: 3, x: 5, y: 5, eliminated: true },
  ];
  const result = scoreEnd(comets);
  assert.equal(result.byPlayer[0], 5);
  assert.equal(result.byPlayer[1], 2);
  assert.equal(result.byPlayer[2], 0);
  assert.equal(result.byPlayer[3], undefined);
  assert.deepEqual(result.closestIds, [1]);
});

test("a distance tie shares the closest bonus", () => {
  const comets = [
    { id: 1, owner: 0, x: FIELD.house.x + 10, y: FIELD.house.y, eliminated: false },
    { id: 2, owner: 1, x: FIELD.house.x - 10, y: FIELD.house.y, eliminated: false },
  ];
  const result = scoreEnd(comets);
  assert.equal(result.byPlayer[0], 5);
  assert.equal(result.byPlayer[1], 5);
  assert.deepEqual(result.closestIds, [1, 2]);
});

test("match leaders ignore empty seats and report draws", () => {
  const players = [
    { id: 0, kind: "human", score: 4, endPoints: 1 },
    { id: 1, kind: "bot", score: 4, endPoints: 3 },
    { id: 2, kind: "off", score: 9, endPoints: 9 },
    { id: 3, kind: "bot", score: 2, endPoints: 3 },
  ];
  assert.deepEqual(leaders(players, "score").map((player) => player.id), [0, 1]);
  assert.deepEqual(leaders(players, "endPoints").map((player) => player.id), [1, 3]);
});
