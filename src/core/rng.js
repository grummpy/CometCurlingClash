// Mulberry32. Every gameplay roll goes through here so replays and tests repeat.

export function makeRng(seed) {
  let state = (seed >>> 0) || 1;
  return {
    next() {
      state |= 0;
      state = (state + 0x6D2B79F5) | 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    getState() {
      return state >>> 0;
    },
  };
}

export function randInt(rng, count) {
  return Math.floor(rng.next() * count);
}
