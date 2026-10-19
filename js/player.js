/* ==========================================================================
   PLAYER - the player's interceptor: movement, weapons, damage state and
   all of its procedural artwork.
   ========================================================================== */

/* Hull outline in radius units, nose first, running down the right side.
   The left side is mirrored by hullPath(). */
const PLAYER_HULL = [
  [0.00, -1.50],
  [0.20, -0.86],
  [0.30, -0.18],
  [0.62, 0.06],
  [1.22, 0.58],
  [1.06, 0.86],
  [0.46, 0.66],
  [0.34, 1.02],
  [0.00, 1.10]
];

class Player {
  constructor() {
    this.radius = CONFIG.player.radius;
    this.reset(0, 0);
  }

  reset(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.tilt = 0;
    this.alive = true;
    this.fireCooldown = 0;
    this.multiShotTime = 0;
    this.shieldTime = 0;
    this.invulnTime = 0;
    this.flashTime = 0;
    this.emitTimer = 0;
    this.thrust = 0;          // 0..1, drives the exhaust length
  }

  get multiShotActive() {
    return this.multiShotTime > 0;
  }

  get shieldActive() {
    return this.shieldTime > 0;
  }

  /** Spends a life. Returns false if the hit was ignored. */
  takeDamage() {
    if (this.invulnTime > 0 || this.shieldTime > 0) return false;
    this.invulnTime = CONFIG.player.invulnerableTime;
    this.flashTime = CONFIG.player.damageFlashTime;
    return true;
  }

  /** Collecting while already powered up simply refreshes the timer. */
  activateMultiShot() {
    this.multiShotTime = CONFIG.powerup.multiShotDuration;
  }

  activateShield() {
    this.shieldTime = CONFIG.powerup.shieldDuration;
  }

  update(dt, input, game) {
    const cfg = CONFIG.player;

    /* ---- direction from the keyboard, normalised so diagonals are not
            faster than the cardinal directions ---------------------------- */
    let dx = 0;
    let dy = 0;
    if (input.isDown('KeyA') || input.isDown('ArrowLeft')) dx -= 1;
    if (input.isDown('KeyD') || input.isDown('ArrowRight')) dx += 1;
    if (input.isDown('KeyW') || input.isDown('ArrowUp')) dy -= 1;
    if (input.isDown('KeyS') || input.isDown('ArrowDown')) dy += 1;
    if (dx !== 0 && dy !== 0) {
      const inv = 1 / Math.SQRT2;
      dx *= inv;
      dy *= inv;
    }

    /* ---- frame-rate independent easing towards the target velocity ------ */
    const k = smoothFactor(cfg.accelSmoothing, dt);
    this.vx += (dx * cfg.speed - this.vx) * k;
    this.vy += (dy * cfg.speed - this.vy) * k;
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    /* ---- stay inside the playable area ---------------------------------- */
    const min = this.radius + cfg.edgeMargin;
    const maxX = game.worldW - min;
    const maxY = game.worldH - min;
    if (this.x < min) { this.x = min; this.vx = 0; }
    else if (this.x > maxX) { this.x = maxX; this.vx = 0; }
    if (this.y < min) { this.y = min; this.vy = 0; }
    else if (this.y > maxY) { this.y = maxY; this.vy = 0; }

    // Visual bank into the turn, and thrust level for the exhaust
    this.tilt += (dx * 0.26 - this.tilt) * k;
    const targetThrust = dy < -0.1 ? 1 : (dy > 0.1 ? 0.35 : 0.65);
    this.thrust += (targetThrust - this.thrust) * smoothFactor(8, dt);

    /* ---- timers --------------------------------------------------------- */
    if (this.invulnTime > 0) this.invulnTime = Math.max(0, this.invulnTime - dt);
    if (this.flashTime > 0) this.flashTime = Math.max(0, this.flashTime - dt);
    if (this.multiShotTime > 0) this.multiShotTime = Math.max(0, this.multiShotTime - dt);
    if (this.shieldTime > 0) this.shieldTime = Math.max(0, this.shieldTime - dt);

    /* ---- weapons -------------------------------------------------------- */
    if (this.fireCooldown > 0) this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    if (input.isDown('Space') && this.fireCooldown <= 0) {
      this.fire(game);
      this.fireCooldown = this.multiShotActive
        ? cfg.multiShotFireInterval
        : cfg.fireInterval;
    }

    /* ---- engine exhaust particles (rate limited, not per frame) --------- */
    this.emitTimer += dt;
    const interval = 1 / (cfg.exhaustRate * (0.5 + this.thrust));
    let emitted = 0;
    while (this.emitTimer > interval && emitted < 4) {
      this.emitTimer -= interval;
      emitted++;
      const side = Math.random() < 0.5 ? -1 : 1;
      game.particles.thruster(
        this.x + side * this.radius * 0.19,
        this.y + this.radius * 1.02,
        this.vx * 0.12
      );
    }
    if (this.emitTimer > interval) this.emitTimer = 0; // never let it run away
  }

  fire(game) {
    const noseY = this.y - this.radius * 1.35;
    const up = -Math.PI / 2;

    if (this.multiShotActive) {
      // three lasers at once: one straight ahead, two angled outwards
      game.bullets.spawn(this.x, noseY, up);
      game.bullets.spawn(this.x - this.radius * 0.72, this.y - this.radius * 0.1,
        up - CONFIG.bullet.spreadAngle);
      game.bullets.spawn(this.x + this.radius * 0.72, this.y - this.radius * 0.1,
        up + CONFIG.bullet.spreadAngle);
    } else {
      game.bullets.spawn(this.x, noseY, up);
    }

    game.particles.muzzle(this.x, noseY);
    game.audio.laser(this.multiShotActive);
  }

  /* ---- rendering -------------------------------------------------------- */

  render(ctx, time) {
    const r = this.radius;

    // During invulnerability the ship blinks, but never fully disappears.
    // While the blue shield is up the ship stays solid instead.
    let shipAlpha = 1;
    if (this.invulnTime > 0 && !this.shieldActive) {
      shipAlpha = 0.45 + 0.55 * Math.abs(Math.sin(time * 18));
    }

    /* ---- soft aura + engine glow (additive) ----------------------------- */
    ctx.globalCompositeOperation = 'lighter';
    drawGlow(ctx, '#2b7cff', this.x, this.y, r * 6.2, 0.22 + 0.05 * Math.sin(time * 3.4));

    const flicker = 0.78 + 0.22 * Math.sin(time * 42);
    const flameLen = r * (1.05 + 1.5 * this.thrust) * flicker;
    for (let s = -1; s <= 1; s += 2) {
      const ex = this.x + s * r * 0.19;
      const ey = this.y + r * 1.0;
      drawGlow(ctx, '#58e8ff', ex, ey + flameLen * 0.35, flameLen * 1.5, 0.55);
      // tapered flame cone
      ctx.globalAlpha = 0.85;
      const grad = ctx.createLinearGradient(ex, ey, ex, ey + flameLen);
      grad.addColorStop(0, 'rgba(255,255,255,0.95)');
      grad.addColorStop(0.35, 'rgba(120,236,255,0.75)');
      grad.addColorStop(1, 'rgba(43,124,255,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(ex - r * 0.17, ey);
      ctx.lineTo(ex + r * 0.17, ey);
      ctx.lineTo(ex, ey + flameLen);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.globalCompositeOperation = 'source-over';

    /* ---- hull ----------------------------------------------------------- */
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.tilt * 0.55);
    ctx.globalAlpha = shipAlpha;

    const bodyGrad = ctx.createLinearGradient(-r * 1.2, 0, r * 1.2, 0);
    bodyGrad.addColorStop(0.00, '#0b1e3c');
    bodyGrad.addColorStop(0.22, '#2f6ea8');
    bodyGrad.addColorStop(0.46, '#cfeeff');
    bodyGrad.addColorStop(0.54, '#eefaff');
    bodyGrad.addColorStop(0.78, '#2f6ea8');
    bodyGrad.addColorStop(1.00, '#0b1e3c');

    hullPath(ctx, PLAYER_HULL, r);
    ctx.fillStyle = bodyGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(158, 244, 255, 0.95)';
    ctx.lineWidth = r * 0.075;
    ctx.stroke();

    // wing accent stripes
    ctx.strokeStyle = 'rgba(88, 232, 255, 0.85)';
    ctx.lineWidth = r * 0.085;
    ctx.beginPath();
    ctx.moveTo(-r * 0.44, r * 0.18);
    ctx.lineTo(-r * 1.02, r * 0.6);
    ctx.moveTo(r * 0.44, r * 0.18);
    ctx.lineTo(r * 1.02, r * 0.6);
    ctx.stroke();

    // nose highlight
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = r * 0.06;
    ctx.beginPath();
    ctx.moveTo(0, -r * 1.42);
    ctx.lineTo(0, -r * 0.5);
    ctx.stroke();

    // cockpit canopy
    const cockpit = ctx.createLinearGradient(0, -r * 0.85, 0, r * 0.1);
    cockpit.addColorStop(0, '#ffffff');
    cockpit.addColorStop(0.45, '#6fe3ff');
    cockpit.addColorStop(1, '#0d3a6b');
    ctx.fillStyle = cockpit;
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.42, r * 0.22, r * 0.46, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(214, 248, 255, 0.9)';
    ctx.lineWidth = r * 0.05;
    ctx.stroke();

    // engine housings
    ctx.fillStyle = '#16365e';
    for (let s = -1; s <= 1; s += 2) {
      roundRectPath(ctx, s * r * 0.19 - r * 0.15, r * 0.74, r * 0.3, r * 0.3, r * 0.08);
      ctx.fill();
    }

    // damage flash washes the hull white
    if (this.flashTime > 0) {
      const amount = this.flashTime / CONFIG.player.damageFlashTime;
      hullPath(ctx, PLAYER_HULL, r);
      ctx.fillStyle = 'rgba(255, 235, 240, ' + (amount * 0.8).toFixed(3) + ')';
      ctx.fill();
    }

    ctx.globalAlpha = 1;
    ctx.restore();

    /* ---- blue shield bubble (power-up) ---------------------------------- */
    if (this.shieldActive) {
      const expiring = this.shieldTime < 1.5;
      // flicker on the way out so the player sees it is about to drop
      const strength = expiring ? (0.4 + 0.6 * Math.abs(Math.sin(this.shieldTime * 9))) : 1;
      const bubbleR = r * 2.15 + Math.sin(time * 4) * r * 0.06;

      ctx.save();
      ctx.translate(this.x, this.y);

      // soft filled dome
      const dome = ctx.createRadialGradient(0, 0, bubbleR * 0.45, 0, 0, bubbleR);
      dome.addColorStop(0, 'rgba(74, 134, 255, 0)');
      dome.addColorStop(0.72, 'rgba(74, 134, 255, ' + (0.16 * strength).toFixed(3) + ')');
      dome.addColorStop(1, 'rgba(150, 196, 255, ' + (0.42 * strength).toFixed(3) + ')');
      ctx.beginPath();
      ctx.arc(0, 0, bubbleR, 0, TAU);
      ctx.fillStyle = dome;
      ctx.fill();

      ctx.globalCompositeOperation = 'lighter';

      // bright rim
      ctx.strokeStyle = 'rgba(190, 220, 255, ' + (0.85 * strength).toFixed(3) + ')';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(0, 0, bubbleR, 0, TAU);
      ctx.stroke();

      // hex facets rotating inside the bubble
      ctx.strokeStyle = 'rgba(120, 180, 255, ' + (0.42 * strength).toFixed(3) + ')';
      ctx.lineWidth = 1.2;
      ctx.save();
      ctx.rotate(time * 0.55);
      for (let ring = 1; ring <= 2; ring++) {
        const rr = bubbleR * (ring === 1 ? 0.58 : 0.84);
        ctx.beginPath();
        for (let i = 0; i <= 6; i++) {
          const a = (i / 6) * TAU;
          const px = Math.cos(a) * rr;
          const py = Math.sin(a) * rr;
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
      ctx.restore();

      // two highlights sweeping around the rim
      ctx.strokeStyle = 'rgba(255, 255, 255, ' + (0.8 * strength).toFixed(3) + ')';
      ctx.lineWidth = 3.2;
      for (let i = 0; i < 2; i++) {
        const a = time * 2.1 + i * Math.PI;
        ctx.beginPath();
        ctx.arc(0, 0, bubbleR, a, a + 0.55);
        ctx.stroke();
      }

      ctx.globalCompositeOperation = 'source-over';
      ctx.restore();
    }

    /* ---- post-damage invulnerability ring ------------------------------- */
    if (this.invulnTime > 0 && !this.shieldActive) {
      const pulse = 0.45 + 0.35 * Math.sin(time * 11);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.translate(this.x, this.y);
      ctx.rotate(time * 1.7);
      ctx.strokeStyle = 'rgba(158, 244, 255, ' + pulse.toFixed(3) + ')';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.85, 0, TAU);
      ctx.stroke();
      // four bright arc segments sweeping around the bubble
      ctx.strokeStyle = 'rgba(255,255,255,' + (pulse * 0.9).toFixed(3) + ')';
      ctx.lineWidth = 3.4;
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * TAU;
        ctx.beginPath();
        ctx.arc(0, 0, r * 1.85, a, a + 0.42);
        ctx.stroke();
      }
      ctx.restore();
      ctx.globalCompositeOperation = 'source-over';
    }
  }
}
