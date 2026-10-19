/* ==========================================================================
   UTILS - small math/render helpers shared by every system.
   ========================================================================== */

const TAU = Math.PI * 2;

function clamp(value, min, max) {
  return value < min ? min : (value > max ? max : value);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Frame-rate independent smoothing factor for "ease towards target" moves. */
function smoothFactor(rate, dt) {
  return 1 - Math.exp(-rate * dt);
}

function randRange(min, max) {
  return min + Math.random() * (max - min);
}

function randInt(min, max) {
  return Math.floor(min + Math.random() * (max - min + 1));
}

function pickOne(list) {
  return list[(Math.random() * list.length) | 0];
}

/** Picks a key from { key: weight, ... }. */
function pickWeighted(weights) {
  let total = 0;
  for (const key in weights) total += weights[key];
  let roll = Math.random() * total;
  for (const key in weights) {
    roll -= weights[key];
    if (roll <= 0) return key;
  }
  return Object.keys(weights)[0];
}

/** Circle-vs-circle overlap test without a square root. */
function circlesOverlap(ax, ay, ar, bx, by, br) {
  const dx = bx - ax;
  const dy = by - ay;
  const r = ar + br;
  return dx * dx + dy * dy <= r * r;
}

/** '#rrggbb' -> 'rgba(r,g,b,a)'. Accepts shorthand '#rgb' too. */
function hexToRgba(hex, alpha) {
  let h = hex.charAt(0) === '#' ? hex.slice(1) : hex;
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
}

/* --------------------------------------------------------------------------
   Glow sprite cache.
   Drawing a soft radial glow with ctx.createRadialGradient() or shadowBlur
   every frame is very expensive. Instead each colour gets one pre-rendered
   offscreen canvas, and we blit it with drawImage(). This is the single
   biggest performance win in the renderer.
   -------------------------------------------------------------------------- */

const _glowCache = new Map();

function getGlowSprite(color) {
  let sprite = _glowCache.get(color);
  if (sprite) return sprite;

  const size = 64;
  sprite = document.createElement('canvas');
  sprite.width = size;
  sprite.height = size;
  const g = sprite.getContext('2d');
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0.00, hexToRgba(color, 1.0));
  grad.addColorStop(0.22, hexToRgba(color, 0.70));
  grad.addColorStop(0.55, hexToRgba(color, 0.22));
  grad.addColorStop(1.00, hexToRgba(color, 0.0));
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);

  _glowCache.set(color, sprite);
  return sprite;
}

/** Blits a cached glow centred on (x, y) with the given diameter. */
function drawGlow(ctx, color, x, y, diameter, alpha) {
  const sprite = getGlowSprite(color);
  ctx.globalAlpha = alpha;
  ctx.drawImage(sprite, x - diameter / 2, y - diameter / 2, diameter, diameter);
  ctx.globalAlpha = 1;
}

/* --------------------------------------------------------------------------
   Object pool - reuses instances so the garbage collector stays quiet during
   long sessions. Entities are swap-removed, so iterate backwards.
   -------------------------------------------------------------------------- */

class Pool {
  constructor(factory, max) {
    this.factory = factory;
    this.max = max;
    this.active = [];
    this.free = [];
  }

  get count() {
    return this.active.length;
  }

  /** Returns a recycled/new object, or null when the cap is reached. */
  obtain() {
    if (this.active.length >= this.max) return null;
    const obj = this.free.length > 0 ? this.free.pop() : this.factory();
    this.active.push(obj);
    return obj;
  }

  releaseAt(index) {
    const obj = this.active[index];
    const last = this.active.pop();
    if (index < this.active.length) this.active[index] = last;
    this.free.push(obj);
  }

  clear() {
    for (let i = this.active.length - 1; i >= 0; i--) this.free.push(this.active[i]);
    this.active.length = 0;
  }
}

/* --------------------------------------------------------------------------
   Drawing helpers
   -------------------------------------------------------------------------- */

function roundRectPath(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
  ctx.lineTo(x + rad, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
  ctx.lineTo(x, y + rad);
  ctx.quadraticCurveTo(x, y, x + rad, y);
  ctx.closePath();
}

/**
 * Builds a symmetrical hull outline from half-points given in ship-radius
 * units. Points run nose -> tail down one side; the other side is mirrored.
 */
function hullPath(ctx, halfPoints, scale) {
  ctx.beginPath();
  for (let i = 0; i < halfPoints.length; i++) {
    const p = halfPoints[i];
    const x = p[0] * scale;
    const y = p[1] * scale;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  for (let i = halfPoints.length - 1; i >= 0; i--) {
    const p = halfPoints[i];
    if (p[0] === 0) continue; // centreline points are not mirrored
    ctx.lineTo(-p[0] * scale, p[1] * scale);
  }
  ctx.closePath();
}

/* --------------------------------------------------------------------------
   Formatting + persistence
   -------------------------------------------------------------------------- */

function formatScore(value) {
  return String(Math.max(0, Math.floor(value))).padStart(6, '0');
}

const HIGH_SCORE_KEY = 'starfall.highScore';

function loadHighScore() {
  try {
    const raw = window.localStorage.getItem(HIGH_SCORE_KEY);
    const n = raw === null ? 0 : parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch (err) {
    return 0; // private mode / storage disabled - not fatal
  }
}

function saveHighScore(value) {
  try {
    window.localStorage.setItem(HIGH_SCORE_KEY, String(Math.floor(value)));
  } catch (err) {
    /* ignore - the game works fine without persistence */
  }
}
