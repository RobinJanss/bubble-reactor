// sdk.js — Poki SDK Wrapper
// Alle SDK-Calls laufen NUR über dieses Modul.
// Kein anderes Modul darf PokiSDK direkt aufrufen.

const SDK = (() => {
  // Interner State — verhindert Doppelfeuer
  const state = {
    playing: false,
    inAd: false,
    initialized: false,
  };

  // SDK initialisieren — wird von main.js aufgerufen
  async function init() {
    try {
      await PokiSDK.init();
      state.initialized = true;
      console.log('[SDK] Initialized');
    } catch (e) {
      // SDK-Init darf das Spiel nicht blockieren
      state.initialized = false;
      console.warn('[SDK] Init failed, continuing without SDK:', e);
    }
  }

  // Ladeende melden — einmal aufrufen wenn alle Assets geladen
  function loadingFinished() {
    try {
      PokiSDK.gameLoadingFinished();
      console.log('[SDK] gameLoadingFinished');
    } catch (e) {
      console.warn('[SDK] gameLoadingFinished failed:', e);
    }
  }

  // Gameplay startet — erst beim ersten echten Player-Input
  function gameplayStart() {
    if (state.inAd) return;      // Nie während einer Ad
    if (state.playing) return;   // Kein Start-Start hintereinander
    try {
      PokiSDK.gameplayStart();
      state.playing = true;
      console.log('[SDK] gameplayStart');
    } catch (e) {
      console.warn('[SDK] gameplayStart failed:', e);
    }
  }

  // Gameplay stoppt — bei JEDEM Unterbrechen (Pause, Menü, Result)
  function gameplayStop() {
    if (state.inAd) return;      // Nie während einer Ad
    if (!state.playing) return;  // Kein Stop-Stop hintereinander
    try {
      PokiSDK.gameplayStop();
      state.playing = false;
      console.log('[SDK] gameplayStop');
    } catch (e) {
      console.warn('[SDK] gameplayStop failed:', e);
    }
  }

  // Commercial Break — natürlicher Pause-Moment (RESULT → IDLE)
  async function commercialBreak(onResume) {
    gameplayStop();
    state.inAd = true;

    try {
      await PokiSDK.commercialBreak(() => {
        // Ad startet: Audio muten, Input sperren
        if (typeof Audio !== 'undefined' && Audio.mute) Audio.mute();
        if (typeof Input !== 'undefined' && Input.disable) Input.disable();
      });
    } catch (e) {
      console.warn('[SDK] commercialBreak failed:', e);
    }

    // Nach der Ad: alles wieder aktivieren
    state.inAd = false;
    if (typeof Audio !== 'undefined' && Audio.unmute) Audio.unmute();
    if (typeof Input !== 'undefined' && Input.enable) Input.enable();

    if (typeof onResume === 'function') onResume();
  }

  // Rewarded Break — NUR bei aktivem User-Tap auf Reward-Button
  async function rewardedBreak(onSuccess) {
    gameplayStop();
    state.inAd = true;

    let success = false;
    try {
      success = await PokiSDK.rewardedBreak({
        onStart: () => {
          if (typeof Audio !== 'undefined' && Audio.mute) Audio.mute();
          if (typeof Input !== 'undefined' && Input.disable) Input.disable();
        }
      });
    } catch (e) {
      console.warn('[SDK] rewardedBreak failed:', e);
    }

    state.inAd = false;
    if (typeof Audio !== 'undefined' && Audio.unmute) Audio.unmute();
    if (typeof Input !== 'undefined' && Input.enable) Input.enable();

    // Reward NUR bei echtem Erfolg vergeben
    if (success && typeof onSuccess === 'function') {
      onSuccess();
    }
    // Bei Adblock oder fehlgeschlagener Ad: kein Reward, keine Meldung
  }

  // Getter für anderen Code
  function isInAd() { return state.inAd; }
  function isPlaying() { return state.playing; }

  return {
    init,
    loadingFinished,
    gameplayStart,
    gameplayStop,
    commercialBreak,
    rewardedBreak,
    isInAd,
    isPlaying,
  };
})();