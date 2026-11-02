import { FIELD } from "./field.js";
import { blankAction } from "./inputmap.js";

export function ensurePlan(match) {
  if (match.botPlan && match.botPlan.serial === match.throwSerial) return match.botPlan;
  const rng = match.rng;
  match.botPlan = {
    serial: match.throwSerial,
    angle: (rng.next() * 2 - 1) * 0.28,
    power: 0.9 + rng.next() * 0.1,
    spun: false,
  };
  return match.botPlan;
}

export function botAction(match) {
  const plan = ensurePlan(match);
  const action = blankAction();
  if (match.phase === "aim") {
    const diff = plan.angle - match.angle;
    if (Math.abs(diff) > FIELD.aimSpeed) {
      if (diff > 0) action.right = true;
      else action.left = true;
    } else {
      action.actionPressed = true;
    }
  } else if (match.phase === "charge") {
    const passed = match.power >= plan.power;
    const missed = match.powerDir < 0 && match.power < plan.power;
    if (passed || missed) action.actionReleased = true;
  } else if (match.phase === "flight") {
    const comet = match.comets.find((entry) => entry.id === match.activeCometId);
    if (comet && !comet.eliminated && comet.spinsLeft > 0 && !plan.spun && comet.y < FIELD.throwY - 150) {
      const error = FIELD.house.x - comet.x;
      if (Math.abs(error) > 20) {
        action.secondaryPressed = true;
        if (error > 0) action.right = true;
        else action.left = true;
        plan.spun = true;
      }
    }
  }
  return action;
}
