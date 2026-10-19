# STARFALL: SPACE DEFENDER

A complete 2D arcade space shooter that runs in your web browser. No installs,
no accounts, no internet connection needed once the files are on your computer.

Built with plain HTML, CSS and JavaScript on an HTML5 Canvas. Every spaceship,
star, laser bolt and explosion is drawn with code — there are no image or sound
files to download.

---

## How to run it (simple instructions)

### Easiest way: double-click

Open the `Space-Shooter-Game` folder and double-click **`index.html`**.
It should open in your default browser and the game starts at the title screen.

### If that does not work: use a mini web server

Some browsers are strict about opening local files. If the page looks broken,
use this instead. You only need to do this once per session.

1. Open a terminal **inside the project folder** (on Windows: open the folder,
   then type `cmd` in the address bar and press Enter).
2. Run:

```bash
python -m http.server 8123
```

3. Leave that window open, open your browser, and go to:

```
http://localhost:8123
```

4. When you are finished, click the command prompt window and press `Ctrl + C`
   to stop the server.

> If `python` is not recognised, you can use Node.js instead:
> `npx --yes serve -l 8123` from the same folder.

---

## Controls

| Key | What it does |
| --- | --- |
| `W` | Fly up |
| `A` | Fly left |
| `S` | Fly down |
| `D` | Fly right |
| `Space` | Fire (hold it down for continuous fire) |
| `P` or `Esc` | Pause / resume |
| `Enter` | Start the game, or restart after Game Over |
| `M` | Mute / unmute sound |
| `F` | Show entity counters (for debugging) |

Arrow keys also work for flying. You can hold several keys at once — flying
diagonally is not faster than flying straight.

---

## How to play

- You start with **3 lives**, shown as three red hearts in the top-right
  corner. Touching an enemy ship costs **one** life: the screen flashes red
  for a second, the ship shakes and a heart goes dark.
- After a hit you get about **1.5 seconds of mercy time** so one bad moment
  does not cost every life at once.
- Destroying an enemy scores points. Letting one fly past costs nothing, but
  it does not score either.
- Every **400 points** the wave number goes up: enemies arrive faster, fly
  faster and take more hits.
- When your last life is gone the game ends and your score is saved as your
  personal best.

### Power-ups

Two power-ups fall through the battlefield. They drop from destroyed enemies
(**15% chance** each) and also rain down from the sky on their own every
**9–16 seconds**. Fly into one to collect it.

| Power-up | Looks like | What it does |
| --- | --- | --- |
| **Multi-shot** | Cyan capsule with three bars | Fire **3 lasers at once** for **5 seconds** |
| **Blue Shield** | Blue orb with a shield crest | A glowing bubble for **6 seconds**: you take no damage, and any enemy that touches the bubble is destroyed |

Both show a countdown chip under the HUD, and the shield bubble flickers just
before it drops so you get a warning. Collecting the same type again refreshes
its timer instead of stacking, and the two can run at the same time.

### The enemies

| Ship | Look | Behaviour |
| --- | --- | --- |
| **Scout** | Small pink dart | Fast, dies to a single hit |
| **Interceptor** | Purple twin-pod fighter | Medium speed, takes a few hits, weaves widely |
| **Heavy Fighter** | Broad orange gunship | Slow, heavily armoured, worth the most points |

Tougher ships show a small damage bar once you have hurt them.

---

## What is in the game

- Parallax starfield with three layers plus a slow-drifting nebula
- Hand-drawn (code-drawn) player ship with animated engine flames and a banking tilt
- Three distinct enemy classes with their own silhouettes, colours and movement
- Glowing blue energy bolts with trails and muzzle flashes
- Two power-ups — multi-shot and blue shield — each with a countdown chip
- Orange spark burst every time a laser bites into an enemy hull
- Particle explosions: flash, shockwave ring, fire glows, sparks and tumbling debris
- Full-screen red damage flash, screen shake and hull damage flashes
- Procedural sound effects (laser, impact, explosion, two pickup chimes, damage,
  start, game over)
- Sci-fi HUD with score, wave, red heart lives and power-up status
- Main menu, pause screen and game over screen with a saved high score
- Responsive full-window canvas that adapts to any window size

---

## Project structure

```
Space-Shooter-Game/
├── index.html          Page markup, overlays and script tags
├── style.css           Page styling, menus, buttons, responsive layout
├── README.md           This file
└── js/
    ├── config.js       All tunable gameplay numbers in one place
    ├── utils.js        Maths helpers, object pool, cached glow sprites
    ├── audio.js        Web Audio sound effects
    ├── input.js        Keyboard state tracking
    ├── starfield.js    Parallax background
    ├── particle.js     Explosions, sparks, debris, shockwaves
    ├── projectile.js   Player bullets
    ├── player.js       Player ship: movement, weapons, damage, artwork
    ├── enemy.js        Enemy types, spawning, difficulty ramp
    ├── powerup.js      Triple-shot capsule
    ├── ui.js           Menu overlays and the canvas HUD
    ├── game.js         Game loop, states, collisions, scoring
    └── main.js         Startup
```

---

## Changing the difficulty

Every number worth tuning lives in **`js/config.js`**. Edit a value, save the
file and reload the page. Some useful ones:

| Setting | Meaning |
| --- | --- |
| `player.startLives` | How many lives you begin with |
| `player.speed` | How fast your ship flies |
| `player.fireInterval` | Seconds between shots (smaller = faster firing) |
| `player.invulnerableTime` | Mercy time after a hit |
| `powerup.dropChance` | Chance of a power-up drop from a kill (`0.15` = 15%) |
| `powerup.multiShotDuration` | How long multi-shot lasts (seconds) |
| `powerup.shieldDuration` | How long the blue shield lasts (seconds) |
| `powerup.randomDropMin` / `randomDropMax` | Gap between sky drops |
| `powerup.typeWeights` | How often each power-up type is chosen |
| `hitFlash.duration` / `maxAlpha` | Length and strength of the red damage flash |
| `spawn.baseInterval` | Seconds between enemy spawns at the start |
| `difficulty.scorePerLevel` | Points needed to reach the next wave |
| `enemies.types.*.hp` | How many hits each enemy class takes |
| `particles.max` | Particle budget (lower it on a very old laptop) |

---

## Technical notes

- One `requestAnimationFrame` loop, started exactly once, with delta-time
  updates clamped at 50 ms so tab switches never cause a sudden jump.
- The world is a fixed 720 logical units tall; its width follows the window's
  aspect ratio, clamped between 0.75 and 2.0 so very tall or ultra-wide windows
  get letterbox bars instead of stretched ships.
- The canvas backing store is scaled by `devicePixelRatio` (capped at 2) and
  kept separate from its CSS size, so it stays sharp on high-DPI screens
  without wasting fill rate.
- Bullets, enemies, particles and power-ups all come from fixed-size object
  pools, so no garbage accumulates during long sessions.
- Soft glows are blitted from pre-rendered sprites instead of using
  `shadowBlur` or per-frame gradients — that is the main reason the renderer
  stays cheap.
- The HUD is drawn on the canvas, so the game loop performs no DOM work.
- The game auto-pauses when you switch tabs and resumes cleanly.
- Audio starts only after your first click or key press, as browsers require,
  and the game is fully playable with sound muted or unavailable.

---

## Testing that was actually performed

Verified in a Chromium-based browser against a local server, using both real
keyboard/mouse input and a scripted harness driving the live game object:

- Menu loads with **no console errors or warnings** at any point in the session
- Start button and `Enter` both begin a new game
- `W`/`A`/`S`/`D` movement, with simultaneous keys
- Diagonal speed measured at 429.8 u/s vs 427.7 u/s straight — not faster
- `Space` held fires continuously; bullets are culled after leaving the screen
- Bullets damage enemies, destroy them at zero health, and score is awarded
  **only** on destruction (score stayed 0 while a damaged enemy was alive)
- Lives counted down 3 → 2 → 1 → 0, exactly one life per collision
- A second collision during invulnerability cost no life
- Multi-shot fired exactly 3 bolts at −1.78 / −1.57 / −1.36 rad, lasted 5 s,
  expired back to a single bolt, and re-collecting refreshed the timer without stacking
- Laser hits produced the orange burst: 41 of 68 live particles came from the
  impact palette, on hits that did not destroy the enemy
- Red damage flash started at 1.00 s and decayed smoothly
  (0.95 → 0.70 → 0.45 → 0.20 → 0) before clearing exactly on time
- Blue shield blocked a point-blank collision: lives stayed at 3, no red flash
  fired, and the enemy that touched the bubble was destroyed
- Sky drops produced 14 power-ups over 3 simulated minutes (8 multi-shot,
  6 shield), never exceeding the on-screen cap
- Heart icons: the SVG path parsed into a `Path2D` and rendered, showing
  filled hearts for remaining lives and hollow ones for spent lives
- Pause froze game time, the stars, the spawn timer, the particles **and** the
  multi-shot, shield, damage-flash and sky-drop timers; input behind the
  overlay did nothing
- Auto-pause on tab hide, clean resume on return
- Game Over fired at zero lives with the correct final score, best score and
  NEW RECORD badge; `Enter` and Restart both reset score, lives, weapon state
  and all entities
- Mute toggle drops master gain to 0 and restores it; all seven sound effects
  were triggered without throwing
- Resize tested at 1920×1080, 1280×720, 800×600, 640×900, 500×1000 and
  3440×1000 — extreme aspects letterbox correctly and the player and enemies
  always stay inside the world
- Seven consecutive menu → play → menu cycles left no duplicate loops or
  leftover entities
- 3-simulated-minute soak (10,800 frames): no errors, and only 6 enemy,
  15 bullet, 134 particle and 3 power-up objects were ever allocated — pools
  are reused, nothing grows without bound
- Re-run after the visual upgrade: 90-second soak plus the full state-machine
  pass (menu → play → pause → resume → game over → restart) with no errors and
  no console output; restart cleared shield, multi-shot and flash state
- Frame cost measured directly at worst case (22 enemies, 80 bullets, 520
  particles at the cap, power-up HUD chips, 1536×1152 backing store):
  **1.9 ms per frame**, about 11% of a 60 FPS budget on this machine.
  Re-measured after the visual upgrade with the red flash, the shield bubble
  and both chips all forced on at once: **3.0 ms per frame**, about 18% of the
  budget — still roughly 5× headroom

---

## Known limitations

- **Frame rate was not observed at a sustained 60 FPS.** The automated browser
  used for testing throttles `requestAnimationFrame` to roughly 30 Hz and
  suspends it entirely when it is not on screen, so a real 60 FPS run could not
  be watched end to end. What *was* measured is the per-frame cost above
  (1.9–3.0 ms at worst-case load), which leaves a large margin at 60 FPS on
  this hardware. Expect smooth play on a typical modern laptop; very old integrated
  graphics may do better with `particles.max` lowered in `js/config.js`.
- **Opening via `file://` was not verified.** The test browser rendered local
  files as a static snapshot rather than running them. Nothing in the game
  needs a server (no modules, no fetch, no external assets), so double-clicking
  should work; the mini web server above is the guaranteed path if it does not.
- Keyboard only — there are no touch or gamepad controls, so this is a
  laptop/desktop game.
- High scores are stored in your browser's local storage. Clearing site data,
  or using a different browser, resets them. If storage is blocked the game
  still runs, it just will not remember your best score.
- Enemies do not shoot back; the threat is collision and screen pressure.
- Tested in a Chromium-based browser only. Firefox and Safari use the same
  standard APIs and should work, but were not checked.
