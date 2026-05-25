"use strict";

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.round(number)));
}

function normalizedColwidth(value) {
  return clampNumber(value, 1, 256, 32);
}

function normalizedColheight(value) {
  return clampNumber(value, 1, 12, 1);
}
