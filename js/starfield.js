/* ==========================================================================
   STARFIELD - parallax background.
   Three star layers scroll downward at different speeds for depth, over a
   pre-rendered nebula canvas that scrolls very slowly. The nebula is baked
   once per resize because large radial gradients are far too expensive to
   build every frame.
   ========================================================================== */

class Starfield {
  constructor() {
    this.width = 0;
    this.height = 0;
    this.layers = [];
    this.nebula = null;
    this.nebulaOffset = 0;
  }

  resize(width, height) {
    this.width = width;
    this.height = height;
    this._buildStars();
    this._buildNebula();
  }

  _buildStars() {
    const area = this.width * this.height;
    this.layers = CONFIG.stars.layers.map((cfg) => {
      const count = Math.max(12, Math.round(cfg.density * area / 10000));
      const stars = new Array(count);
      for (let i = 0; i < count; i++) {
        stars[i] = {
          x: Math.random() * this.width,
          y: Math.random() * this.height,
          r: randRange(cfg.minR, cfg.maxR),
          // small per-star speed variation keeps it from looking like a grid
          speed: cfg.speed * randRange(0.85, 1.15),
          phase: Math.random() * TAU,
          twinkleRate: randRange(1.4, 3.2)
        };
      }
      return { cfg: cfg, stars: stars };
    });
  }

  _buildNebula() {
    if (this.width <= 0 || this.height <= 0) return;

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(this.width));
    canvas.height = Math.max(1, Math.round(this.height));
    const g = canvas.getContext('2d');

    const clouds = [
      { x: 0.18, y: 0.22, r: 0.55, color: '#1b3a8f', a: 0.26 },
      { x: 0.82, y: 0.38, r: 0.48, color: '#0f5f7a', a: 0.20 },
      { x: 0.46, y: 0.78, r: 0.62, color: '#3a1c6e', a: 0.24 },
      { x: 0.68, y: 0.06, r: 0.34, color: '#123a6b', a: 0.18 }
    ];

    const span = Math.max(canvas.width, canvas.height);
    for (let i = 0; i < clouds.length; i++) {
      const c = clouds[i];
      const cx = c.x * canvas.width;
      const radius = c.r * span;

      // Each cloud is painted three times - one tile above, in place, and
      // one below - so the texture is vertically periodic and scrolls
      // without a visible seam.
      for (let copy = -1; copy <= 1; copy++) {
        const cy = c.y * canvas.height + copy * canvas.height;
        const grad = g.createRadialGradient(cx, cy, 0, cx, cy, radius);
        grad.addColorStop(0, hexToRgba(c.color, c.a));
        grad.addColorStop(0.5, hexToRgba(c.color, c.a * 0.42));
        grad.addColorStop(1, hexToRgba(c.color, 0));
        g.fillStyle = grad;
        g.fillRect(0, 0, canvas.width, canvas.height);
      }
    }

    this.nebula = canvas;
  }

  update(dt) {
    for (let l = 0; l < this.layers.length; l++) {
      const stars = this.layers[l].stars;
      for (let i = 0; i < stars.length; i++) {
        const star = stars[i];
        star.y += star.speed * dt;
        if (star.y - star.r > this.height) {
          star.y = -star.r;
          star.x = Math.random() * this.width; // re-randomise for variety
        }
      }
    }

    this.nebulaOffset += CONFIG.stars.nebulaSpeed * dt;
    if (this.nebulaOffset >= this.height) this.nebulaOffset -= this.height;
  }

  render(ctx, time) {
    // Deep space base tint
    ctx.fillStyle = '#05080f';
    ctx.fillRect(0, 0, this.width, this.height);

    if (this.nebula) {
      const y = this.nebulaOffset;
      ctx.drawImage(this.nebula, 0, y - this.height, this.width, this.height);
      ctx.drawImage(this.nebula, 0, y, this.width, this.height);
    }

    for (let l = 0; l < this.layers.length; l++) {
      const layer = this.layers[l];
      const stars = layer.stars;
      const twinkle = layer.cfg.twinkle;

      if (!twinkle) {
        // Flat layers: one fillStyle for the whole batch (cheap).
        ctx.fillStyle = 'rgba(214, 236, 255, ' + layer.cfg.alpha + ')';
        for (let i = 0; i < stars.length; i++) {
          const s = stars[i];
          ctx.fillRect(s.x, s.y, s.r, s.r);
        }
      } else {
        // Bright foreground layer gets twinkle + a soft glow.
        for (let i = 0; i < stars.length; i++) {
          const s = stars[i];
          const a = layer.cfg.alpha * (0.6 + 0.4 * Math.sin(time * s.twinkleRate + s.phase));
          ctx.fillStyle = 'rgba(236, 248, 255, ' + a.toFixed(3) + ')';
          ctx.fillRect(s.x - s.r * 0.5, s.y - s.r * 0.5, s.r * 1.6, s.r * 1.6);
        }
      }
    }
  }
}
