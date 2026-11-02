// Logical rink. Units are world pixels stepped at 60 Hz. The house sits at the
// far end; throws leave from the near line and curl toward the gravity well.

export const FIELD = {
  width: 440,
  height: 760,
  left: 24,
  right: 416,
  top: 24,
  bottom: 736,
  house: { x: 220, y: 168 },
  rings: [
    { r: 34, points: 3, name: "bullseye" },
    { r: 76, points: 2, name: "inner" },
    { r: 126, points: 1, name: "outer" },
  ],
  throwX: 220,
  throwY: 690,
  gravity: 0.02,
  gravityRadius: 250,
  maxAim: 0.55,
  aimSpeed: 0.03,
  maxSpeed: 11.5,
  friction: 0.12,
  cometRadius: 12,
  powerSpeed: 0.04,
  shotFrames: 15 * 60,
  previewFraction: 0.2,
  pickupRadius: 12,
  throwsPerPlayer: 3,
  reviewFrames: 75,
  flightCap: 220,
  restitution: 0.9,
  novaBoost: 1.75,
  anchorMass: 2.6,
  spinImpulse: 2.6,
};

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
