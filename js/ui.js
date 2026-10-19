/* ==========================================================================
   UI - two halves:
     1. UIManager: the DOM overlays (menu / pause / game over) and the sound
        chip. Listeners are attached once; overlays are toggled by class.
     2. drawHud(): the in-game HUD, drawn on the canvas. Keeping it on the
        canvas means zero DOM work inside the game loop and it lines up
        perfectly with the letterboxed world.
   ========================================================================== */

const FONT_UI = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';
const FONT_NUM = '"Consolas", "SF Mono", ui-monospace, monospace';

class UIManager {
  constructor(game) {
    this.game = game;

    this.menuOverlay = document.getElementById('menu-overlay');
    this.pauseOverlay = document.getElementById('pause-overlay');
    this.gameOverOverlay = document.getElementById('gameover-overlay');
    this.finalScoreEl = document.getElementById('final-score');
    this.bestScoreEl = document.getElementById('best-score');
    this.recordEl = document.getElementById('new-record');
    this.muteButton = document.getElementById('mute-button');
    this.muteState = document.getElementById('mute-state');

    this._bindButtons();
  }

  _bindButtons() {
    const game = this.game;

    this._on('start-button', () => game.startGame());
    this._on('resume-button', () => game.resume());
    this._on('pause-menu-button', () => game.toMenu());
    this._on('restart-button', () => game.startGame());
    this._on('gameover-menu-button', () => game.toMenu());

    if (this.muteButton) {
      this.muteButton.addEventListener('click', () => {
        game.toggleMute();
        this.muteButton.blur(); // keep keyboard focus out of the button
      });
    }
  }

  _on(id, handler) {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('click', (event) => {
        event.preventDefault();
        handler();
        el.blur();
      });
    }
  }

  /** Shows exactly the overlay that belongs to the given state. */
  showState(state) {
    this._toggle(this.menuOverlay, state === 'menu');
    this._toggle(this.pauseOverlay, state === 'paused');
    this._toggle(this.gameOverOverlay, state === 'gameover');
  }

  _toggle(el, visible) {
    if (!el) return;
    if (visible) {
      // Re-trigger the CSS entry animation each time it is shown.
      el.classList.remove('hidden');
      void el.offsetWidth;
    } else {
      el.classList.add('hidden');
    }
  }

  setGameOverScores(score, best, isRecord) {
    if (this.finalScoreEl) this.finalScoreEl.textContent = formatScore(score);
    if (this.bestScoreEl) this.bestScoreEl.textContent = formatScore(best);
    if (this.recordEl) this.recordEl.classList.toggle('hidden', !isRecord);
  }

  setMuted(muted) {
    if (this.muteState) this.muteState.textContent = muted ? 'OFF' : 'ON';
    if (this.muteButton) this.muteButton.classList.toggle('muted', muted);
  }
}

/* ==========================================================================
   Canvas HUD
   ========================================================================== */

/* --------------------------------------------------------------------------
   Lives are drawn as hearts built from an SVG path (a 24x24 icon outline),
   rendered onto the canvas with Path2D. Using the icon geometry directly
   keeps the HUD on the canvas, so the game loop still touches no DOM.
   -------------------------------------------------------------------------- */

const HEART_SVG_PATH =
  'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3' +
  'c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5' +
  'c0 3.78-3.4 6.86-8.55 11.54L12 21.35z';

/* Built once. Falls back to null on anything that cannot parse SVG paths. */
const HEART_PATH = (function () {
  try {
    return new Path2D(HEART_SVG_PATH);
  } catch (err) {
    return null;
  }
})();

/**
 * One life heart. Full hearts glow red and pulse gently; spent hearts are
 * left as a dim hollow outline so you can see what you have lost.
 */
function drawHeartIcon(ctx, x, y, size, filled, time, index) {
  if (filled) {
    // red bloom behind the heart
    const pulse = 0.78 + 0.22 * Math.sin(time * 3.1 + index * 0.9);
    ctx.globalCompositeOperation = 'lighter';
    drawGlow(ctx, '#ff2f55', x, y, size * 3.1, 0.42 * pulse);
    ctx.globalCompositeOperation = 'source-over';
  }

  ctx.save();
  ctx.translate(x, y);
  const scale = size / 24;
  ctx.scale(scale, scale);
  ctx.translate(-12, -12);

  if (HEART_PATH === null) {
    ctx.restore();
    return;
  }

  if (filled) {
    const grad = ctx.createLinearGradient(0, 2, 0, 22);
    grad.addColorStop(0, '#ff8fa3');
    grad.addColorStop(0.45, '#ff2f55');
    grad.addColorStop(1, '#b80029');
    ctx.fillStyle = grad;
    ctx.fill(HEART_PATH);
    ctx.strokeStyle = 'rgba(255, 214, 224, 0.95)';
    ctx.lineWidth = 1.3;
    ctx.stroke(HEART_PATH);

    // small specular highlight
    ctx.globalAlpha = 0.65;
    ctx.fillStyle = '#ffd9e1';
    ctx.beginPath();
    ctx.ellipse(8.6, 8.4, 1.9, 1.3, -0.6, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  } else {
    ctx.fillStyle = 'rgba(70, 22, 34, 0.5)';
    ctx.fill(HEART_PATH);
    ctx.strokeStyle = 'rgba(168, 96, 114, 0.55)';
    ctx.lineWidth = 1.3;
    ctx.stroke(HEART_PATH);
  }

  ctx.restore();
}

/** One power-up status chip: label, remaining seconds and a countdown bar. */
function drawStatusChip(ctx, x, y, label, remaining, duration, color) {
  const boxW = 176;
  const boxH = 34;

  roundRectPath(ctx, x, y, boxW, boxH, 8);
  ctx.fillStyle = 'rgba(6, 20, 44, 0.66)';
  ctx.fill();
  ctx.strokeStyle = hexToRgba(color, 0.6);
  ctx.lineWidth = 1.3;
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.font = '700 12px ' + FONT_UI;
  ctx.fillText(label, x + 11, y + 12);

  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(240, 248, 255, 0.95)';
  ctx.font = '700 12px ' + FONT_NUM;
  ctx.fillText(remaining.toFixed(1) + 's', x + boxW - 11, y + 12);

  const trackX = x + 11;
  const trackY = y + 21;
  const trackW = boxW - 22;
  const ratio = clamp(remaining / duration, 0, 1);
  ctx.fillStyle = 'rgba(12, 32, 64, 0.9)';
  roundRectPath(ctx, trackX, trackY, trackW, 5, 2.5);
  ctx.fill();
  ctx.fillStyle = ratio < 0.3 ? '#ffd166' : color;
  roundRectPath(ctx, trackX, trackY, Math.max(2, trackW * ratio), 5, 2.5);
  ctx.fill();

  return boxW;
}

function drawHud(ctx, game) {
  const pad = 18;
  const barH = 56;
  const w = game.worldW - pad * 2;

  /* ---- translucent panel ---------------------------------------------- */
  roundRectPath(ctx, pad, pad, w, barH, 10);
  ctx.fillStyle = 'rgba(6, 14, 30, 0.58)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(88, 232, 255, 0.3)';
  ctx.lineWidth = 1.4;
  ctx.stroke();

  const midY = pad + barH / 2;

  /* ---- score (left) ---------------------------------------------------- */
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(166, 242, 255, 0.72)';
  ctx.font = '700 11px ' + FONT_UI;
  ctx.fillText('S C O R E', pad + 18, midY - 13);

  ctx.fillStyle = '#ffffff';
  ctx.font = '700 29px ' + FONT_NUM;
  ctx.fillText(formatScore(game.score), pad + 18, midY + 9);

  /* ---- wave (centre) --------------------------------------------------- */
  const centreX = game.worldW / 2;
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(166, 242, 255, 0.72)';
  ctx.font = '700 11px ' + FONT_UI;
  ctx.fillText('W A V E', centreX, midY - 13);
  ctx.fillStyle = '#d7f4ff';
  ctx.font = '700 21px ' + FONT_NUM;
  ctx.fillText(String(game.level + 1), centreX, midY + 10);

  /* ---- lives, as red hearts (right) ------------------------------------ */
  const heartSize = 21;
  const heartGap = 29;
  const total = CONFIG.player.startLives;
  const heartsRight = game.worldW - pad - 20;
  for (let i = 0; i < total; i++) {
    // right-aligned row: index 0 is the leftmost heart
    const x = heartsRight - (total - 1 - i) * heartGap;
    drawHeartIcon(ctx, x, midY, heartSize, i < game.lives, game.time, i);
  }

  /* ---- power-up status chips ------------------------------------------- */
  let chipX = pad;
  const chipY = pad + barH + 9;
  if (game.player.multiShotActive) {
    chipX += drawStatusChip(ctx, chipX, chipY, 'MULTI-SHOT',
      game.player.multiShotTime, CONFIG.powerup.multiShotDuration, '#58e8ff') + 9;
  }
  if (game.player.shieldActive) {
    drawStatusChip(ctx, chipX, chipY, 'SHIELD',
      game.player.shieldTime, CONFIG.powerup.shieldDuration, '#7aa8ff');
  }

  /* ---- paused / game over banner on the canvas ------------------------- */
  if (game.state === 'paused' || game.state === 'gameover') {
    ctx.fillStyle = 'rgba(2, 6, 14, 0.35)';
    ctx.fillRect(0, 0, game.worldW, game.worldH);
  }

  /* ---- diagnostics ----------------------------------------------------- */
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = '600 11px ' + FONT_NUM;
  ctx.fillStyle = 'rgba(150, 190, 220, 0.45)';
  let info = Math.round(game.fps) + ' FPS';
  if (game.debug) {
    info += '   E:' + game.enemies.count +
            '  B:' + game.bullets.count +
            '  P:' + game.particles.count +
            '  U:' + game.powerups.count;
  }
  ctx.fillText(info, pad + 2, game.worldH - pad);
}
