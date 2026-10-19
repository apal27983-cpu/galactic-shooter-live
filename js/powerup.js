/* ==========================================================================
   POWER-UPS - two collectible drops:
     'multishot'  cyan capsule  -> fire three lasers at once for a few seconds
     'shield'     blue orb      -> a protective bubble that destroys anything
                                   that touches you, for a few seconds

   They fall from destroyed enemies AND rain down from the sky on their own
   random timer. Both expire if they are not collected.
   ========================================================================== */

const POWERUP_STYLE = {
  multishot: { core: '#58e8ff', light: '#eafcff', dark: '#0d4b7a', label: 'MULTI-SHOT' },
  shield:    { core: '#4a86ff', light: '#dfeaff', dark: '#0b2a6b', label: 'SHIELD' }
};

function createPowerUp() {
  return {
    type: 'multishot',
    x: 0, y: 0,
    baseX: 0,
    radius: CONFIG.powerup.radius,
    life: 0,
    age: 0,
    bobPhase: 0
  };
}

class PowerUpManager {
  constructor() {
    this.pool = new Pool(createPowerUp, CONFIG.powerup.max);
    this.dropTimer = this._nextDropDelay();
  }

  get count() {
    return this.pool.count;
  }

  clear() {
    this.pool.clear();
    this.dropTimer = this._nextDropDelay();
  }

  _nextDropDelay() {
    return randRange(CONFIG.powerup.randomDropMin, CONFIG.powerup.randomDropMax);
  }

  /** type is optional - omit it for a random pick. */
  spawn(x, y, type) {
    const p = this.pool.obtain();
    if (p === null) return null;
    p.type = type || pickWeighted(CONFIG.powerup.typeWeights);
    p.x = x;
    p.baseX = x;
    p.y = y;
    p.radius = CONFIG.powerup.radius;
    p.life = CONFIG.powerup.lifetime;
    p.age = 0;
    p.bobPhase = Math.random() * TAU;
    return p;
  }

  update(dt, game) {
    /* ---- random drops from the sky ---------------------------------- */
    this.dropTimer -= dt;
    if (this.dropTimer <= 0) {
      const margin = CONFIG.powerup.radius + 20;
      this.spawn(randRange(margin, game.worldW - margin), -CONFIG.powerup.radius);
      this.dropTimer = this._nextDropDelay();
    }

    /* ---- movement + expiry ------------------------------------------ */
    const active = this.pool.active;
    for (let i = active.length - 1; i >= 0; i--) {
      const p = active[i];
      p.age += dt;
      p.life -= dt;
      p.y += CONFIG.powerup.fallSpeed * dt;
      // gentle sideways float
      p.x = clamp(p.baseX + Math.sin(p.age * 1.6 + p.bobPhase) * 22,
        p.radius, game.worldW - p.radius);

      if (p.life <= 0 || p.y - p.radius > game.worldH + 30) {
        this.pool.releaseAt(i);
      }
    }
  }

  render(ctx, time) {
    const active = this.pool.active;
    if (active.length === 0) return;

    for (let i = 0; i < active.length; i++) {
      const p = active[i];
      const style = POWERUP_STYLE[p.type];
      const pulse = 0.72 + 0.28 * Math.sin(time * 5 + p.bobPhase);
      const r = p.radius;

      // Blink out over the last 2.5 seconds so expiry is readable.
      const fade = p.life < 2.5 ? (0.35 + 0.65 * Math.abs(Math.sin(p.life * 7))) : 1;

      ctx.globalCompositeOperation = 'lighter';
      drawGlow(ctx, style.core, p.x, p.y, r * 6 * pulse, 0.55 * fade);
      ctx.globalCompositeOperation = 'source-over';

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.globalAlpha = fade;

      if (p.type === 'multishot') {
        this._drawMultiShot(ctx, r, pulse, time, p.bobPhase, style);
      } else {
        this._drawShield(ctx, r, pulse, time, p.bobPhase, style);
      }

      ctx.globalAlpha = 1;
      ctx.restore();
    }
  }

  /** Cyan capsule carrying three energy bars. */
  _drawMultiShot(ctx, r, pulse, time, phase, style) {
    ctx.rotate(Math.sin(time * 1.6 + phase) * 0.18);

    const shell = ctx.createLinearGradient(0, -r, 0, r);
    shell.addColorStop(0, style.light);
    shell.addColorStop(0.45, '#4fd4f5');
    shell.addColorStop(1, style.dark);
    roundRectPath(ctx, -r * 0.82, -r, r * 1.64, r * 2, r * 0.6);
    ctx.fillStyle = shell;
    ctx.fill();
    ctx.strokeStyle = 'rgba(234, 252, 255, 0.95)';
    ctx.lineWidth = r * 0.1;
    ctx.stroke();

    ctx.fillStyle = 'rgba(6, 26, 48, 0.9)';
    for (let b = -1; b <= 1; b++) {
      const h = b === 0 ? r * 1.0 : r * 0.68;
      roundRectPath(ctx, b * r * 0.42 - r * 0.09, -h / 2, r * 0.18, h, r * 0.09);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(158, 244, 255, ' + (0.85 * pulse).toFixed(3) + ')';
    for (let b = -1; b <= 1; b++) {
      const h = b === 0 ? r * 0.86 : r * 0.56;
      roundRectPath(ctx, b * r * 0.42 - r * 0.055, -h / 2, r * 0.11, h, r * 0.06);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';

    ctx.strokeStyle = 'rgba(158, 244, 255, ' + (0.5 * pulse).toFixed(3) + ')';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 1.5, r * 0.55, Math.sin(time * 1.2) * 0.5, 0, TAU);
    ctx.stroke();
  }

  /** Deep blue orb stamped with a shield crest. */
  _drawShield(ctx, r, pulse, time, phase, style) {
    const bob = Math.sin(time * 2.2 + phase) * r * 0.08;
    ctx.translate(0, bob);

    // orb
    const orb = ctx.createRadialGradient(-r * 0.3, -r * 0.4, r * 0.1, 0, 0, r);
    orb.addColorStop(0, style.light);
    orb.addColorStop(0.42, style.core);
    orb.addColorStop(1, style.dark);
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.92, 0, TAU);
    ctx.fillStyle = orb;
    ctx.fill();
    ctx.strokeStyle = 'rgba(223, 234, 255, 0.95)';
    ctx.lineWidth = r * 0.1;
    ctx.stroke();

    // shield crest
    const s = r * 0.52;
    ctx.beginPath();
    ctx.moveTo(0, -s);
    ctx.lineTo(s * 0.86, -s * 0.5);
    ctx.lineTo(s * 0.86, s * 0.26);
    ctx.quadraticCurveTo(s * 0.8, s * 1.0, 0, s * 1.28);
    ctx.quadraticCurveTo(-s * 0.8, s * 1.0, -s * 0.86, s * 0.26);
    ctx.lineTo(-s * 0.86, -s * 0.5);
    ctx.closePath();
    ctx.fillStyle = 'rgba(8, 22, 60, 0.82)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(234, 244, 255, ' + (0.7 + 0.3 * pulse).toFixed(3) + ')';
    ctx.lineWidth = r * 0.09;
    ctx.stroke();

    // orbiting guard ring
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(140, 180, 255, ' + (0.55 * pulse).toFixed(3) + ')';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 1.52, r * 0.56, time * 0.9, 0, TAU);
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
  }
}
