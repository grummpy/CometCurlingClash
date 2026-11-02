import { FIELD } from "./field.js";

export function createComet(spec) {
  return {
    id: spec.id,
    owner: spec.owner,
    x: spec.x,
    y: spec.y,
    vx: spec.vx || 0,
    vy: spec.vy || 0,
    r: spec.r ?? FIELD.cometRadius,
    mass: spec.mass ?? 1,
    spinsLeft: spec.spinsLeft ?? 1,
    nova: !!spec.nova,
    eliminated: !!spec.eliminated,
    atRest: !!spec.atRest,
    trail: [],
  };
}

export function cometSpeed(comet) {
  return Math.hypot(comet.vx, comet.vy);
}

export function applySpin(comet, side) {
  if (!comet || comet.eliminated || comet.spinsLeft <= 0) return false;
  const sp = cometSpeed(comet);
  let px;
  let py;
  if (sp < 0.0001) {
    px = 1;
    py = 0;
  } else {
    px = -comet.vy / sp;
    py = comet.vx / sp;
  }
  const impulse = FIELD.spinImpulse * (side >= 0 ? 1 : -1);
  comet.vx += px * impulse;
  comet.vy += py * impulse;
  comet.spinsLeft -= 1;
  comet.atRest = false;
  return true;
}

export function applyPickup(comet, type) {
  if (type === "nova") comet.nova = true;
  else if (type === "anchor") comet.mass = Math.max(comet.mass, FIELD.anchorMass);
  else if (type === "drift") comet.spinsLeft += 1;
}

// Returns 'hit' when an impulse is exchanged, 'overlap' for resting contact,
// or false when the pair is apart.
export function collidePair(a, b) {
  if (a.eliminated || b.eliminated) return false;
  let dx = b.x - a.x;
  let dy = b.y - a.y;
  let dist = Math.hypot(dx, dy);
  const min = a.r + b.r;
  if (dist >= min) return false;
  if (dist < 1e-6) {
    dx = 1;
    dy = 0;
    dist = 1;
  }
  const nx = dx / dist;
  const ny = dy / dist;
  const overlap = min - dist;
  const invA = 1 / a.mass;
  const invB = 1 / b.mass;
  const inv = invA + invB;
  a.x -= nx * overlap * (invA / inv);
  a.y -= ny * overlap * (invA / inv);
  b.x += nx * overlap * (invB / inv);
  b.y += ny * overlap * (invB / inv);

  const velAlong = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
  if (velAlong >= -1e-8) return "overlap";

  let j = -(1 + FIELD.restitution) * velAlong / inv;
  if (a.nova || b.nova) j *= FIELD.novaBoost;
  if (a.nova) a.nova = false;
  if (b.nova) b.nova = false;
  a.vx -= j * nx * invA;
  a.vy -= j * ny * invA;
  b.vx += j * nx * invB;
  b.vy += j * ny * invB;
  a.atRest = false;
  b.atRest = false;
  return "hit";
}

function applyGravity(comet) {
  const dx = FIELD.house.x - comet.x;
  const dy = FIELD.house.y - comet.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 10 || dist > FIELD.gravityRadius) return;
  const falloff = 1 - dist / FIELD.gravityRadius;
  const g = FIELD.gravity * falloff;
  comet.vx += (dx / dist) * g;
  comet.vy += (dy / dist) * g;
}

function applyFriction(comet) {
  const sp = cometSpeed(comet);
  if (sp <= FIELD.friction) {
    comet.vx = 0;
    comet.vy = 0;
    comet.atRest = true;
    return;
  }
  const scale = (sp - FIELD.friction) / sp;
  comet.vx *= scale;
  comet.vy *= scale;
  comet.atRest = false;
}

export function stepWorld(comets, pickups) {
  const events = { hits: 0, kos: [], pickups: [] };
  for (const comet of comets) {
    if (comet.eliminated || comet.atRest) continue;
    applyGravity(comet);
    applyFriction(comet);
    if (comet.atRest) continue;
    comet.x += comet.vx;
    comet.y += comet.vy;
    comet.trail.push({ x: comet.x, y: comet.y });
    if (comet.trail.length > 18) comet.trail.shift();
  }

  for (let iter = 0; iter < 4; iter++) {
    for (let i = 0; i < comets.length; i++) {
      for (let j = i + 1; j < comets.length; j++) {
        const result = collidePair(comets[i], comets[j]);
        if (result === "hit") events.hits += 1;
      }
    }
  }

  for (const comet of comets) {
    if (comet.eliminated) continue;
    const outside = comet.x < FIELD.left || comet.x > FIELD.right
      || comet.y < FIELD.top || comet.y > FIELD.bottom;
    if (outside) {
      comet.eliminated = true;
      comet.vx = 0;
      comet.vy = 0;
      comet.atRest = true;
      events.kos.push({ id: comet.id, owner: comet.owner });
    }
  }

  if (pickups) {
    for (const pickup of pickups) {
      if (pickup.taken) continue;
      for (const comet of comets) {
        if (comet.eliminated) continue;
        const reach = comet.r + pickup.r;
        if (Math.hypot(comet.x - pickup.x, comet.y - pickup.y) <= reach) {
          pickup.taken = true;
          applyPickup(comet, pickup.type);
          events.pickups.push({
            type: pickup.type,
            owner: comet.owner,
            x: pickup.x,
            y: pickup.y,
            cometId: comet.id,
          });
          break;
        }
      }
    }
  }

  return events;
}

export function launchVelocity(angle, power) {
  const speed = Math.max(0.2, power) * FIELD.maxSpeed;
  return {
    speed,
    vx: Math.sin(angle) * speed,
    vy: -Math.cos(angle) * speed,
  };
}

// First 20% of the estimated slide, including bumps against copies of stones
// already on the sheet. Original comets are not mutated.
export function previewTrajectory(angle, power, comets) {
  const velocity = launchVelocity(angle, power);
  const ghost = createComet({
    id: -1,
    owner: -1,
    x: FIELD.throwX,
    y: FIELD.throwY,
    vx: velocity.vx,
    vy: velocity.vy,
    spinsLeft: 0,
  });
  const clones = [];
  for (const comet of comets) {
    if (comet.eliminated) continue;
    clones.push(createComet({
      ...comet,
      vx: 0,
      vy: 0,
      atRest: true,
      trail: [],
    }));
  }
  const estimatedFull = Math.max(1, Math.ceil(velocity.speed / FIELD.friction));
  const steps = Math.max(2, Math.ceil(estimatedFull * FIELD.previewFraction));
  const points = [{ x: ghost.x, y: ghost.y }];
  for (let i = 0; i < steps; i++) {
    stepWorld([ghost, ...clones], null);
    points.push({ x: ghost.x, y: ghost.y });
    if (ghost.atRest || ghost.eliminated) break;
  }
  return { points, estimatedFull, simulated: steps };
}
