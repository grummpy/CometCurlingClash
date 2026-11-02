import { FIELD } from "./field.js";

export function ringPoints(distance) {
  for (const ring of FIELD.rings) {
    if (distance <= ring.r) return ring.points;
  }
  return 0;
}

export function scoreEnd(comets) {
  const live = comets.filter((comet) => !comet.eliminated);
  const breakdown = [];
  const byPlayer = {};
  let best = Infinity;
  let closestIds = [];

  for (const comet of live) {
    const dist = Math.hypot(comet.x - FIELD.house.x, comet.y - FIELD.house.y);
    const pts = ringPoints(dist);
    breakdown.push({
      id: comet.id,
      owner: comet.owner,
      dist,
      ringPoints: pts,
      bonus: 0,
      total: pts,
    });
    byPlayer[comet.owner] = (byPlayer[comet.owner] || 0) + pts;
    if (dist < best - 1e-6) {
      best = dist;
      closestIds = [comet.id];
    } else if (Math.abs(dist - best) <= 1e-6) {
      closestIds.push(comet.id);
    }
  }

  for (const id of closestIds) {
    const row = breakdown.find((entry) => entry.id === id);
    row.bonus = 2;
    row.total += 2;
    byPlayer[row.owner] = (byPlayer[row.owner] || 0) + 2;
  }

  return { byPlayer, breakdown, closestIds };
}

export function leaders(players, key) {
  const active = players.filter((player) => player.kind !== "off");
  if (!active.length) return [];
  const max = Math.max(...active.map((player) => player[key]));
  return active.filter((player) => player[key] === max);
}
