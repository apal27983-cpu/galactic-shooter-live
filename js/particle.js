/* ==========================================================================
   PARTICLES - pooled explosion / spark / debris / shockwave effects.
   All glows are blitted from cached sprites (see utils.getGlowSprite) and
   rendered in two passes so the composite mode is switched twice per frame
   instead of once per particle.
   ========================================================================== */

const P_GLOW = 0;    // soft expanding energy blob
const P_SPARK = 1;   // fast streak drawn along its velocity
const P_RING = 2;    // expanding shockwave outline
const P_DEBRIS = 3;  // small tumbling chunk of hull

function createParticle() {
  return {
    type: P_GLOW,
    x: 0, y: 0, vx: 0, vy: 0,
    life: 0, maxLife: 1,
    size: 1, grow: 0,
    drag: 0,
    color: '#ffffff',
    spin: 0, angle: 0,
    alpha: 1
  };
}

class ParticleSystem {
  constructor() {
    this.pool = new Pool(createParticle, CONFIG.particles.max);
  }

  get count() {
    return this.pool.count;
  }

  clear() {
    this.pool.clear();
  }

  /** Low-level spawn. Returns the particle, or null if the cap is hit. */
  spawn(type, x, y, vx, vy, life, size, color, options) {
    const p = this.pool.obtain();
    if (p === null) return null;
    const opts = options || {};

    p.type = type;
    p.x = x; p.y = y;
    p.vx = vx; p.vy = vy;
    p.life = life; p.maxLife = life;
    p.size = size;
    p.grow = opts.grow === undefined ? 0 : opts.grow;
    p.drag = opts.drag === undefined ? 2.2 : opts.drag;
    p.color = color;
    p.alpha = opts.alpha === undefined ? 1 : opts.alpha;
    p.spin = opts.spin === undefined ? 0 : opts.spin;
    p.angle = opts.angle === undefined ? Math.random() * TAU : opts.angle;
    return p;
  }

  /* ---- effect recipes --------------------------------------------------- */

  /** Enemy destroyed: flash, shockwave, fire glows, sparks and debris. */
  explosion(x, y, radius, palette) {
    const colors = palette || CONFIG.particles.explosionPalette;
    const scale = radius / 16;

    // central flash
    this.spawn(P_GLOW, x, y, 0, 0, 0.2, radius * 3.4, '#ffffff', { grow: radius * 4, drag: 0 });
    // shockwave
    this.spawn(P_RING, x, y, 0, 0, 0.38, radius * 1.2, '#bdf4ff',
      { grow: radius * 5.5, drag: 0 });

    const glowCount = Math.round(7 + 5 * scale);
    for (let i = 0; i < glowCount; i++) {
      const angle = Math.random() * TAU;
      const speed = randRange(40, 210) * (0.7 + 0.5 * scale);
      this.spawn(P_GLOW, x, y,
        Math.cos(angle) * speed, Math.sin(angle) * speed,
        randRange(0.3, 0.72), randRange(8, 20) * (0.7 + 0.5 * scale),
        pickOne(colors), { grow: 14, drag: 2.6 });
    }

    const sparkCount = Math.round(10 + 8 * scale);
    for (let i = 0; i < sparkCount; i++) {
      const angle = Math.random() * TAU;
      const speed = randRange(150, 460) * (0.75 + 0.45 * scale);
      this.spawn(P_SPARK, x, y,
        Math.cos(angle) * speed, Math.sin(angle) * speed,
        randRange(0.2, 0.5), randRange(1.4, 3), pickOne(colors), { drag: 2.0 });
    }

    const debrisCount = Math.round(4 + 5 * scale);
    for (let i = 0; i < debrisCount; i++) {
      const angle = Math.random() * TAU;
      const speed = randRange(60, 220);
      this.spawn(P_DEBRIS, x, y,
        Math.cos(angle) * speed, Math.sin(angle) * speed,
        randRange(0.45, 0.95), randRange(1.8, 4.2), '#6d8aa8',
        { drag: 1.0, spin: randRange(-10, 10) });
    }
  }

  /**
   * Bullet biting into an enemy hull: a hot orange burst of sparks, embers
   * and a couple of glowing fragments. Fired on every hit, including ones
   * that do not destroy the enemy.
   */
  impact(x, y) {
    const fire = CONFIG.particles.impactPalette;

    // white-hot core, instantly fading to orange
    this.spawn(P_GLOW, x, y, 0, 0, 0.13, 22, '#fff0c0', { grow: 18, drag: 0 });
    this.spawn(P_GLOW, x, y, 0, 0, 0.26, 26, '#ff8a1f', { grow: 26, drag: 0 });
    this.spawn(P_RING, x, y, 0, 0, 0.2, 5, '#ffc24d', { grow: 34, drag: 0 });

    // sparks spraying back towards the shot, with a bias upwards
    for (let i = 0; i < 12; i++) {
      const angle = randRange(-Math.PI, 0) + randRange(-0.65, 0.65);
      const speed = randRange(110, 330);
      this.spawn(P_SPARK, x, y,
        Math.cos(angle) * speed, Math.sin(angle) * speed,
        randRange(0.14, 0.36), randRange(1.4, 2.6),
        pickOne(fire), { drag: 2.8 });
    }

    // slower glowing embers that linger for a moment
    for (let i = 0; i < 5; i++) {
      const angle = Math.random() * TAU;
      const speed = randRange(35, 120);
      this.spawn(P_GLOW, x, y,
        Math.cos(angle) * speed, Math.sin(angle) * speed,
        randRange(0.22, 0.45), randRange(5, 10),
        pickOne(fire), { grow: 5, drag: 2.4 });
    }

    // a few hull fragments knocked loose
    for (let i = 0; i < 3; i++) {
      const angle = randRange(-Math.PI, 0);
      const speed = randRange(70, 180);
      this.spawn(P_DEBRIS, x, y,
        Math.cos(angle) * speed, Math.sin(angle) * speed,
        randRange(0.3, 0.6), randRange(1.6, 3), '#b8702c',
        { drag: 1.3, spin: randRange(-12, 12) });
    }
  }

  /** Muzzle flash at the player's cannon. */
  muzzle(x, y) {
    this.spawn(P_GLOW, x, y, 0, 0, 0.1, 22, '#9ef4ff', { grow: 10, drag: 0 });
  }

  /** Engine exhaust trailing the player ship. */
  thruster(x, y, drift) {
    this.spawn(P_GLOW, x, y,
      randRange(-18, 18) + drift, randRange(110, 190),
      randRange(0.16, 0.3), randRange(5, 9),
      Math.random() < 0.35 ? '#ffffff' : '#58e8ff', { grow: -3, drag: 1.4 });
  }

  /** Power-up collected. */
  pickupBurst(x, y, color) {
    const tint = color || '#58e8ff';
    this.spawn(P_RING, x, y, 0, 0, 0.42, 18, tint, { grow: 120, drag: 0 });
    this.spawn(P_GLOW, x, y, 0, 0, 0.3, 40, tint, { grow: 30, drag: 0 });
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * TAU;
      const speed = randRange(140, 260);
      this.spawn(P_SPARK, x, y,
        Math.cos(angle) * speed, Math.sin(angle) * speed,
        randRange(0.24, 0.46), 2.2,
        Math.random() < 0.4 ? '#ffffff' : tint, { drag: 2.4 });
    }
  }

  /** Player took a hit. */
  playerHit(x, y) {
    this.spawn(P_RING, x, y, 0, 0, 0.45, 26, '#ff8098', { grow: 170, drag: 0 });
    this.spawn(P_GLOW, x, y, 0, 0, 0.26, 70, '#ff5a7a', { grow: 40, drag: 0 });
    for (let i = 0; i < 18; i++) {
      const angle = Math.random() * TAU;
      const speed = randRange(120, 330);
      this.spawn(P_SPARK, x, y,
        Math.cos(angle) * speed, Math.sin(angle) * speed,
        randRange(0.2, 0.46), randRange(1.5, 2.8),
        Math.random() < 0.5 ? '#ffd3dc' : '#ff5a7a', { drag: 2.2 });
    }
  }

  /* ---- simulation ------------------------------------------------------- */

  update(dt) {
    const active = this.pool.active;
    for (let i = active.length - 1; i >= 0; i--) {
      const p = active[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.pool.releaseAt(i);
        continue;
      }
      if (p.drag > 0) {
        const damping = Math.exp(-p.drag * dt);
        p.vx *= damping;
        p.vy *= damping;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.spin !== 0) p.angle += p.spin * dt;
    }
  }

  /* ---- rendering -------------------------------------------------------- */

  render(ctx) {
    const active = this.pool.active;
    if (active.length === 0) return;

    // Pass 1: additive energy (glows, sparks, rings)
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < active.length; i++) {
      const p = active[i];
      if (p.type === P_DEBRIS) continue;

      const t = p.life / p.maxLife;          // 1 -> 0 over the lifetime
      const fade = Math.pow(t, 0.75) * p.alpha;
      const grown = p.size + p.grow * (1 - t);

      if (p.type === P_GLOW) {
        drawGlow(ctx, p.color, p.x, p.y, Math.max(1, grown * 2), fade * 0.9);
      } else if (p.type === P_SPARK) {
        ctx.globalAlpha = fade;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = Math.max(0.6, p.size * t);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.022, p.y - p.vy * 0.022);
        ctx.stroke();
        ctx.globalAlpha = 1;
      } else { // P_RING
        ctx.globalAlpha = fade * 0.75;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = Math.max(0.6, 3.5 * t);
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(1, grown), 0, TAU);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    // Pass 2: solid debris
    ctx.globalCompositeOperation = 'source-over';
    for (let i = 0; i < active.length; i++) {
      const p = active[i];
      if (p.type !== P_DEBRIS) continue;
      const t = p.life / p.maxLife;
      ctx.save();
      ctx.globalAlpha = Math.pow(t, 0.8);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size * 0.5, -p.size * 0.32, p.size, p.size * 0.64);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
}
