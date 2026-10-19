/* ==========================================================================
   INPUT - keyboard state tracking.
   Listeners are registered exactly once. Keys are tracked by e.code so the
   layout is independent of keyboard language. Key-repeat is ignored for
   "just pressed" edges, and the state is wiped whenever the window loses
   focus so the ship can never get stuck flying into a wall.
   ========================================================================== */

/* Keys the game owns - the browser must not scroll or act on these. */
const GAME_KEYS = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'Space', 'KeyP', 'Escape', 'Enter', 'KeyM'
]);

class InputManager {
  constructor() {
    this.down = new Set();      // currently held
    this.pressed = new Set();   // pressed since the last frame ended
    this._bound = false;
    this.bind();
  }

  bind() {
    if (this._bound) return;    // never register listeners twice
    this._bound = true;

    this._onKeyDown = (event) => {
      if (GAME_KEYS.has(event.code)) event.preventDefault();
      if (event.repeat) return;                 // ignore OS key-repeat
      if (!this.down.has(event.code)) this.pressed.add(event.code);
      this.down.add(event.code);
    };

    this._onKeyUp = (event) => {
      if (GAME_KEYS.has(event.code)) event.preventDefault();
      this.down.delete(event.code);
    };

    this._onBlur = () => this.clear();

    window.addEventListener('keydown', this._onKeyDown, { passive: false });
    window.addEventListener('keyup', this._onKeyUp, { passive: false });
    window.addEventListener('blur', this._onBlur);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.clear();
    });
  }

  isDown(code) {
    return this.down.has(code);
  }

  /** True once per physical press. Consumes the edge so it cannot re-fire. */
  consume(code) {
    if (this.pressed.has(code)) {
      this.pressed.delete(code);
      return true;
    }
    return false;
  }

  /** Called at the very end of every frame. */
  endFrame() {
    if (this.pressed.size > 0) this.pressed.clear();
  }

  clear() {
    this.down.clear();
    this.pressed.clear();
  }
}
