// renderer.js — Canvas Rendering aller Game States

const Renderer = (() => {

  function _drawBackground(ctx, canvas) {
    ctx.fillStyle = '#0D0F1A';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 1;
    const gridSize = Math.floor(canvas.width / 20);
    for (let x = 0; x < canvas.width; x += gridSize) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += gridSize) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }
  }

  function _drawBubble(ctx, bubble) {
    if (bubble.state === BubbleState.DEAD) return;

    ctx.save();

    let scale = 1;
    let opacity = 1;

    if (bubble.state === BubbleState.EXPLODING) {
      scale = 1 + bubble.explosionProgress * 0.8;
      opacity = 1 - bubble.explosionProgress;
    }

    ctx.globalAlpha = opacity;
    ctx.translate(bubble.x, bubble.y);
    ctx.scale(scale, scale);

    const r = bubble.radius;

    ctx.shadowColor = bubble.type.glowColor;
    ctx.shadowBlur = 20;

    const gradient = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
    gradient.addColorStop(0, lightenColor(bubble.type.color, 60));
    gradient.addColorStop(0.5, bubble.type.color);
    gradient.addColorStop(1, darkenColor(bubble.type.color, 40));

    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(-r * 0.28, -r * 0.28, r * 0.25, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fill();

    if (bubble.state === BubbleState.EXPLODING) {
      ctx.shadowColor = bubble.type.glowColor;
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.arc(0, 0, bubble.explosionRadius * bubble.explosionProgress, 0, Math.PI * 2);
      ctx.strokeStyle = bubble.type.color;
      ctx.lineWidth = 3 * (1 - bubble.explosionProgress);
      ctx.globalAlpha = (1 - bubble.explosionProgress) * 0.6;
      ctx.stroke();
    }

    ctx.restore();
  }

  // ── Launcher Bubble (folgt der Maus) ────────────────────────────────────
  function _drawLauncher(ctx, canvas, info) {
    const launcher = info.launcher;
    if (!launcher || !launcher.visible) return;
    if (info.tapsUsed >= info.tapsMax) return;

    const s = canvas.width / 836;
    const x = launcher.x;
    const y = launcher.y;
    const r = 22 * s;
    const explR = info.launcherRadius;

    ctx.save();

    // Explosions-Vorschau Ring
    const pulse = 0.4 + Math.sin(Date.now() / 300) * 0.15;
    ctx.globalAlpha = pulse;
    ctx.beginPath();
    ctx.arc(x, y, explR, 0, Math.PI * 2);
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.5 * s;
    ctx.setLineDash([6 * s, 4 * s]);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.globalAlpha = 1;

    // Glow
    ctx.shadowColor = '#FF4757';
    ctx.shadowBlur = 25;

    // Launcher Bubble
    const grad = ctx.createRadialGradient(
      x - r * 0.3, y - r * 0.3, r * 0.1,
      x, y, r
    );
    grad.addColorStop(0, '#FF8C8C');
    grad.addColorStop(0.5, '#FF4757');
    grad.addColorStop(1, '#AA1122');

    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // Highlight
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(x - r * 0.28, y - r * 0.28, r * 0.25, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fill();

    // Label
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = `bold ${Math.floor(10 * s)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('KLICK', x, y + r + 14 * s);

    ctx.restore();
  }

  // ── Missions Panel ──────────────────────────────────────────────────────
  function _drawMissionsPanel(ctx, canvas, info) {
    const s = canvas.width / 836;
    const missions = info.missions || [];
    if (missions.length === 0) return;

    const panelX = 12 * s;
    const panelY = canvas.height * 0.12;
    const panelW = 160 * s;
    const panelH = 100 * s;

    ctx.save();

    ctx.fillStyle = 'rgba(13,15,26,0.80)';
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 8 * s);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,198,255,0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = `bold ${Math.floor(10 * s)}px sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText('MISSIONEN', panelX + 8 * s, panelY + 14 * s);

    missions.forEach((m, i) => {
      const my = panelY + 28 * s + i * 24 * s;

      ctx.font = `${Math.floor(13 * s)}px sans-serif`;
      if (m.completed) {
        ctx.fillStyle = '#FFE600';
        ctx.shadowColor = '#FFE600';
        ctx.shadowBlur = 8;
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.shadowBlur = 0;
      }
      ctx.fillText('★', panelX + 8 * s, my + 10 * s);
      ctx.shadowBlur = 0;

      ctx.font = `${Math.floor(11 * s)}px sans-serif`;
      ctx.fillStyle = m.completed ? '#FFFFFF' : 'rgba(255,255,255,0.4)';
      ctx.fillText(m.label, panelX + 24 * s, my + 10 * s);
    });

    ctx.restore();
  }

  // ── IDLE Screen ─────────────────────────────────────────────────────────
  function _drawIdle(ctx, canvas, info) {
    const cx = canvas.width / 2;
    const s = canvas.width / 836;

    _drawMissionsPanel(ctx, canvas, info);

    ctx.save();
    ctx.fillStyle = '#00C6FF';
    ctx.font = `bold ${Math.floor(48 * s)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.shadowColor = '#00C6FF';
    ctx.shadowBlur = 30;
    ctx.fillText('BUBBLE REACTOR', cx, canvas.height * 0.52);

    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = `${Math.floor(18 * s)}px sans-serif`;
    ctx.fillText('Bewege die Maus — klicke zum Zünden', cx, canvas.height * 0.58);

    const pulse = 0.8 + Math.sin(Date.now() / 400) * 0.2;
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#39FF14';
    ctx.font = `bold ${Math.floor(16 * s)}px sans-serif`;
    ctx.fillText('▼  KLICK ZUM STARTEN  ▼', cx, canvas.height * 0.64);
    ctx.restore();
  }

  // ── HUD während Gameplay ────────────────────────────────────────────────
  function _drawHUD(ctx, canvas, info) {
    const s = canvas.width / 836;

    ctx.save();

    // Score oben rechts
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = `bold ${Math.floor(22 * s)}px sans-serif`;
    ctx.textAlign = 'right';
    ctx.fillText(`${info.totalScore.toLocaleString()} pts`, canvas.width - 16 * s, 34 * s);

    // Taps oben links
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = `bold ${Math.floor(11 * s)}px sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText('TAPS', 16 * s, 20 * s);

    for (let i = 0; i < info.tapsMax; i++) {
      const filled = i < (info.tapsMax - info.tapsUsed);
      const cx2 = (22 + i * 26) * s;
      const cy2 = 34 * s;
      const r = 9 * s;

      ctx.beginPath();
      ctx.arc(cx2, cy2, r, 0, Math.PI * 2);

      if (filled) {
        ctx.fillStyle = '#00C6FF';
        ctx.shadowColor = '#00C6FF';
        ctx.shadowBlur = 10;
        ctx.fill();
      } else {
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
    }

    // Chain Counter Mitte oben
    if (info.chainLength > 0) {
      ctx.textAlign = 'center';
      ctx.font = `bold ${Math.floor(30 * s)}px sans-serif`;
      ctx.fillStyle = '#FFE600';
      ctx.shadowColor = '#FFE600';
      ctx.shadowBlur = 20;
      ctx.fillText(`×${info.multiplier}  ${info.chainLength} CHAIN`, canvas.width / 2, 38 * s);
      ctx.shadowBlur = 0;
    }

    // Missions Panel
    _drawMissionsPanel(ctx, canvas, info);

    ctx.restore();
  }

  // ── Result Screen ───────────────────────────────────────────────────────
  function _drawResult(ctx, canvas, result, info) {
    if (!result) return;
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const s = canvas.width / 836;

    ctx.save();
    ctx.fillStyle = 'rgba(13,15,26,0.92)';
    ctx.beginPath();
    ctx.roundRect(cx - 220 * s, cy - 185 * s, 440 * s, 380 * s, 16 * s);
    ctx.fill();
    ctx.strokeStyle = '#00C6FF';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Board Nr
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = `${Math.floor(12 * s)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(`BOARD ${info.boardIndex + 1}`, cx, cy - 162 * s);

    // Score
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold ${Math.floor(38 * s)}px sans-serif`;
    ctx.shadowColor = '#00C6FF';
    ctx.shadowBlur = 15;
    ctx.fillText(`${info.totalScore.toLocaleString()} pts`, cx, cy - 120 * s);
    ctx.shadowBlur = 0;

    // Beste Chain
    const bestChain = Math.max(0, ...(info.tapsResults || []).map(r => r.chainLength));
    ctx.fillStyle = '#FFE600';
    ctx.font = `${Math.floor(15 * s)}px sans-serif`;
    ctx.fillText(`Beste Chain: ${bestChain}`, cx, cy - 88 * s);

    // Missions
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font = `bold ${Math.floor(11 * s)}px sans-serif`;
    ctx.fillText('MISSIONEN', cx, cy - 60 * s);

    const missions = info.missions || [];
    const starsEarned = missions.filter(m => m.completed).length;

    missions.forEach((m, i) => {
      const my = cy - 38 * s + i * 32 * s;

      ctx.font = `${Math.floor(18 * s)}px sans-serif`;
      if (m.completed) {
        ctx.fillStyle = '#FFE600';
        ctx.shadowColor = '#FFE600';
        ctx.shadowBlur = 10;
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.shadowBlur = 0;
      }
      ctx.fillText('★', cx - 100 * s, my + 6 * s);
      ctx.shadowBlur = 0;

      ctx.textAlign = 'left';
      ctx.font = `${Math.floor(14 * s)}px sans-serif`;
      ctx.fillStyle = m.completed ? '#FFFFFF' : 'rgba(255,255,255,0.35)';
      ctx.fillText(m.label, cx - 78 * s, my + 6 * s);
      ctx.textAlign = 'center';
    });

    // Sterne diese Runde
    ctx.font = `${Math.floor(22 * s)}px sans-serif`;
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = i < starsEarned ? '#FFE600' : 'rgba(255,255,255,0.15)';
      if (i < starsEarned) { ctx.shadowColor = '#FFE600'; ctx.shadowBlur = 12; }
      else ctx.shadowBlur = 0;
      ctx.fillText('★', cx + (i - 1) * 30 * s, cy + 72 * s);
    }
    ctx.shadowBlur = 0;

    // Gesamt-Sterne
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = `${Math.floor(12 * s)}px sans-serif`;
    ctx.fillText(`Gesamt ★ ${info.totalStars}`, cx, cy + 96 * s);

    // Rekord
    const hs = Storage.get(Storage.KEYS.HIGH_SCORE) || 0;
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.font = `${Math.floor(11 * s)}px sans-serif`;
    ctx.fillText(`Rekord: ${hs.toLocaleString()} pts`, cx, cy + 114 * s);

    // Weiter
    const pulse = 0.7 + Math.sin(Date.now() / 500) * 0.3;
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#00C6FF';
    ctx.font = `bold ${Math.floor(15 * s)}px sans-serif`;
    ctx.fillText('Tap für nächstes Board  →', cx, cy + 160 * s);

    ctx.restore();
  }

  // ── Haupt-Render ────────────────────────────────────────────────────────
  function draw(ctx, canvas, state, bubbles, lastResult, info) {
    _drawBackground(ctx, canvas);
    bubbles.forEach(b => _drawBubble(ctx, b));

    if (typeof Particles !== 'undefined') Particles.draw(ctx);

    switch (state) {
      case 'IDLE':
        _drawIdle(ctx, canvas, info);
        _drawLauncher(ctx, canvas, info);
        break;
      case 'PLAYING':
        _drawHUD(ctx, canvas, info);
        _drawLauncher(ctx, canvas, info);
        break;
      case 'EXPLODING':
        _drawHUD(ctx, canvas, info);
        break;
      case 'RESULT':
        _drawHUD(ctx, canvas, info);
        _drawResult(ctx, canvas, lastResult, info);
        break;
    }
  }

  // ── Color Helpers ────────────────────────────────────────────────────────
  function lightenColor(hex, amount) { return _shiftColor(hex, amount); }
  function darkenColor(hex, amount)  { return _shiftColor(hex, -amount); }

  function _shiftColor(hex, amount) {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.min(255, Math.max(0, (num >> 16) + amount));
    const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amount));
    const b = Math.min(255, Math.max(0, (num & 0xff) + amount));
    return `rgb(${r},${g},${b})`;
  }

  return { draw };
})();