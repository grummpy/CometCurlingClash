import { FIELD } from "../core/field.js";
import { makeRng } from "../core/rng.js";
import { previewTrajectory } from "../core/physics.js";
import { labelForCode } from "../core/inputmap.js";

export const PLAYER_COLORS = ["#ff2d6a", "#3ec6ff", "#3dff7a", "#ffd23a"];
const W = 1280;
const H = 720;
const SHEET = { x: 360, y: 28, w: 400, h: 664 };

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

export function createBackdrop() {
  const rng = makeRng(20261101);
  const stars = [];
  for (let i = 0; i < 140; i++) {
    stars.push({
      x: rng.next() * W,
      y: rng.next() * H,
      r: rng.next() * 1.6 + 0.3,
      a: 0.25 + rng.next() * 0.75,
      tw: rng.next() * Math.PI * 2,
    });
  }
  return { stars };
}

export function worldToScreen(x, y) {
  return [
    SHEET.x + (x / FIELD.width) * SHEET.w,
    SHEET.y + (y / FIELD.height) * SHEET.h,
  ];
}

function worldScale(radius) {
  return radius * (SHEET.w / FIELD.width);
}

function panel(ctx, x, y, w, h, color) {
  ctx.save();
  ctx.fillStyle = "rgba(7, 4, 20, 0.78)";
  ctx.strokeStyle = color || "rgba(255, 70, 160, 0.9)";
  ctx.lineWidth = 2;
  roundRect(ctx, x, y, w, h, 16);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawStars(ctx, backdrop, time) {
  ctx.fillStyle = "#070414";
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(980, 180, 20, 980, 180, 420);
  glow.addColorStop(0, "rgba(120, 40, 180, 0.35)");
  glow.addColorStop(1, "rgba(7, 4, 20, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  for (const star of backdrop.stars) {
    const flicker = 0.55 + Math.sin(time / 400 + star.tw) * 0.45;
    ctx.globalAlpha = star.a * flicker;
    ctx.fillStyle = "#f4f1ff";
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawSheet(ctx, match) {
  const { x, y, w, h } = SHEET;
  ctx.save();
  roundRect(ctx, x, y, w, h, 28);
  ctx.clip();
  const ice = ctx.createLinearGradient(x, y, x, y + h);
  ice.addColorStop(0, "#1b2d55");
  ice.addColorStop(0.5, "#24386a");
  ice.addColorStop(1, "#152444");
  ctx.fillStyle = ice;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "rgba(160, 200, 255, 0.15)";
  ctx.lineWidth = 2;
  for (let i = 1; i < 6; i++) {
    ctx.beginPath();
    ctx.moveTo(x + 18, y + (h / 6) * i);
    ctx.lineTo(x + w - 18, y + (h / 6) * i);
    ctx.stroke();
  }
  const [hx, hy] = worldToScreen(FIELD.house.x, FIELD.house.y);
  const ringColors = ["#ff4fd8", "#35d4ff", "#d6ff4a"];
  const rings = [...FIELD.rings].reverse();
  const colors = [...ringColors];
  rings.forEach((ring, index) => {
    ctx.beginPath();
    ctx.arc(hx, hy, worldScale(ring.r), 0, Math.PI * 2);
    ctx.strokeStyle = colors[index];
    ctx.lineWidth = 4;
    ctx.shadowColor = colors[index];
    ctx.shadowBlur = 16;
    ctx.stroke();
  });
  ctx.shadowBlur = 0;
  ctx.beginPath();
  ctx.arc(hx, hy, 5, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();

  for (const pickup of match.pickups) {
    if (pickup.taken) continue;
    const [px, py] = worldToScreen(pickup.x, pickup.y);
    const color = pickup.type === "nova" ? "#ff5bd1" : pickup.type === "anchor" ? "#9aa4ff" : "#7dfff0";
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    ctx.fillRect(-8, -8, 16, 16);
    ctx.restore();
    ctx.fillStyle = "#160818";
    ctx.font = "bold 10px Trebuchet MS, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(pickup.type === "nova" ? "N" : pickup.type === "anchor" ? "A" : "D", px, py);
  }

  if (match.phase === "aim" || match.phase === "charge") {
    const color = PLAYER_COLORS[match.currentThrower];
    const preview = previewTrajectory(match.angle, match.phase === "charge" ? match.power : 0.75, match.comets);
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 7]);
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    preview.points.forEach((point, index) => {
      const [sx, sy] = worldToScreen(point.x, point.y);
      if (index === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    });
    ctx.stroke();
    ctx.restore();
    const [tx, ty] = worldToScreen(FIELD.throwX, FIELD.throwY);
    const aim = 78;
    const ax = tx + Math.sin(match.angle) * aim;
    const ay = ty - Math.cos(match.angle) * aim;
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(ax, ay);
    ctx.stroke();
  }

  for (const comet of match.comets) {
    if (comet.eliminated) continue;
    const color = PLAYER_COLORS[comet.owner];
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = 3;
    ctx.beginPath();
    comet.trail.forEach((point, index) => {
      const [sx, sy] = worldToScreen(point.x, point.y);
      if (index === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    });
    ctx.stroke();
    ctx.globalAlpha = 1;
    const [sx, sy] = worldToScreen(comet.x, comet.y);
    ctx.beginPath();
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 18;
    ctx.arc(sx, sy, worldScale(comet.r), 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.beginPath();
    ctx.arc(sx - 3, sy - 3, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = "#ff4fa3";
  ctx.lineWidth = 4;
  ctx.shadowColor = "#ff4fa3";
  ctx.shadowBlur = 16;
  roundRect(ctx, x, y, w, h, 28);
  ctx.stroke();
  ctx.restore();
}

function drawPadIcon(ctx, x, y, lit) {
  ctx.save();
  ctx.strokeStyle = lit ? "#7dfff0" : "rgba(255,255,255,0.25)";
  ctx.fillStyle = lit ? "rgba(125, 255, 240, 0.18)" : "rgba(255,255,255,0.04)";
  ctx.lineWidth = 2;
  roundRect(ctx, x, y, 28, 18, 5);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawHud(ctx, app) {
  const match = app.match;
  panel(ctx, 28, 28, 300, 664, "rgba(62, 198, 255, 0.7)");
  panel(ctx, 792, 28, 460, 664, "rgba(255, 45, 106, 0.75)");

  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 22px Trebuchet MS, sans-serif";
  ctx.fillText("COMET CURLING", 48, 48);
  ctx.fillStyle = "#9ad8ff";
  ctx.font = "16px Trebuchet MS, sans-serif";
  ctx.fillText(`End ${match.endIndex + 1} / ${match.endsTotal}`, 48, 86);

  const seconds = Math.max(0, Math.ceil(match.timer / 60));
  const urgent = seconds <= 5 && (match.phase === "aim" || match.phase === "charge");
  let clock = `${seconds}s`;
  if (match.phase === "flight") clock = "SLIDE";
  else if (match.phase === "endReview") clock = "END";
  ctx.fillStyle = urgent ? "#ffd23a" : "#ffffff";
  ctx.font = "bold 42px Trebuchet MS, sans-serif";
  ctx.fillText(clock, 48, 118);
  ctx.font = "14px Trebuchet MS, sans-serif";
  ctx.fillStyle = "#c9d4ff";
  ctx.fillText("Shot clock", 48, 168);

  const thrower = match.players[match.currentThrower];
  if (thrower && match.phase !== "endReview" && match.phase !== "matchOver") {
    ctx.fillStyle = PLAYER_COLORS[thrower.id];
    ctx.font = "bold 22px Trebuchet MS, sans-serif";
    ctx.fillText(`${thrower.name} ${thrower.kind === "bot" ? "BOT" : "READY"}`, 48, 210);
    ctx.font = "14px Trebuchet MS, sans-serif";
    ctx.fillStyle = "#d5dcff";
    const hint = match.phase === "aim" ? "Aim, then hold action"
      : match.phase === "charge" ? "Release to launch"
        : "Secondary curves once";
    ctx.fillText(hint, 48, 242);
  }

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 14px Trebuchet MS, sans-serif";
  ctx.fillText("POWER", 48, 290);
  const meterX = 48;
  const meterY = 314;
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  roundRect(ctx, meterX, meterY, 250, 22, 8);
  ctx.fill();
  const shown = match.phase === "charge" || match.phase === "flight" ? match.power : 0;
  ctx.fillStyle = PLAYER_COLORS[match.currentThrower] || "#ffffff";
  roundRect(ctx, meterX, meterY, Math.max(0, 250 * shown), 22, 8);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.fillText("SPIN", 48, 356);
  const active = match.comets.find((comet) => comet.id === match.activeCometId);
  const spins = active ? active.spinsLeft : 1;
  ctx.font = "14px Trebuchet MS, sans-serif";
  ctx.fillStyle = spins > 0 ? "#7dfff0" : "#889";
  ctx.fillText(match.phase === "flight" ? (spins > 0 ? `${spins} nudge ready` : "Nudge spent") : "1 nudge on release", 48, 378);

  ctx.fillStyle = "#9fb0df";
  ctx.fillText(app.settings.mute ? "Muted (M)" : "M mute", 48, 430);
  for (let i = 0; i < 4; i++) {
    drawPadIcon(ctx, 48 + i * 40, 470, app.connected[i]);
    ctx.fillStyle = app.connected[i] ? "#7dfff0" : "#667";
    ctx.font = "11px Trebuchet MS, sans-serif";
    ctx.fillText(`P${i + 1}`, 54 + i * 40, 492);
  }
  ctx.fillStyle = "#8ea0d4";
  ctx.font = "13px Trebuchet MS, sans-serif";
  ctx.fillText("Esc pause", 48, 530);
  ctx.fillText(`Seed ${match.seed}`, 48, 554);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 22px Trebuchet MS, sans-serif";
  ctx.fillText("SCORES", 820, 48);
  match.players.forEach((player, index) => {
    const y = 96 + index * 120;
    const color = PLAYER_COLORS[player.id];
    const current = player.id === match.currentThrower && match.phase !== "endReview";
    ctx.fillStyle = current ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.15)";
    roundRect(ctx, 816, y - 16, 412, 104, 12);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(844, y + 18, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 22px Trebuchet MS, sans-serif";
    ctx.fillText(player.name, 868, y);
    ctx.font = "14px Trebuchet MS, sans-serif";
    ctx.fillStyle = "#b7c3ea";
    const kind = player.kind === "human" ? "Human" : player.kind === "bot" ? "Bot" : "Off";
    ctx.fillText(kind, 868, y + 28);
    ctx.fillStyle = color;
    ctx.font = "bold 28px Trebuchet MS, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(String(player.score), 1204, y);
    ctx.textAlign = "left";
    const thrown = match.thrownThisEnd[player.id] || 0;
    for (let pip = 0; pip < 3; pip++) {
      ctx.beginPath();
      ctx.fillStyle = player.kind === "off" ? "#334" : pip < thrown ? color : "rgba(255,255,255,0.15)";
      ctx.arc(868 + pip * 22, y + 62, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    if (player.endPoints && match.phase === "endReview") {
      ctx.fillStyle = "#ffffff";
      ctx.font = "14px Trebuchet MS, sans-serif";
      ctx.fillText(`+${player.endPoints} this end`, 940, y + 52);
    }
  });
}

function drawBanner(ctx, match) {
  if (match.phase !== "endReview" || !match.endResult) return;
  const x = 392;
  const y = 268;
  const w = 336;
  const cx = x + w / 2;
  panel(ctx, x, y, w, 236, "#ffd23a");
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffd23a";
  ctx.font = "bold 26px Trebuchet MS, sans-serif";
  const names = match.endResult.leaderIds.map((id) => `P${id + 1}`);
  const top = Math.max(...match.players.map((player) => player.endPoints));
  const last = match.endIndex + 1 >= match.endsTotal;
  ctx.fillText(top > 0 ? `End ${match.endResult.endNumber}` : "Blank end", cx, 304);
  ctx.fillStyle = "#ffffff";
  ctx.font = "16px Trebuchet MS, sans-serif";
  ctx.fillText(top > 0 ? `${names.join(" & ")} lead the end` : "Nobody reached the rings", cx, 336);
  ctx.font = "14px Trebuchet MS, sans-serif";
  ctx.fillStyle = "#d5dcff";
  const lines = match.players.map((player) => `${player.name} +${player.endPoints}`).join("  ");
  ctx.fillText(lines, cx, 370);
  const bonus = match.endResult.breakdown.filter((row) => row.bonus);
  if (bonus.length) {
    ctx.fillText(`Closest +2 · ${bonus.map((row) => `P${row.owner + 1}`).join(", ")}`, cx, 398);
  }
  ctx.fillStyle = "#7dfff0";
  const humans = match.players.some((player) => player.kind === "human");
  const footer = humans ? "Action or Enter to continue" : (last ? "Final standings coming up" : "Next end coming up");
  ctx.fillText(footer, cx, 464);
}

function drawTitle(ctx, app) {
  if (app.cover && app.cover.complete) {
    ctx.drawImage(app.cover, 0, 0, W, H);
  } else {
    drawStars(ctx, app.backdrop, app.time);
    ctx.fillStyle = "#ff2d6a";
    ctx.font = "bold 72px Trebuchet MS, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("COMET CURLING CLASH", 640, 280);
  }
  ctx.fillStyle = "rgba(4, 0, 16, 0.72)";
  ctx.fillRect(0, 520, W, 200);
  const items = ["Start", "Settings", "Controls"];
  items.forEach((label, index) => {
    const selected = index === app.menuIndex;
    ctx.fillStyle = selected ? "#ff2d6a" : "rgba(255,255,255,0.08)";
    roundRect(ctx, 460, 548 + index * 48, 360, 40, 10);
    ctx.fill();
    ctx.fillStyle = selected ? "#1a0410" : "#ffffff";
    ctx.font = "bold 20px Trebuchet MS, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, 640, 568 + index * 48);
  });
}

function drawJoin(ctx, app) {
  drawStars(ctx, app.backdrop, app.time);
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 40px Trebuchet MS, sans-serif";
  ctx.fillText("Choose pilots", 640, 70);
  ctx.font = "16px Trebuchet MS, sans-serif";
  ctx.fillStyle = "#c9d4ff";
  ctx.fillText("Action joins a human. Secondary swaps bot and off. Enter starts.", 640, 108);
  for (let i = 0; i < 4; i++) {
    const x = 90 + i * 300;
    panel(ctx, x, 160, 270, 360, PLAYER_COLORS[i]);
    ctx.fillStyle = PLAYER_COLORS[i];
    ctx.beginPath();
    ctx.arc(x + 135, 230, 36, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#160814";
    ctx.font = "bold 28px Trebuchet MS, sans-serif";
    ctx.textBaseline = "middle";
    ctx.fillText(`P${i + 1}`, x + 135, 230);
    ctx.textBaseline = "top";
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 26px Trebuchet MS, sans-serif";
    const kind = app.kinds[i];
    ctx.fillText(kind === "human" ? "HUMAN" : kind === "bot" ? "BOT" : "OFF", x + 135, 290);
    ctx.font = "15px Trebuchet MS, sans-serif";
    ctx.fillStyle = "#d0d8f5";
    const bind = app.bindings[i];
    ctx.fillText(`Action ${labelForCode(bind.action)}`, x + 135, 350);
    ctx.fillText(`Spin ${labelForCode(bind.secondary)}`, x + 135, 376);
    ctx.fillText(`${labelForCode(bind.left)} / ${labelForCode(bind.right)} aim`, x + 135, 402);
    if (app.connected[i]) {
      ctx.fillStyle = "#7dfff0";
      ctx.fillText("Gamepad connected", x + 135, 450);
    }
  }
  ctx.fillStyle = app.notice ? "#ffd23a" : "#9fb0df";
  ctx.font = "16px Trebuchet MS, sans-serif";
  ctx.fillText(app.notice || "Empty seats can stay bots. One pilot is enough.", 640, 580);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 18px Trebuchet MS, sans-serif";
  ctx.fillText("Enter / Start to play    Esc back", 640, 640);
}

function drawMenuList(ctx, title, subtitle, items, selected, width = 600) {
  const x = (W - width) / 2;
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 40px Trebuchet MS, sans-serif";
  ctx.fillText(title, 640, 90);
  ctx.font = "16px Trebuchet MS, sans-serif";
  ctx.fillStyle = "#c9d4ff";
  ctx.fillText(subtitle, 640, 128);
  items.forEach((item, index) => {
    const y = 190 + index * 64;
    const on = index === selected;
    ctx.fillStyle = on ? "rgba(255, 45, 106, 0.95)" : "rgba(18, 12, 32, 0.92)";
    roundRect(ctx, x, y, width, 52, 12);
    ctx.fill();
    if (!on) {
      ctx.strokeStyle = "rgba(255,255,255,0.18)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.fillStyle = on ? "#1a0410" : "#ffffff";
    ctx.font = "20px Trebuchet MS, sans-serif";
    ctx.textBaseline = "middle";
    ctx.fillText(item, 640, y + 26);
  });
  ctx.textBaseline = "alphabetic";
}

function drawSettings(ctx, app) {
  drawStars(ctx, app.backdrop, app.time);
  const volume = `${Math.round(app.settings.volume * 100)}%`;
  const items = [
    `Volume  ${volume}`,
    `Ends  ${app.settings.ends}`,
    `Sound  ${app.settings.mute ? "Muted" : "On"}`,
    "Back",
  ];
  drawMenuList(ctx, "Settings", "Left and right adjust the highlighted row. Saved on this machine.", items, app.menuIndex);
}

function drawControls(ctx, app) {
  drawStars(ctx, app.backdrop, app.time);
  const player = app.controlPlayer;
  const bind = app.bindings[player];
  const items = [
    `Left  ${labelForCode(bind.left)}`,
    `Right  ${labelForCode(bind.right)}`,
    `Up  ${labelForCode(bind.up)}`,
    `Down  ${labelForCode(bind.down)}`,
    `Action  ${labelForCode(bind.action)}`,
    `Secondary  ${labelForCode(bind.secondary)}`,
    "Reset defaults",
    "Back",
  ];
  drawMenuList(
    ctx,
    `Controls · P${player + 1}`,
    app.listen
      ? `Press a key for ${app.listen.action}`
      : "Left and right change player. Action rebinds the row. Gamepads use the standard layout and override the keyboard.",
    items,
    app.menuIndex,
  );
  ctx.fillStyle = PLAYER_COLORS[player];
  ctx.fillRect(340, 168, 600, 4);
}

function drawPause(ctx, app) {
  ctx.fillStyle = "rgba(4, 0, 12, 0.78)";
  ctx.fillRect(0, 0, W, H);
  panel(ctx, 400, 60, 480, 420, "#ff4fa3");
  drawMenuList(ctx, "Paused", "Esc or Start resumes.", ["Resume", "Settings", "Controls", "Quit to title"], app.menuIndex, 420);
}

function drawMatch(ctx, app) {
  drawStars(ctx, app.backdrop, app.time);
  const match = app.match;
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffd23a";
  ctx.font = "bold 42px Trebuchet MS, sans-serif";
  const winnerNames = (match.winners || []).map((player) => player.name);
  ctx.fillText(winnerNames.length > 1 ? "Draw" : "Champion", 640, 78);
  ctx.fillStyle = "#ffffff";
  ctx.font = "22px Trebuchet MS, sans-serif";
  ctx.fillText(winnerNames.length ? winnerNames.join(" & ") : "No pilots", 640, 116);
  (match.standings || []).forEach((player, index) => {
    const y = 170 + index * 58;
    panel(ctx, 390, y, 500, 50, PLAYER_COLORS[player.id]);
    ctx.textAlign = "left";
    ctx.fillStyle = PLAYER_COLORS[player.id];
    ctx.font = "bold 22px Trebuchet MS, sans-serif";
    ctx.textBaseline = "middle";
    ctx.fillText(`${index + 1}   ${player.name}`, 420, y + 25);
    ctx.textAlign = "right";
    ctx.fillText(String(player.score), 860, y + 25);
  });
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  const items = ["Rematch", "Title"];
  items.forEach((label, index) => {
    const on = index === app.menuIndex;
    ctx.fillStyle = on ? "#3ec6ff" : "rgba(255,255,255,0.08)";
    roundRect(ctx, 470, 520 + index * 56, 340, 46, 10);
    ctx.fill();
    ctx.fillStyle = on ? "#041018" : "#ffffff";
    ctx.font = "bold 20px Trebuchet MS, sans-serif";
    ctx.textBaseline = "middle";
    ctx.fillText(label, 640, 543 + index * 56);
  });
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#8ea0d4";
  ctx.font = "14px Trebuchet MS, sans-serif";
  ctx.fillText(`Seed ${match.seed}`, 640, 670);
}

export function render(ctx, app) {
  ctx.setLineDash([]);
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.clearRect(0, 0, W, H);
  if (app.screen === "title") {
    drawTitle(ctx, app);
    return;
  }
  if (app.screen === "join") {
    drawJoin(ctx, app);
    return;
  }
  if (app.screen === "settings") {
    if (app.match) {
      drawStars(ctx, app.backdrop, app.time);
      drawSheet(ctx, app.match);
    }
    drawSettings(ctx, app);
    return;
  }
  if (app.screen === "controls") {
    drawControls(ctx, app);
    return;
  }
  if (app.screen === "match") {
    drawMatch(ctx, app);
    return;
  }
  drawStars(ctx, app.backdrop, app.time);
  if (app.match) {
    drawSheet(ctx, app.match);
    drawHud(ctx, app);
    drawBanner(ctx, app.match);
  }
  if (app.screen === "pause") drawPause(ctx, app);
}

export const VIEW = { W, H };
