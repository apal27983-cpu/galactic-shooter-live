/* ==========================================================================
   ENEMIES - three ship classes plus the spawner and difficulty ramp.
   Hull outlines are given in radius units, nose first (pointing DOWN, since
   enemies fly towards the player), running down the right-hand side.
   ========================================================================== */

const ENEMY_HULLS = {
  // Scout: a slim dart with rear-swept fins.
  scout: [
    [0.00, 1.28],
    [0.48, 0.28],
    [1.00, 0.66],
    [0.74, -0.14],
    [0.42, -0.78],
    [0.00, -0.94]
  ],
  // Interceptor: twin outriggers around a central pod.
  interceptor: [
    [0.00, 1.22],
    [0.34, 0.52],
    [1.18, 0.78],
    [1.02, 0.06],
    [0.56, -0.22],
    [0.62, -0.88],
    [0.00, -1.02]
  ],
  // Heavy fighter: broad armoured wedge.
  heavy: [
    [0.00, 1.02],
    [0.58, 0.80],
    [1.24, 0.28],
    [1.16, -0.42],
    [0.68, -0.92],
    [0.00, -1.00]
  ]
};

function createEnemy() {
  return {
    type: 'scout',
    cfg: null,
    x: 0, y: 0,
    baseX: 0,
    radius: 10,
    hp: 1, maxHp: 1,
    speed: 100,
    score: 0,
    driftAmp: 0,
    driftFreq: 0,
    phase: 0,
    age: 0,
    hitFlash: 0,
    spin: 0
  };
}

/** Enemy mix per difficulty level - earlier levels stay gentle. */
function spawnWeightsForLevel(level) {
  if (level < 1) return { scout: 1, interceptor: 0, heavy: 0 };
  if (level < 2) return { scout: 0.80, interceptor: 0.20, heavy: 0.00 };
  if (level < 4) return { scout: 0.60, interceptor: 0.33, heavy: 0.07 };
  if (level < 7) return { scout: 0.45, interceptor: 0.38, heavy: 0.17 };
  return { scout: 0.34, interceptor: 0.40, heavy: 0.26 };
}

class EnemyManager {
  constructor() {
    this.pool = new Pool(createEnemy, CONFIG.enemies.max);
    this.spawnTimer = CONFIG.spawn.firstSpawnDelay;
  }

  get count() {
    return this.pool.count;
  }

  reset() {
    this.pool.clear();
    this.spawnTimer = CONFIG.spawn.firstSpawnDelay;
  }

  /* ---- difficulty helpers ---------------------------------------------- */

  spawnInterval(level) {
    const s = CONFIG.spawn;
    return Math.max(s.minInterval, s.baseInterval - level * s.intervalPerLevel);
  }

  speedMultiplier(level) {
    const d = CONFIG.difficulty;
    return Math.min(d.maxSpeedMultiplier, 1 + level * d.speedPerLevel);
  }

  hpMultiplier(level) {
    const d = CONFIG.difficulty;
    return Math.min(d.maxHpMultiplier, 1 + level * d.hpPerLevel);
  }

  /* ---- spawning --------------------------------------------------------- */

  spawn(game) {
    const level = game.level;
    const typeName = pickWeighted(spawnWeightsForLevel(level));
    const cfg = CONFIG.enemies.types[typeName];

    const enemy = this.pool.obtain();
    if (enemy === null) return null;

    const margin = cfg.radius + 14;
    let x = randRange(margin, game.worldW - margin);

    // Do not drop a ship straight onto the player's head.
    if (Math.abs(x - game.player.x) < CONFIG.spawn.safeGapFromPlayer) {
      const push = CONFIG.spawn.safeGapFromPlayer * (x < game.player.x ? -1 : 1);
      x = clamp(x + push, margin, game.worldW - margin);
    }

    enemy.type = typeName;
    enemy.cfg = cfg;
    enemy.x = x;
    enemy.baseX = x;
    enemy.y = -cfg.radius * 2;
    enemy.radius = cfg.radius;
    enemy.maxHp = Math.max(1, Math.round(cfg.hp * this.hpMultiplier(level)));
    enemy.hp = enemy.maxHp;
    enemy.speed = cfg.speed * this.speedMultiplier(level) * randRange(0.92, 1.08);
    enemy.score = cfg.score;
    enemy.driftAmp = cfg.driftAmp * randRange(0.6, 1.25);
    enemy.driftFreq = cfg.driftFreq * randRange(0.8, 1.2);
    enemy.phase = Math.random() * TAU;
    enemy.age = 0;
    enemy.hitFlash = 0;
    enemy.spin = 0;
    return enemy;
  }

  update(dt, game) {
    /* spawn timing */
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawn(game);
      this.spawnTimer += this.spawnInterval(game.level);
      if (this.spawnTimer <= 0) this.spawnTimer = this.spawnInterval(game.level);
    }

    /* movement + culling */
    const active = this.pool.active;
    for (let i = active.length - 1; i >= 0; i--) {
      const e = active[i];
      e.age += dt;
      e.y += e.speed * dt;

      // Gentle sine weave so no two ships trace the same straight line.
      const drift = Math.sin(e.age * e.driftFreq + e.phase) * e.driftAmp;
      e.x = clamp(e.baseX + drift, e.radius, game.worldW - e.radius);

      if (e.hitFlash > 0) e.hitFlash = Math.max(0, e.hitFlash - dt);

      // Escaped off the bottom - remove so nothing lingers forever.
      if (e.y - e.radius > game.worldH + 30) {
        this.pool.releaseAt(i);
      }
    }
  }

  /* ---- rendering -------------------------------------------------------- */

  render(ctx, time) {
    const active = this.pool.active;
    for (let i = 0; i < active.length; i++) {
      this._renderOne(ctx, active[i], time);
    }
  }

  _renderOne(ctx, e, time) {
    const r = e.radius;
    const cfg = e.cfg;

    // engine glow behind the ship (additive)
    ctx.globalCompositeOperation = 'lighter';
    drawGlow(ctx, cfg.glow, e.x, e.y - r * 0.95, r * 2.6, 0.5);
    drawGlow(ctx, cfg.glow, e.x, e.y, r * 3.6, 0.14);
    ctx.globalCompositeOperation = 'source-over';

    ctx.save();
    ctx.translate(e.x, e.y);

    const hull = ENEMY_HULLS[e.type];
    const grad = ctx.createLinearGradient(-r * 1.2, 0, r * 1.2, 0);
    grad.addColorStop(0.00, '#17101f');
    grad.addColorStop(0.30, cfg.body);
    grad.addColorStop(0.50, cfg.edge);
    grad.addColorStop(0.70, cfg.body);
    grad.addColorStop(1.00, '#17101f');

    hullPath(ctx, hull, r);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = hexToRgba(cfg.edge, 0.9);
    ctx.lineWidth = r * 0.07;
    ctx.stroke();

    /* per-class detailing */
    if (e.type === 'scout') {
      ctx.fillStyle = hexToRgba(cfg.glow, 0.95);
      ctx.beginPath();
      ctx.ellipse(0, r * 0.1, r * 0.17, r * 0.34, 0, 0, TAU);
      ctx.fill();

    } else if (e.type === 'interceptor') {
      // twin outrigger pods
      ctx.fillStyle = '#2a1840';
      for (let s = -1; s <= 1; s += 2) {
        roundRectPath(ctx, s * r * 0.98 - r * 0.16, -r * 0.1, r * 0.32, r * 0.78, r * 0.1);
        ctx.fill();
      }
      ctx.fillStyle = hexToRgba(cfg.glow, 0.95);
      ctx.beginPath();
      ctx.ellipse(0, r * 0.12, r * 0.2, r * 0.4, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = hexToRgba(cfg.edge, 0.6);
      ctx.lineWidth = r * 0.06;
      ctx.beginPath();
      ctx.moveTo(-r * 0.3, -r * 0.5);
      ctx.lineTo(r * 0.3, -r * 0.5);
      ctx.stroke();

    } else {
      // heavy: armour plating and side cannons
      ctx.strokeStyle = 'rgba(30, 16, 8, 0.55)';
      ctx.lineWidth = r * 0.08;
      ctx.beginPath();
      ctx.moveTo(-r * 0.95, -r * 0.1);
      ctx.lineTo(r * 0.95, -r * 0.1);
      ctx.moveTo(-r * 0.7, r * 0.38);
      ctx.lineTo(r * 0.7, r * 0.38);
      ctx.stroke();

      ctx.fillStyle = '#3a2412';
      for (let s = -1; s <= 1; s += 2) {
        roundRectPath(ctx, s * r * 0.92 - r * 0.13, r * 0.3, r * 0.26, r * 0.62, r * 0.07);
        ctx.fill();
      }
      ctx.fillStyle = hexToRgba(cfg.glow, 0.95);
      ctx.beginPath();
      ctx.ellipse(0, r * 0.22, r * 0.3, r * 0.26, 0, 0, TAU);
      ctx.fill();
    }

    // white impact flash
    if (e.hitFlash > 0) {
      hullPath(ctx, hull, r);
      ctx.fillStyle = 'rgba(255,255,255,' + Math.min(0.85, e.hitFlash * 7).toFixed(3) + ')';
      ctx.fill();
    }

    ctx.restore();

    // damage bar for tougher ships that have taken a hit
    if (e.maxHp > 1 && e.hp < e.maxHp) {
      const w = r * 1.9;
      const h = 3.2;
      const x = e.x - w / 2;
      const y = e.y - r * 1.45;
      ctx.fillStyle = 'rgba(8, 10, 20, 0.7)';
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = hexToRgba(cfg.glow, 0.95);
      ctx.fillRect(x, y, w * (e.hp / e.maxHp), h);
    }
  }
}
