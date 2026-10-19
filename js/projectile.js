/* ==========================================================================
   PROJECTILES - the player's glowing blue energy bolts.
   Pooled, capped, and culled the moment they leave the world. A bolt is
   destroyed on its first hit, which is what guarantees one projectile can
   never damage the same enemy twice.
   ========================================================================== */

function createBullet() {
  return { x: 0, y: 0, vx: 0, vy: 0, radius: 5, damage: 1, age: 0 };
}

class BulletManager {
  constructor() {
    this.pool = new Pool(createBullet, CONFIG.bullet.max);
  }

  get count() {
    return this.pool.count;
  }

  clear() {
    this.pool.clear();
  }

  /** angle is in radians; -PI/2 points straight up. */
  spawn(x, y, angle) {
    const b = this.pool.obtain();
    if (b === null) return null;
    const cfg = CONFIG.bullet;
    b.x = x;
    b.y = y;
    b.vx = Math.cos(angle) * cfg.speed;
    b.vy = Math.sin(angle) * cfg.speed;
    b.radius = cfg.radius;
    b.damage = cfg.damage;
    b.age = 0;
    return b;
  }

  update(dt, game) {
    const active = this.pool.active;
    const margin = 40;
    for (let i = active.length - 1; i >= 0; i--) {
      const b = active[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.age += dt;
      if (b.y < -margin || b.y > game.worldH + margin ||
          b.x < -margin || b.x > game.worldW + margin) {
        this.pool.releaseAt(i);
      }
    }
  }

  render(ctx) {
    const active = this.pool.active;
    if (active.length === 0) return;

    ctx.globalCompositeOperation = 'lighter';

    // Outer glow halo
    for (let i = 0; i < active.length; i++) {
      const b = active[i];
      drawGlow(ctx, '#2b7cff', b.x, b.y, b.radius * 7.5, 0.5);
    }

    // Tapered trail behind each bolt
    ctx.strokeStyle = 'rgba(88, 232, 255, 0.55)';
    ctx.lineCap = 'round';
    ctx.lineWidth = CONFIG.bullet.radius * 1.15;
    ctx.beginPath();
    for (let i = 0; i < active.length; i++) {
      const b = active[i];
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - b.vx * 0.030, b.y - b.vy * 0.030);
    }
    ctx.stroke();

    // Bright inner core
    ctx.strokeStyle = 'rgba(228, 252, 255, 0.95)';
    ctx.lineWidth = CONFIG.bullet.radius * 0.5;
    ctx.beginPath();
    for (let i = 0; i < active.length; i++) {
      const b = active[i];
      ctx.moveTo(b.x, b.y + 1);
      ctx.lineTo(b.x - b.vx * 0.014, b.y - b.vy * 0.014);
    }
    ctx.stroke();

    // Hot tip
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < active.length; i++) {
      const b = active[i];
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius * 0.42, 0, TAU);
      ctx.fill();
    }

    ctx.globalCompositeOperation = 'source-over';
    ctx.lineCap = 'butt';
  }
}
