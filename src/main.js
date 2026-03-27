// main.js — Einstiegspunkt

window.addEventListener('load', async () => {
  const canvas = document.getElementById('game-canvas');

  // Game initialisieren (Canvas-Setup, Input, Loop)
  Game.init(canvas);

  // Kurz warten bis PokiSDK sicher geladen ist
  await new Promise(r => setTimeout(r, 100));

  // Poki SDK initialisieren
  await SDK.init();

  // Ladeende melden
  SDK.loadingFinished();

  // Spiel starten
  Game.start();
});