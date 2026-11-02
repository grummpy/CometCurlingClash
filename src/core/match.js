import { FIELD, clamp } from "./field.js";
import { makeRng, randInt } from "./rng.js";
import { createComet, applySpin, launchVelocity, stepWorld } from "./physics.js";
import { scoreEnd, leaders } from "./scoring.js";
import { blankAction } from "./inputmap.js";
import { botAction } from "./bot.js";

const PICKUP_TYPES = ["nova", "anchor", "drift"];

export function createMatch({ seed = 1, ends = 6, kinds = ["bot", "bot", "bot", "bot"] } = {}) {
  const safeSeed = (seed >>> 0) || 1;
  const players = [0, 1, 2, 3].map((id) => ({
    id,
    name: `P${id + 1}`,
    kind: kinds[id] || "off",
    score: 0,
    endPoints: 0,
  }));
  const match = {
    seed: safeSeed,
    rng: makeRng(safeSeed),
    endsTotal: clamp(ends | 0, 1, 9),
    endIndex: 0,
    phase: "aim",
    players,
    comets: [],
    pickups: [],
    throwQueue: [],
    currentThrower: 0,
    throwSerial: 0,
    nextId: 1,
    angle: 0,
    power: 0,
    powerDir: 1,
    timer: FIELD.shotFrames,
    activeCometId: null,
    botPlan: null,
    endResult: null,
    standings: null,
    winners: [],
    stats: { thrown: [0, 0, 0, 0], kos: 0, pickups: 0, hits: 0, spins: 0 },
    thrownThisEnd: [0, 0, 0, 0],
    reviewTimer: 0,
    flightFrames: 0,
    frame: 0,
  };
  beginEnd(match);
  return match;
}

function spawnPickups(rng) {
  const pickups = [];
  for (let i = 0; i < 2; i++) {
    let x = FIELD.throwX;
    let y = 400;
    for (let attempt = 0; attempt < 8; attempt++) {
      x = FIELD.left + 40 + rng.next() * (FIELD.right - FIELD.left - 80);
      y = 250 + rng.next() * 360;
      const clear = pickups.every((pickup) => Math.hypot(pickup.x - x, pickup.y - y) > 56);
      if (clear) break;
    }
    pickups.push({
      id: i,
      type: PICKUP_TYPES[randInt(rng, PICKUP_TYPES.length)],
      x,
      y,
      r: FIELD.pickupRadius,
      taken: false,
    });
  }
  return pickups;
}

function activePlayers(match) {
  return match.players.filter((player) => player.kind !== "off");
}

function finishMatch(match) {
  match.phase = "matchOver";
  match.standings = [...match.players].sort((a, b) => b.score - a.score || a.id - b.id);
  match.winners = leaders(match.players, "score");
}

function beginEnd(match) {
  const active = activePlayers(match);
  if (!active.length) {
    finishMatch(match);
    return;
  }
  match.comets = [];
  match.pickups = spawnPickups(match.rng);
  match.thrownThisEnd = [0, 0, 0, 0];
  match.throwQueue = [];
  for (let round = 0; round < FIELD.throwsPerPlayer; round++) {
    for (const player of active) match.throwQueue.push(player.id);
  }
  for (const player of match.players) player.endPoints = 0;
  match.endResult = null;
  startThrow(match);
}

function startThrow(match) {
  if (match.throwQueue.length === 0) {
    finishEnd(match);
    return "end";
  }
  match.currentThrower = match.throwQueue.shift();
  match.throwSerial += 1;
  match.angle = 0;
  match.power = 0;
  match.powerDir = 1;
  match.timer = FIELD.shotFrames;
  match.phase = "aim";
  match.activeCometId = null;
  match.flightFrames = 0;
  return "throw";
}

function finishEnd(match) {
  const result = scoreEnd(match.comets);
  for (const player of match.players) {
    const gained = result.byPlayer[player.id] || 0;
    player.endPoints = gained;
    player.score += gained;
  }
  match.endResult = {
    ...result,
    endNumber: match.endIndex + 1,
    leaderIds: leaders(match.players, "endPoints").map((player) => player.id),
  };
  match.phase = "endReview";
  match.reviewTimer = FIELD.reviewFrames;
  return "end";
}

function advanceReview(match) {
  if (match.endIndex + 1 >= match.endsTotal) {
    finishMatch(match);
    return "match";
  }
  match.endIndex += 1;
  beginEnd(match);
  return "next";
}

function launch(match) {
  const velocity = launchVelocity(match.angle, match.power);
  const comet = createComet({
    id: match.nextId++,
    owner: match.currentThrower,
    x: FIELD.throwX,
    y: FIELD.throwY,
    vx: velocity.vx,
    vy: velocity.vy,
  });
  match.comets.push(comet);
  match.activeCometId = comet.id;
  match.phase = "flight";
  match.flightFrames = 0;
  match.stats.thrown[match.currentThrower] += 1;
  match.thrownThisEnd[match.currentThrower] += 1;
  return comet;
}

function currentInput(match, inputs) {
  const player = match.players[match.currentThrower];
  if (!player || player.kind === "bot") return botAction(match);
  return (inputs && inputs[match.currentThrower]) || blankAction();
}

function anyConfirm(inputs) {
  if (!inputs) return false;
  return [0, 1, 2, 3].some((id) => inputs[id] && (inputs[id].actionPressed || inputs[id].pause));
}

export function stepMatch(match, inputs) {
  match.frame += 1;
  const events = {
    launched: false,
    hits: 0,
    kos: [],
    pickups: [],
    spun: false,
    beep: false,
    ended: false,
    matchOver: false,
  };
  if (match.phase === "matchOver") {
    events.matchOver = true;
    return events;
  }
  if (match.phase === "endReview") {
    const humans = match.players.some((player) => player.kind === "human");
    match.reviewTimer -= 1;
    const confirm = humans ? anyConfirm(inputs) : match.reviewTimer <= 0;
    if (confirm) {
      if (advanceReview(match) === "match") events.matchOver = true;
    }
    return events;
  }

  if (match.phase === "aim" || match.phase === "charge") {
    const input = currentInput(match, inputs);
    match.timer -= 1;
    if (match.timer > 0 && match.timer <= 5 * 60 && match.timer % 60 === 0) events.beep = true;
    if (input.left) match.angle -= FIELD.aimSpeed;
    if (input.right) match.angle += FIELD.aimSpeed;
    match.angle = clamp(match.angle, -FIELD.maxAim, FIELD.maxAim);

    if (match.phase === "aim" && match.timer <= 0) {
      match.power = 0.85;
      launch(match);
      events.launched = true;
      return events;
    }
    if (match.phase === "aim" && input.actionPressed && input.actionReleased) {
      match.power = Math.max(match.power, 0.7);
      launch(match);
      events.launched = true;
      return events;
    }
    if (match.phase === "aim" && input.actionPressed) match.phase = "charge";
    if (match.phase === "charge") {
      if (match.timer <= 0 || input.actionReleased) {
        launch(match);
        events.launched = true;
        return events;
      }
      match.power += match.powerDir * FIELD.powerSpeed;
      if (match.power >= 1) {
        match.power = 1;
        match.powerDir = -1;
      } else if (match.power <= 0) {
        match.power = 0;
        match.powerDir = 1;
      }
    }
    return events;
  }

  if (match.phase === "flight") {
    const input = currentInput(match, inputs);
    const comet = match.comets.find((entry) => entry.id === match.activeCometId);
    if (input.secondaryPressed && comet && comet.spinsLeft > 0 && !comet.eliminated) {
      const side = input.left ? -1 : input.right ? 1 : Math.sign(FIELD.house.x - comet.x) || 1;
      if (applySpin(comet, side)) {
        match.stats.spins += 1;
        events.spun = true;
      }
    }
    const world = stepWorld(match.comets, match.pickups);
    events.hits = world.hits;
    events.kos = world.kos;
    events.pickups = world.pickups;
    match.stats.hits += world.hits;
    match.stats.kos += world.kos.length;
    match.stats.pickups += world.pickups.length;
    match.flightFrames += 1;
    const moving = match.comets.some((entry) => !entry.eliminated && !entry.atRest);
    if (!moving || match.flightFrames >= FIELD.flightCap) {
      for (const entry of match.comets) {
        if (!entry.eliminated) {
          entry.vx = 0;
          entry.vy = 0;
          entry.atRest = true;
        }
      }
      const next = startThrow(match);
      if (next === "end") events.ended = true;
    }
  }
  return events;
}

export function runMatch(match, maxFrames = 30000) {
  let frames = 0;
  while (match.phase !== "matchOver" && frames < maxFrames) {
    stepMatch(match, {});
    frames += 1;
  }
  return frames;
}
