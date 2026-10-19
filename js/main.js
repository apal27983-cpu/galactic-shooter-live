/* ==========================================================================
   MAIN - entry point. Creates exactly one Game and starts exactly one loop.
   ========================================================================== */

(function () {
  'use strict';

  let game = null;

  function boot() {
    if (game !== null) return;   // guard against a double boot

    const canvas = document.getElementById('game-canvas');
    if (!canvas || !canvas.getContext) {
      document.body.innerHTML =
        '<p style="color:#9ef4ff;font-family:sans-serif;padding:32px">' +
        'This game needs a browser with HTML5 Canvas support.</p>';
      return;
    }

    game = new Game(canvas);
    game.start();

    // Handy for debugging from the console (press F in-game for counters).
    window.__starfall = game;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
