import test from "node:test";
import assert from "node:assert/strict";
import { makeRng, randInt } from "../src/core/rng.js";

test("same seed produces the same sequence", () => {
  const a = makeRng(42);
  const b = makeRng(42);
  const left = Array.from({ length: 8 }, () => a.next());
  const right = Array.from({ length: 8 }, () => b.next());
  assert.deepEqual(left, right);
  assert.equal(a.getState(), b.getState());
});

test("different seeds diverge", () => {
  const a = makeRng(1);
  const b = makeRng(2);
  assert.notEqual(a.next(), b.next());
});

test("values stay inside the unit interval", () => {
  const rng = makeRng(99);
  for (let i = 0; i < 200; i++) {
    const value = rng.next();
    assert.ok(value >= 0 && value < 1);
  }
});

test("zero seed is still deterministic", () => {
  assert.equal(makeRng(0).next(), makeRng(0).next());
  assert.equal(randInt(makeRng(5), 3), randInt(makeRng(5), 3));
});
