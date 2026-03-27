// sdk.js — Poki SDK Wrapper (mit lokalem Fallback für Entwicklung)

const SDK = (() => {

  const state = {
    playing: false,
    inAd: false,
    initialized: false,
  };

  // Prüfen ob PokiSDK überhaupt verfügbar ist (nicht lokal)
  function _hasPoki() {
    return typeof PokiSDK !== 'undefined';
  }

  async function init() {
    if (!_hasPoki()) {
      console.log('[SDK] PokiSDK not available (local dev mode) — skipping init');
      return;
    }
    try {
      await PokiSDK.init();
      state.initialized = true;
      console.log('[SDK] Initialized');
    } catch (e) {
      console.warn('[SDK] Init failed, continuing without SDK:', e);
    }
  }

  function loadingFinished() {
    console.log('[SDK] gameLoadingFinished');
    if (!_hasPoki()) return;
    try { PokiSDK.gameLoadingFinished(); } catch (e) {}
  }

  function gameplayStart() {
    if (state.inAd) return;
    if (state.playing) return;
    state.playing = true;
    console.log('[SDK] gameplayStart');
    if (!_hasPoki()) return;
    try { PokiSDK.gameplayStart(); } catch (e) {}
  }

  function gameplayStop() {
    if (state.inAd) return;
    if (!state.playing) return;
    state.playing = false;
    console.log('[SDK] gameplayStop');
    if (!_hasPoki()) return;
    try { PokiSDK.gameplayStop(); } catch (e) {}
  }

  async function commercialBreak(onResume) {
    gameplayStop();
    state.inAd = true;

    if (_hasPoki()) {
      try {
        await PokiSDK.commercialBreak(() => {
          if (typeof Audio !== 'undefined' && Audio.mute) Audio.mute();
          if (typeof Input !== 'undefined' && Input.disable) Input.disable();
        });
      } catch (e) {}
    } else {
      // Lokal: kurze Pause simulieren
      console.log('[SDK] commercialBreak (simulated)');
      await new Promise(r => setTimeout(r, 500));
    }

    state.inAd = false;
    if (typeof Audio !== 'undefined' && Audio.unmute) Audio.unmute();
    if (typeof Input !== 'undefined' && Input.enable) Input.enable();
    if (typeof onResume === 'function') onResume();
  }

  async function rewardedBreak(onSuccess) {
    gameplayStop();
    state.inAd = true;

    let success = false;
    if (_hasPoki()) {
      try {
        success = await PokiSDK.rewardedBreak({
          onStart: () => {
            if (typeof Audio !== 'undefined' && Audio.mute) Audio.mute();
            if (typeof Input !== 'undefined' && Input.disable) Input.disable();
          }
        });
      } catch (e) {}
    } else {
      // Lokal: immer erfolgreich simulieren
      console.log('[SDK] rewardedBreak (simulated) → success');
      await new Promise(r => setTimeout(r, 500));
      success = true;
    }

    state.inAd = false;
    if (typeof Audio !== 'undefined' && Audio.unmute) Audio.unmute();
    if (typeof Input !== 'undefined' && Input.enable) Input.enable();

    if (success && typeof onSuccess === 'function') onSuccess();
  }

  function isInAd()    { return state.inAd; }
  function isPlaying() { return state.playing; }

  return {
    init, loadingFinished,
    gameplayStart, gameplayStop,
    commercialBreak, rewardedBreak,
    isInAd, isPlaying,
  };
})();
