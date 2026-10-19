/* ==========================================================================
   GAME - the state machine, the single requestAnimationFrame loop, the
   viewport mapping and all cross-system wiring (collisions, scoring,
   lives, drops, screen shake).

   States: 'menu' -> 'playing' <-> 'paused' -> 'gameover' -> ...
   ========================================================================== */

class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });

    /* logical world + how it maps onto the canvas backing store */
    this.worldW = 1280;
    this.worldH = CONFIG.world.designHeight;
    this.renderScale = 1;
    this.offsetX = 0;
    this.offsetY = 0;

    /* run state */
    this.state = 'menu';
    this.time = 0;
    this.score = 0;
    this.lives = CONFIG.player.startLives;
    this.level = 0;
    this.highScore = loadHighScore();

    /* systems */
    this.input = new InputManager();
    this.audio = new AudioManager();
    this.starfield = new Starfield();
    this.particles = new ParticleSystem();
    this.bullets = new BulletManager();
    this.enemies = new EnemyManager();
    this.powerups = new PowerUpManager();
    this.player = new Player();
    this.ui = new UIManager(this);

    /* presentation */
    this.shakeMag = 0;
    this.shakeX = 0;
    this.shakeY = 0;
    this.hitFlashTime = 0;     // seconds left on the red damage flash

    /* loop bookkeeping */
    this.running = false;
    this.lastTime = 0;
    this.fps = 60;
    this._fpsTime = 0;
    this._fpsFrames = 0;
    this.debug = false;
    this._resizeQueued = false;
    this._frame = this._frame.bind(this);

    this._bindWindowEvents();
    this.resize();
    this.player.reset(this.worldW / 2, this.worldH * 0.78);
    this.ui.showState('menu');
    this.ui.setMuted(this.audio.muted);
  }

  /* ======================================================================
     Viewport
     ====================================================================== */

  _bindWindowEvents() {
    window.addEventListener('resize', () => this._queueResize());
    window.addEventListener('orientationchange', () => this._queueResize());

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        // Auto-pause so the player does not come back to a dead ship.
        if (this.state === 'playing') this.pause();
      } else {
        // Resume timing cleanly - no giant delta jump.
        this.lastTime = performance.now();
      }
    });

    // Browsers only allow audio after a gesture; this is that gesture.
    const unlock = () => this.audio.unlock();
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock, { passive: true });
  }

  /** Coalesce resize storms into one recalculation per frame. */
  _queueResize() {
    if (this._resizeQueued) return;
    this._resizeQueued = true;
    requestAnimationFrame(() => {
      this._resizeQueued = false;
      this.resize();
    });
  }

  resize() {
    const cssW = Math.max(1, window.innerWidth);
    const cssH = Math.max(1, window.innerHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, CONFIG.world.maxDpr);

    this.canvas.style.width = cssW + 'px';
    this.canvas.style.height = cssH + 'px';
    this.canvas.width = Math.max(1, Math.round(cssW * dpr));
    this.canvas.height = Math.max(1, Math.round(cssH * dpr));

    // The world is always designHeight tall; its width follows the window
    // aspect ratio, clamped so extreme windows letterbox instead of
    // distorting. Objects are therefore never stretched.
    const aspect = clamp(cssW / cssH, CONFIG.world.minAspect, CONFIG.world.maxAspect);
    this.worldH = CONFIG.world.designHeight;
    this.worldW = this.worldH * aspect;

    const viewScale = Math.min(cssW / this.worldW, cssH / this.worldH);
    this.renderScale = viewScale * dpr;
    this.offsetX = (cssW - this.worldW * viewScale) * 0.5 * dpr;
    this.offsetY = (cssH - this.worldH * viewScale) * 0.5 * dpr;

    this.starfield.resize(this.worldW, this.worldH);

    // Keep everything that must stay on screen on screen.
    const m = this.player.radius + CONFIG.player.edgeMargin;
    this.player.x = clamp(this.player.x, m, this.worldW - m);
    this.player.y = clamp(this.player.y, m, this.worldH - m);
    const enemies = this.enemies.pool.active;
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      e.baseX = clamp(e.baseX, e.radius, this.worldW - e.radius);
      e.x = clamp(e.x, e.radius, this.worldW - e.radius);
    }
  }

  /* ======================================================================
     Loop
     ====================================================================== */

  /** Starts the single rAF loop. Calling it twice is a no-op. */
  start() {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    requestAnimationFrame(this._frame);
  }

  _frame(now) {
    let dt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    if (!isFinite(dt) || dt < 0) dt = 0;
    dt = Math.min(dt, CONFIG.loop.maxDelta); // clamp after stalls/tab switches

    this._fpsTime += dt;
    this._fpsFrames++;
    if (this._fpsTime >= 0.5) {
      this.fps = this._fpsFrames / this._fpsTime;
      this._fpsTime = 0;
      this._fpsFrames = 0;
    }

    this.update(dt);
    this.render();
    this.input.endFrame();

    requestAnimationFrame(this._frame);
  }

  /* ======================================================================
     Update
     ====================================================================== */

  update(dt) {
    this._handleGlobalKeys();

    if (this.state === 'paused') {
      // Nothing advances: no entities, no particles, no timers, no stars.
      return;
    }

    this.time += dt;

    if (this.state === 'menu') {
      this.starfield.update(dt);
      this.particles.update(dt);
      return;
    }

    if (this.state === 'gameover') {
      // Combat is over; only the ambience and the death debris finish.
      this.starfield.update(dt * 0.35);
      this.particles.update(dt);
      this._updateShake(dt);
      if (this.hitFlashTime > 0) this.hitFlashTime = Math.max(0, this.hitFlashTime - dt);
      return;
    }

    /* ---- playing -------------------------------------------------------- */
    this.starfield.update(dt);
    this.player.update(dt, this.input, this);
    this.enemies.update(dt, this);
    this.bullets.update(dt, this);
    this.powerups.update(dt, this);
    this.particles.update(dt);
    this._resolveCollisions();
    this._updateShake(dt);
    if (this.hitFlashTime > 0) this.hitFlashTime = Math.max(0, this.hitFlashTime - dt);

    this.level = Math.min(
      CONFIG.difficulty.maxLevel,
      Math.floor(this.score / CONFIG.difficulty.scorePerLevel)
    );
  }

  _handleGlobalKeys() {
    if (this.input.consume('KeyM')) this.toggleMute();

    if (this.input.consume('KeyF')) this.debug = !this.debug;

    const pauseKey = this.input.consume('KeyP') || this.input.consume('Escape');
    if (pauseKey) {
      if (this.state === 'playing') this.pause();
      else if (this.state === 'paused') this.resume();
    }

    if (this.input.consume('Enter')) {
      if (this.state === 'menu' || this.state === 'gameover') this.startGame();
    }
  }

  /* ======================================================================
     Collisions and combat
     ====================================================================== */

  _resolveCollisions() {
    const bullets = this.bullets.pool.active;
    const enemies = this.enemies.pool.active;

    /* bullets -> enemies. A bullet dies on its first hit, so it can never
       damage the same enemy on a later frame. */
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      for (let j = enemies.length - 1; j >= 0; j--) {
        const e = enemies[j];
        if (circlesOverlap(b.x, b.y, b.radius, e.x, e.y, e.radius)) {
          this._damageEnemy(j, b.damage, b.x, b.y);
          this.bullets.pool.releaseAt(i);
          break;
        }
      }
    }

    if (!this.player.alive) return;

    const hitRadius = this.player.radius * CONFIG.player.collisionScale;

    if (this.player.shieldActive) {
      /* Shield up: anything that touches the bubble is vaporised and the
         player takes no damage. No score, same as any other ramming kill. */
      const shieldRadius = this.player.radius * 2.15;
      for (let j = enemies.length - 1; j >= 0; j--) {
        const e = enemies[j];
        if (circlesOverlap(this.player.x, this.player.y, shieldRadius, e.x, e.y, e.radius)) {
          this._destroyEnemy(j, false);
        }
      }
    } else if (this.player.invulnTime <= 0) {
      /* player -> enemies: exactly one life per collision event, and the
         colliding enemy is removed so the same contact cannot hit twice. */
      for (let j = enemies.length - 1; j >= 0; j--) {
        const e = enemies[j];
        if (circlesOverlap(this.player.x, this.player.y, hitRadius, e.x, e.y, e.radius)) {
          this._destroyEnemy(j, false);
          this._hitPlayer();
          break;
        }
      }
    }

    if (!this.player.alive) return;

    /* player -> power-ups */
    const powerups = this.powerups.pool.active;
    for (let k = powerups.length - 1; k >= 0; k--) {
      const p = powerups[k];
      if (circlesOverlap(this.player.x, this.player.y, this.player.radius, p.x, p.y, p.radius)) {
        // Collecting the same type again refreshes its timer rather than
        // stacking, and the two effects run happily side by side.
        if (p.type === 'shield') {
          this.player.activateShield();
          this.particles.pickupBurst(p.x, p.y, '#4a86ff');
        } else {
          this.player.activateMultiShot();
          this.particles.pickupBurst(p.x, p.y, '#58e8ff');
        }
        this.audio.pickup(p.type === 'shield');
        this.powerups.pool.releaseAt(k);
      }
    }
  }

  _damageEnemy(index, damage, hitX, hitY) {
    const e = this.enemies.pool.active[index];
    e.hp -= damage;
    e.hitFlash = 0.12;
    this.particles.impact(hitX, hitY);   // orange spark burst

    if (e.hp <= 0) {
      this._destroyEnemy(index, true);   // score is awarded here only
    } else {
      this.audio.hit();
    }
  }

  /** awardScore is false when the player rams a ship - no points for that. */
  _destroyEnemy(index, awardScore) {
    const e = this.enemies.pool.active[index];
    const x = e.x;
    const y = e.y;
    const radius = e.radius;
    const isHeavy = e.type === 'heavy';

    this.particles.explosion(x, y, radius);
    this.audio.explosion(radius / 16);
    this.addShake(isHeavy ? CONFIG.shake.heavyKill : CONFIG.shake.normalKill);

    if (awardScore) {
      this.score += e.score;
      if (Math.random() < CONFIG.powerup.dropChance) {
        this.powerups.spawn(x, y);
      }
    }

    this.enemies.pool.releaseAt(index);
  }

  _hitPlayer() {
    if (!this.player.takeDamage()) return;    // invulnerable / shielded

    this.lives = Math.max(0, this.lives - 1); // never negative
    this.particles.playerHit(this.player.x, this.player.y);
    this.audio.damage();
    this.addShake(CONFIG.shake.playerHit);
    this.hitFlashTime = CONFIG.hitFlash.duration;   // red screen flash

    if (this.lives <= 0) this._endGame();
  }

  _endGame() {
    if (this.state === 'gameover') return;    // only ever happens once

    this.state = 'gameover';
    this.player.alive = false;
    this.particles.explosion(this.player.x, this.player.y, 34,
      CONFIG.particles.explosionPalette);
    this.particles.explosion(this.player.x, this.player.y, 26,
      CONFIG.particles.energyPalette);
    this.addShake(CONFIG.shake.death);
    this.audio.gameOver();

    const isRecord = this.score > this.highScore;
    if (isRecord) {
      this.highScore = this.score;
      saveHighScore(this.highScore);
    }
    this.ui.setGameOverScores(this.score, this.highScore, isRecord);
    this.ui.showState('gameover');
  }

  /* ======================================================================
     State transitions
     ====================================================================== */

  /** Full reset - no entity, timer or weapon state survives from last run. */
  startGame() {
    this.audio.unlock();

    this.score = 0;
    this.lives = CONFIG.player.startLives;
    this.level = 0;
    this.shakeMag = 0;
    this.shakeX = 0;
    this.shakeY = 0;
    this.hitFlashTime = 0;

    this.bullets.clear();
    this.powerups.clear();
    this.particles.clear();
    this.enemies.reset();
    this.player.reset(this.worldW / 2, this.worldH * 0.78);

    this.state = 'playing';
    this.ui.showState('playing');
    this.audio.gameStart();
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    // Held keys are deliberately kept: key-up events still arrive while
    // paused, and InputManager wipes the state on focus loss, so the ship
    // keeps flying if the player never let go.
    this.ui.showState('paused');
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.lastTime = performance.now();
    this.ui.showState('playing');
  }

  toMenu() {
    this.state = 'menu';
    this.bullets.clear();
    this.powerups.clear();
    this.particles.clear();
    this.enemies.reset();
    this.player.reset(this.worldW / 2, this.worldH * 0.78);
    this.input.clear();
    this.shakeMag = 0;
    this.hitFlashTime = 0;
    this.ui.showState('menu');
  }

  toggleMute() {
    this.audio.unlock();
    const muted = this.audio.toggleMute();
    this.ui.setMuted(muted);
  }

  /* ======================================================================
     Screen shake
     ====================================================================== */

  addShake(magnitude) {
    this.shakeMag = Math.min(CONFIG.shake.max, this.shakeMag + magnitude);
  }

  _updateShake(dt) {
    if (this.shakeMag <= 0) {
      this.shakeX = 0;
      this.shakeY = 0;
      return;
    }
    this.shakeMag *= Math.exp(-CONFIG.shake.decay * dt);
    if (this.shakeMag < 0.12) this.shakeMag = 0;
    this.shakeX = randRange(-this.shakeMag, this.shakeMag);
    this.shakeY = randRange(-this.shakeMag, this.shakeMag);
  }

  /* ======================================================================
     Render
     ====================================================================== */

  render() {
    const ctx = this.ctx;

    // Clear the whole backing store (letterbox bars included).
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#02040a';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.save();
    ctx.setTransform(this.renderScale, 0, 0, this.renderScale, this.offsetX, this.offsetY);
    ctx.beginPath();
    ctx.rect(0, 0, this.worldW, this.worldH);
    ctx.clip();

    // Background is not shaken, so shake never reveals empty edges.
    this.starfield.render(ctx, this.time);

    ctx.save();
    ctx.translate(this.shakeX, this.shakeY);
    this.powerups.render(ctx, this.time);
    this.enemies.render(ctx, this.time);
    this.bullets.render(ctx);
    if (this.player.alive && this.state !== 'menu') this.player.render(ctx, this.time);
    this.particles.render(ctx);
    ctx.restore();

    this._renderDamageFlash(ctx);

    if (this.state !== 'menu') drawHud(ctx, this);

    ctx.restore();
  }

  /** Full-screen red wash after the player is hit. */
  _renderDamageFlash(ctx) {
    if (this.hitFlashTime <= 0) return;

    const t = this.hitFlashTime / CONFIG.hitFlash.duration;   // 1 -> 0
    const alpha = CONFIG.hitFlash.maxAlpha * Math.pow(t, 1.35);

    ctx.fillStyle = 'rgba(255, 26, 58, ' + alpha.toFixed(3) + ')';
    ctx.fillRect(0, 0, this.worldW, this.worldH);

    // Darker, angrier edges so the centre of the screen stays readable.
    const cx = this.worldW / 2;
    const cy = this.worldH / 2;
    const inner = Math.min(this.worldW, this.worldH) * 0.26;
    const outer = Math.max(this.worldW, this.worldH) * 0.72;
    const vignette = ctx.createRadialGradient(cx, cy, inner, cx, cy, outer);
    vignette.addColorStop(0, 'rgba(190, 0, 28, 0)');
    vignette.addColorStop(1, 'rgba(190, 0, 28, ' + Math.min(0.85, alpha * 1.7).toFixed(3) + ')');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, this.worldW, this.worldH);
  }
}
