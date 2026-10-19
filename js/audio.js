/* ==========================================================================
   AUDIO - procedural sound effects via the Web Audio API.
   No audio files, no network requests. One AudioContext for the whole
   session, created lazily on the first user gesture so browser autoplay
   policies are respected. Every call is a no-op when audio is unavailable.
   ========================================================================== */

class AudioManager {
  constructor() {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    this.supported = typeof Ctor === 'function';
    this.Ctor = Ctor;
    this.ctx = null;
    this.master = null;
    this.noiseBuffer = null;
    this.muted = false;
    this.voices = 0;          // rough concurrency guard
  }

  /** Safe to call as often as you like; only the first call does work. */
  unlock() {
    if (!this.supported) return;

    if (this.ctx === null) {
      try {
        this.ctx = new this.Ctor();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : CONFIG.audio.masterVolume;
        this.master.connect(this.ctx.destination);
        this.noiseBuffer = this._createNoiseBuffer(0.7);
      } catch (err) {
        this.supported = false;
        this.ctx = null;
        return;
      }
    }

    if (this.ctx.state === 'suspended') {
      const resumed = this.ctx.resume();
      if (resumed && typeof resumed.catch === 'function') resumed.catch(function () {});
    }
  }

  setMuted(muted) {
    this.muted = !!muted;
    if (this.master) {
      this.master.gain.value = this.muted ? 0 : CONFIG.audio.masterVolume;
    }
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  /* ---- internals ------------------------------------------------------- */

  _ready() {
    return this.supported && this.ctx !== null && !this.muted &&
           this.ctx.state === 'running' && this.voices < CONFIG.audio.maxVoices;
  }

  _createNoiseBuffer(seconds) {
    const rate = this.ctx.sampleRate;
    const length = Math.floor(rate * seconds);
    const buffer = this.ctx.createBuffer(1, length, rate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  /** Tracks a node so we can keep the voice count honest. */
  _track(node) {
    this.voices++;
    const self = this;
    node.onended = function () {
      self.voices = Math.max(0, self.voices - 1);
      try { node.disconnect(); } catch (err) { /* already gone */ }
    };
  }

  _tone(options) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = options.type || 'sine';
    osc.frequency.setValueAtTime(options.from, now);
    if (options.to !== undefined && options.to !== options.from) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, options.to), now + options.duration);
    }

    const peak = options.gain === undefined ? 0.3 : options.gain;
    const attack = options.attack === undefined ? 0.004 : options.attack;
    gain.gain.setValueAtTime(0.0001, now + (options.delay || 0));
    gain.gain.linearRampToValueAtTime(peak, now + (options.delay || 0) + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + (options.delay || 0) + options.duration);

    let tail = gain;
    if (options.filter) {
      const filter = ctx.createBiquadFilter();
      filter.type = options.filter;
      filter.frequency.value = options.filterFreq || 1200;
      gain.connect(filter);
      tail = filter;
    }
    tail.connect(this.master);
    osc.connect(gain);

    this._track(osc);
    osc.start(now + (options.delay || 0));
    osc.stop(now + (options.delay || 0) + options.duration + 0.02);
  }

  _noise(options) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.playbackRate.value = options.rate || 1;

    const filter = ctx.createBiquadFilter();
    filter.type = options.filter || 'lowpass';
    filter.frequency.setValueAtTime(options.freqFrom || 1800, now);
    filter.frequency.exponentialRampToValueAtTime(
      Math.max(40, options.freqTo || 180), now + options.duration);
    filter.Q.value = options.q || 1;

    const gain = ctx.createGain();
    const peak = options.gain === undefined ? 0.4 : options.gain;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(peak, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + options.duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);

    this._track(src);
    src.start(now);
    src.stop(now + options.duration + 0.02);
  }

  /* ---- the actual sound effects ---------------------------------------- */

  laser(isMultiShot) {
    if (!this._ready()) return;
    this._tone({
      type: 'square', from: isMultiShot ? 1180 : 940, to: 190,
      duration: 0.085, gain: 0.16, filter: 'lowpass', filterFreq: 2600
    });
    this._tone({
      type: 'sine', from: isMultiShot ? 2300 : 1800, to: 600,
      duration: 0.06, gain: 0.08
    });
  }

  hit() {
    if (!this._ready()) return;
    this._noise({ duration: 0.07, gain: 0.14, freqFrom: 3600, freqTo: 900, filter: 'bandpass', q: 1.2 });
  }

  explosion(size) {
    if (!this._ready()) return;
    const big = size === undefined ? 1 : size;
    this._noise({
      duration: 0.28 + 0.22 * big, gain: 0.34,
      freqFrom: 1500, freqTo: 90, rate: 1 / (0.85 + 0.3 * big)
    });
    this._tone({
      type: 'triangle', from: 170 * (1 / big), to: 42,
      duration: 0.3 + 0.2 * big, gain: 0.22
    });
  }

  /** isShield picks the warmer, lower confirmation chime. */
  pickup(isShield) {
    if (!this._ready()) return;
    if (isShield) {
      this._tone({ type: 'sine', from: 440, to: 660, duration: 0.14, gain: 0.2 });
      this._tone({ type: 'sine', from: 660, to: 880, duration: 0.2, gain: 0.17, delay: 0.1 });
      this._tone({ type: 'triangle', from: 220, to: 220, duration: 0.42, gain: 0.1, delay: 0.1,
        filter: 'lowpass', filterFreq: 900 });
    } else {
      this._tone({ type: 'triangle', from: 620, to: 930, duration: 0.09, gain: 0.2 });
      this._tone({ type: 'triangle', from: 930, to: 1420, duration: 0.11, gain: 0.18, delay: 0.08 });
      this._tone({ type: 'sine', from: 1860, to: 1860, duration: 0.14, gain: 0.08, delay: 0.16 });
    }
  }

  damage() {
    if (!this._ready()) return;
    this._tone({ type: 'sawtooth', from: 330, to: 58, duration: 0.42, gain: 0.3, filter: 'lowpass', filterFreq: 900 });
    this._noise({ duration: 0.3, gain: 0.22, freqFrom: 900, freqTo: 120 });
  }

  gameStart() {
    if (!this._ready()) return;
    const notes = [294, 392, 494, 587];
    for (let i = 0; i < notes.length; i++) {
      this._tone({ type: 'triangle', from: notes[i], to: notes[i], duration: 0.14, gain: 0.16, delay: i * 0.075 });
    }
  }

  gameOver() {
    if (!this._ready()) return;
    const notes = [392, 330, 262, 196];
    for (let i = 0; i < notes.length; i++) {
      this._tone({ type: 'triangle', from: notes[i], to: notes[i] * 0.985, duration: 0.42, gain: 0.2, delay: i * 0.17 });
    }
    this._noise({ duration: 0.8, gain: 0.18, freqFrom: 700, freqTo: 60 });
  }
}
