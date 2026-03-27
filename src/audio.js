// audio.js — Procedural Web Audio (kein externes Asset)

const Audio = (() => {
  let _ctx = null;
  let _muted = false;

  // AudioContext lazy initialisieren (braucht User-Interaktion)
  function _getCtx() {
    if (!_ctx) {
      try {
        _ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        return null;
      }
    }
    // Bei manchen Browsern suspended nach Inaktivität
    if (_ctx.state === 'suspended') _ctx.resume();
    return _ctx;
  }

  // Pop-Sound — Pitch steigt mit Chain-Länge
  function playPop(chainIndex = 1) {
    if (_muted) return;
    const ctx = _getCtx();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      // Frequenz steigt mit der Chain
      const baseFreq = 220;
      const freq = baseFreq * Math.pow(1.08, Math.min(chainIndex, 24));
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.5, ctx.currentTime + 0.08);

      osc.type = 'sine';
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.15);
    } catch (e) {}
  }

  // Mega-Boom Sound bei großen Explosionen
  function playBoom() {
    if (_muted) return;
    const ctx = _getCtx();
    if (!ctx) return;

    try {
      const bufferSize = ctx.sampleRate * 0.3;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
      }

      const source = ctx.createBufferSource();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      source.buffer = buffer;
      filter.type = 'lowpass';
      filter.frequency.value = 200;

      source.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      gain.gain.setValueAtTime(0.5, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);

      source.start(ctx.currentTime);
    } catch (e) {}
  }

  function mute()   { _muted = true; }
  function unmute() { _muted = false; }
  function isMuted() { return _muted; }

  return { playPop, playBoom, mute, unmute, isMuted };
})();