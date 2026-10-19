/* ==========================================================================
   CONFIG - every gameplay value worth tuning lives here.
   Change a number, reload the page, and the balance changes. No other file
   needs editing to re-tune the game.
   ========================================================================== */

const CONFIG = {

  /* ---- Logical world + viewport mapping ---------------------------------- */
  world: {
    designHeight: 720,   // the world is always this many logical units tall
    minAspect: 0.75,     // tall windows get letterboxed past this
    maxAspect: 2.0,      // ultra-wide windows get letterboxed past this
    maxDpr: 2            // cap retina scaling so weak GPUs stay smooth
  },

  /* ---- Main loop --------------------------------------------------------- */
  loop: {
    maxDelta: 0.05       // clamp dt (seconds) after tab switches / stalls
  },

  /* ---- Player ------------------------------------------------------------ */
  player: {
    radius: 18,
    speed: 430,              // logical units per second at full throttle
    accelSmoothing: 15,      // higher = snappier response
    fireInterval: 0.135,     // seconds between single shots
    multiShotFireInterval: 0.165,
    startLives: 3,
    invulnerableTime: 1.5,   // seconds of mercy after taking a hit
    damageFlashTime: 0.35,
    edgeMargin: 6,
    exhaustRate: 55,         // thruster particles per second
    collisionScale: 0.78     // hitbox is forgiving relative to the art
  },

  /* ---- Player projectiles ------------------------------------------------ */
  bullet: {
    speed: 840,
    radius: 5,
    damage: 1,
    max: 160,                // hard cap on live bullets
    spreadAngle: 0.21        // radians for the two outer triple-shot bolts
  },

  /* ---- Enemies ----------------------------------------------------------- */
  enemies: {
    max: 22,
    types: {
      scout: {
        label: 'Scout',
        radius: 13, hp: 1, speed: 190, score: 10,
        body: '#ff8098', edge: '#ffd3dc', glow: '#ff3a62',
        driftAmp: 50, driftFreq: 1.7
      },
      interceptor: {
        label: 'Interceptor',
        radius: 19, hp: 3, speed: 135, score: 25,
        body: '#b680ff', edge: '#e8d6ff', glow: '#8a3cff',
        driftAmp: 82, driftFreq: 1.0
      },
      heavy: {
        label: 'Heavy Fighter',
        radius: 28, hp: 7, speed: 92, score: 60,
        body: '#ffa94d', edge: '#ffe2b8', glow: '#ff6a12',
        driftAmp: 36, driftFreq: 0.6
      }
    }
  },

  /* ---- Spawning + difficulty ramp ---------------------------------------- */
  spawn: {
    baseInterval: 1.15,      // seconds between spawns at level 0
    intervalPerLevel: 0.07,
    minInterval: 0.36,
    firstSpawnDelay: 0.9,
    safeGapFromPlayer: 90    // never drop an enemy right on the player's head
  },

  difficulty: {
    scorePerLevel: 400,      // every N points raises the level by one
    maxLevel: 12,
    speedPerLevel: 0.055,
    maxSpeedMultiplier: 1.75,
    hpPerLevel: 0.115,
    maxHpMultiplier: 2.3
  },

  /* ---- Power-ups --------------------------------------------------------- */
  powerup: {
    dropChance: 0.15,        // 15% chance per destroyed enemy
    fallSpeed: 100,
    radius: 16,
    lifetime: 14,            // seconds before it expires on screen
    max: 6,

    multiShotDuration: 5,    // seconds of 3-laser fire per pickup
    shieldDuration: 6,       // seconds of blue shield per pickup

    // Power-ups also rain down from the sky on their own timer
    randomDropMin: 9,
    randomDropMax: 16,
    typeWeights: { multishot: 0.55, shield: 0.45 }
  },

  /* ---- Particles / explosions -------------------------------------------- */
  particles: {
    max: 520,
    explosionPalette: ['#fff3c4', '#ffd166', '#ff8a3c', '#ff5a3c'],
    energyPalette: ['#ffffff', '#9ef4ff', '#58e8ff', '#2b7cff'],
    // Orange sparks thrown off when a laser bites into an enemy hull
    impactPalette: ['#fff0c0', '#ffc24d', '#ff8a1f', '#ff6a12']
  },

  /* ---- Red damage flash -------------------------------------------------- */
  hitFlash: {
    duration: 1.0,           // seconds the screen stays red after a hit
    maxAlpha: 0.46
  },

  /* ---- Screen shake ------------------------------------------------------ */
  shake: {
    max: 16,
    decay: 7,                // exponential falloff per second
    playerHit: 13,
    heavyKill: 7,
    normalKill: 2.5,
    death: 16
  },

  /* ---- Starfield --------------------------------------------------------- */
  stars: {
    layers: [
      { density: 0.95, speed: 26,  minR: 0.6, maxR: 1.1, alpha: 0.42, twinkle: false },
      { density: 0.60, speed: 62,  minR: 0.9, maxR: 1.7, alpha: 0.68, twinkle: false },
      { density: 0.26, speed: 128, minR: 1.3, maxR: 2.4, alpha: 1.00, twinkle: true }
    ],
    nebulaSpeed: 9
  },

  /* ---- Audio ------------------------------------------------------------- */
  audio: {
    masterVolume: 0.35,
    maxVoices: 26
  }
};
