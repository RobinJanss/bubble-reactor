// renderer.js — Canvas Rendering aller Game States

const Renderer = (() => {

  // ── Screen-Shake + Flash ───────────────────────────────────────────────
  let _shakeIntensity = 0;
  let _shakeDuration  = 0;
  let _shakeMaxDur    = 1;
  let _flashAlpha     = 0;

  function triggerShake(intensity, frames) {
    if (intensity > _shakeIntensity) _shakeIntensity = intensity;
    if (frames > _shakeDuration) { _shakeDuration = frames; _shakeMaxDur = frames; }
  }

  function triggerFlash(alpha) {
    if (alpha > _flashAlpha) _flashAlpha = alpha;
  }

  function _applyShake(ctx) {
    if (_shakeDuration <= 0) return;
    const mag = _shakeIntensity * (_shakeDuration / _shakeMaxDur);
    ctx.translate((Math.random() * 2 - 1) * mag, (Math.random() * 2 - 1) * mag);
    _shakeDuration--;
    if (_shakeDuration <= 0) _shakeIntensity = 0;
  }

  function _drawFlash(ctx, canvas) {
    if (_flashAlpha < 0.005) { _flashAlpha = 0; return; }
    ctx.save();
    ctx.globalAlpha = _flashAlpha;
    ctx.fillStyle   = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    _flashAlpha *= 0.80;
  }

  // ── Button Hit-Testing ─────────────────────────────────────────────────
  let _buttons = {};

  function _registerButton(id, x, y, w, h) { _buttons[id] = { x, y, w, h }; }
  function _clearButtons() { _buttons = {}; }

  function getHitButton(canvasX, canvasY) {
    for (const [id, b] of Object.entries(_buttons)) {
      if (canvasX >= b.x && canvasX <= b.x + b.w &&
          canvasY >= b.y && canvasY <= b.y + b.h) return id;
    }
    return null;
  }

  // ── Generischer Button ─────────────────────────────────────────────────
  function _drawButton(ctx, s, cx, y, id, label, bgColor, glowColor, w = 200) {
    const bw = w * s;
    const bh = 36 * s;
    const bx = cx - bw / 2;
    ctx.save();
    ctx.fillStyle   = bgColor;
    ctx.shadowColor = glowColor;
    ctx.shadowBlur  = 14;
    ctx.beginPath();
    ctx.roundRect(bx, y, bw, bh, 8 * s);
    ctx.fill();
    ctx.shadowBlur  = 0;
    ctx.fillStyle   = '#FFFFFF';
    ctx.font        = `bold ${Math.floor(13 * s)}px sans-serif`;
    ctx.textAlign   = 'center';
    ctx.fillText(label, cx, y + bh * 0.66);
    ctx.restore();
    _registerButton(id, bx, y, bw, bh);
  }

  // ── Background ──────────────────────────────────────────────────────────
  function _drawBackground(ctx, canvas) {
    ctx.fillStyle = '#0D0F1A';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth   = 1;
    const gridSize  = Math.floor(canvas.width / 20);
    for (let x = 0; x < canvas.width; x += gridSize) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += gridSize) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }
  }

  // ── Bubble ──────────────────────────────────────────────────────────────
  function _drawBubble(ctx, bubble) {
    if (bubble.state === BubbleState.DEAD) return;
    ctx.save();
    let scale = 1, opacity = 1;
    if (bubble.state === BubbleState.EXPLODING) {
      scale   = 1 + bubble.explosionProgress * 0.8;
      opacity = 1 - bubble.explosionProgress;
    }
    ctx.globalAlpha = opacity;
    ctx.translate(bubble.x, bubble.y);
    ctx.scale(scale, scale);
    const r = bubble.radius;
    ctx.shadowColor = bubble.type.glowColor;
    ctx.shadowBlur  = 20;
    const gradient = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
    gradient.addColorStop(0, lightenColor(bubble.type.color, 60));
    gradient.addColorStop(0.5, bubble.type.color);
    gradient.addColorStop(1, darkenColor(bubble.type.color, 40));
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = gradient; ctx.fill();
    ctx.shadowBlur = 0;
    ctx.beginPath(); ctx.arc(-r * 0.28, -r * 0.28, r * 0.25, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fill();
    if (bubble.state === BubbleState.EXPLODING) {
      ctx.shadowColor = bubble.type.glowColor; ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.arc(0, 0, bubble.explosionRadius * bubble.explosionProgress, 0, Math.PI * 2);
      ctx.strokeStyle = bubble.type.color;
      ctx.lineWidth   = 3 * (1 - bubble.explosionProgress);
      ctx.globalAlpha = (1 - bubble.explosionProgress) * 0.6;
      ctx.stroke();
    }
    ctx.restore();
  }

  // ── Launcher ────────────────────────────────────────────────────────────
  function _drawLauncher(ctx, canvas, info) {
    const launcher = info.launcher;
    if (!launcher || !launcher.visible) return;
    if (info.tapsUsed >= info.tapsMax) return;
    const s = canvas.width / 836, x = launcher.x, y = launcher.y;
    const r = 22 * s, explR = info.launcherRadius;
    ctx.save();
    const pulse = 0.4 + Math.sin(Date.now() / 300) * 0.15;
    ctx.globalAlpha = pulse;
    ctx.beginPath(); ctx.arc(x, y, explR, 0, Math.PI * 2);
    ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 1.5 * s;
    ctx.setLineDash([6 * s, 4 * s]); ctx.stroke(); ctx.setLineDash([]);
    ctx.globalAlpha = 1; ctx.shadowColor = '#FF4757'; ctx.shadowBlur = 25;
    const grad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
    grad.addColorStop(0, '#FF8C8C'); grad.addColorStop(0.5, '#FF4757'); grad.addColorStop(1, '#AA1122');
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = grad; ctx.fill();
    ctx.shadowBlur = 0;
    ctx.beginPath(); ctx.arc(x - r * 0.28, y - r * 0.28, r * 0.25, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = `bold ${Math.floor(10 * s)}px sans-serif`;
    ctx.textAlign = 'center'; ctx.fillText('KLICK', x, y + r + 14 * s);
    ctx.restore();
  }

  // ── Missions Panel ──────────────────────────────────────────────────────
  function _drawMissionsPanel(ctx, canvas, info) {
    const s = canvas.width / 836, missions = info.missions || [];
    if (missions.length === 0) return;
    const panelX = 12 * s, panelY = canvas.height * 0.12;
    const panelW = 160 * s, panelH = 100 * s;
    ctx.save();
    ctx.fillStyle = 'rgba(13,15,26,0.80)';
    ctx.beginPath(); ctx.roundRect(panelX, panelY, panelW, panelH, 8 * s); ctx.fill();
    ctx.strokeStyle = 'rgba(0,198,255,0.3)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = `bold ${Math.floor(10 * s)}px sans-serif`;
    ctx.textAlign = 'left'; ctx.fillText('MISSIONEN', panelX + 8 * s, panelY + 14 * s);
    missions.forEach((m, i) => {
      const my = panelY + 28 * s + i * 24 * s;
      ctx.font = `${Math.floor(13 * s)}px sans-serif`;
      ctx.fillStyle = m.completed ? '#FFE600' : 'rgba(255,255,255,0.2)';
      if (m.completed) { ctx.shadowColor = '#FFE600'; ctx.shadowBlur = 8; }
      else ctx.shadowBlur = 0;
      ctx.fillText('★', panelX + 8 * s, my + 10 * s); ctx.shadowBlur = 0;
      ctx.font = `${Math.floor(11 * s)}px sans-serif`;
      ctx.fillStyle = m.completed ? '#FFFFFF' : 'rgba(255,255,255,0.4)';
      ctx.fillText(m.label, panelX + 24 * s, my + 10 * s);
    });
    ctx.restore();
  }

  // ── Level Badge (oben Mitte) ────────────────────────────────────────────
  function _drawLevelBadge(ctx, canvas, level) {
    const s  = canvas.width / 836;
    const cx = canvas.width / 2;
    ctx.save();
    // Pill-Hintergrund
    const label  = `LEVEL ${level}`;
    const fSize  = Math.floor(13 * s);
    ctx.font     = `bold ${fSize}px sans-serif`;
    const tw     = ctx.measureText(label).width;
    const pw     = tw + 20 * s;
    const ph     = 22 * s;
    const px     = cx - pw / 2;
    const py     = 6 * s;

    ctx.fillStyle = 'rgba(0,198,255,0.15)';
    ctx.strokeStyle = 'rgba(0,198,255,0.5)';
    ctx.lineWidth   = 1;
    ctx.beginPath(); ctx.roundRect(px, py, pw, ph, ph / 2); ctx.fill(); ctx.stroke();

    ctx.fillStyle   = '#00C6FF';
    ctx.shadowColor = '#00C6FF';
    ctx.shadowBlur  = 8;
    ctx.textAlign   = 'center';
    ctx.fillText(label, cx, py + ph * 0.72);
    ctx.restore();
  }

  // ── IDLE Screen ─────────────────────────────────────────────────────────
  function _drawIdle(ctx, canvas, info) {
    const cx = canvas.width / 2;
    const s  = canvas.width / 836;

    _drawMissionsPanel(ctx, canvas, info);
    _drawLevelBadge(ctx, canvas, info.level);

    ctx.save();
    ctx.fillStyle   = '#00C6FF'; ctx.font = `bold ${Math.floor(48 * s)}px sans-serif`;
    ctx.textAlign   = 'center'; ctx.shadowColor = '#00C6FF'; ctx.shadowBlur = 30;
    ctx.fillText('BUBBLE REACTOR', cx, canvas.height * 0.52);

    ctx.shadowBlur  = 0; ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font        = `${Math.floor(18 * s)}px sans-serif`;
    ctx.fillText('Bewege die Maus — klicke zum Zünden', cx, canvas.height * 0.58);

    // Sterne-Anzeige
    ctx.fillStyle = '#FFE600'; ctx.shadowColor = '#FFE600'; ctx.shadowBlur = 10;
    ctx.font      = `bold ${Math.floor(14 * s)}px sans-serif`;
    ctx.fillText(`★ ${info.totalStars}`, cx, canvas.height * 0.63);
    ctx.shadowBlur = 0;

    const pulse = 0.8 + Math.sin(Date.now() / 400) * 0.2;
    ctx.globalAlpha = pulse; ctx.fillStyle = '#39FF14';
    ctx.font        = `bold ${Math.floor(16 * s)}px sans-serif`;
    ctx.fillText('▼  KLICK ZUM STARTEN  ▼', cx, canvas.height * 0.69);
    ctx.restore();
  }

  // ── HUD ─────────────────────────────────────────────────────────────────
  function _drawHUD(ctx, canvas, info) {
    const s = canvas.width / 836;
    ctx.save();

    // Score oben rechts
    ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.font = `bold ${Math.floor(22 * s)}px sans-serif`;
    ctx.textAlign = 'right';
    ctx.fillText(`${info.totalScore.toLocaleString()} pts`, canvas.width - 16 * s, 34 * s);

    // Taps oben links
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = `bold ${Math.floor(11 * s)}px sans-serif`;
    ctx.textAlign = 'left'; ctx.fillText('TAPS', 16 * s, 20 * s);
    for (let i = 0; i < info.tapsMax; i++) {
      const filled = i < (info.tapsMax - info.tapsUsed);
      const cx2 = (22 + i * 26) * s, cy2 = 34 * s, r = 9 * s;
      ctx.beginPath(); ctx.arc(cx2, cy2, r, 0, Math.PI * 2);
      if (filled) { ctx.fillStyle = '#00C6FF'; ctx.shadowColor = '#00C6FF'; ctx.shadowBlur = 10; ctx.fill(); }
      else { ctx.shadowBlur = 0; ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1.5; ctx.stroke(); }
      ctx.shadowBlur = 0;
    }

    // Level Badge oben Mitte
    _drawLevelBadge(ctx, canvas, info.level);

    // Chain Counter
    if (info.chainLength > 0) {
      ctx.textAlign = 'center'; ctx.font = `bold ${Math.floor(30 * s)}px sans-serif`;
      ctx.fillStyle = '#FFE600'; ctx.shadowColor = '#FFE600'; ctx.shadowBlur = 20;
      ctx.fillText(`×${info.multiplier}  ${info.chainLength} CHAIN`, canvas.width / 2, 38 * s);
      ctx.shadowBlur = 0;
    }

    _drawMissionsPanel(ctx, canvas, info);
    ctx.restore();
  }

  // ── Result Screen ───────────────────────────────────────────────────────
  function _drawResult(ctx, canvas, result, info) {
    if (!result) return;
    const cx = canvas.width / 2, cy = canvas.height / 2, s = canvas.width / 836;
    _clearButtons();

    ctx.save();
    ctx.fillStyle = 'rgba(13,15,26,0.92)';
    ctx.beginPath(); ctx.roundRect(cx - 220 * s, cy - 185 * s, 440 * s, 420 * s, 16 * s); ctx.fill();
    ctx.strokeStyle = '#00C6FF'; ctx.lineWidth = 2; ctx.stroke();

    ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.font = `${Math.floor(12 * s)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(`BOARD ${info.boardIndex + 1}  ·  LEVEL ${info.level}`, cx, cy - 162 * s);

    ctx.fillStyle = '#FFFFFF'; ctx.font = `bold ${Math.floor(38 * s)}px sans-serif`;
    ctx.shadowColor = '#00C6FF'; ctx.shadowBlur = 15;
    ctx.fillText(`${info.totalScore.toLocaleString()} pts`, cx, cy - 120 * s); ctx.shadowBlur = 0;

    const bestChain = Math.max(0, ...(info.tapsResults || []).map(r => r.chainLength));
    ctx.fillStyle = '#FFE600'; ctx.font = `${Math.floor(15 * s)}px sans-serif`;
    ctx.fillText(`Beste Chain: ${bestChain}`, cx, cy - 88 * s);

    ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.font = `bold ${Math.floor(11 * s)}px sans-serif`;
    ctx.fillText('MISSIONEN', cx, cy - 60 * s);

    const missions = info.missions || [], starsEarned = missions.filter(m => m.completed).length;
    missions.forEach((m, i) => {
      const my = cy - 38 * s + i * 32 * s;
      ctx.font = `${Math.floor(18 * s)}px sans-serif`;
      if (m.completed) { ctx.fillStyle = '#FFE600'; ctx.shadowColor = '#FFE600'; ctx.shadowBlur = 10; }
      else { ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.shadowBlur = 0; }
      ctx.fillText('★', cx - 100 * s, my + 6 * s); ctx.shadowBlur = 0;
      ctx.textAlign = 'left'; ctx.font = `${Math.floor(14 * s)}px sans-serif`;
      ctx.fillStyle = m.completed ? '#FFFFFF' : 'rgba(255,255,255,0.35)';
      ctx.fillText(m.label, cx - 78 * s, my + 6 * s); ctx.textAlign = 'center';
    });

    // Sterne diese Runde
    ctx.font = `${Math.floor(22 * s)}px sans-serif`;
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = i < starsEarned ? '#FFE600' : 'rgba(255,255,255,0.15)';
      if (i < starsEarned) { ctx.shadowColor = '#FFE600'; ctx.shadowBlur = 12; } else ctx.shadowBlur = 0;
      ctx.fillText('★', cx + (i - 1) * 30 * s, cy + 68 * s);
    }
    ctx.shadowBlur = 0;

    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.font = `${Math.floor(12 * s)}px sans-serif`;
    ctx.fillText(`Gesamt ★ ${info.totalStars}`, cx, cy + 90 * s);
    const hs = Storage.get(Storage.KEYS.HIGH_SCORE) || 0;
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.font = `${Math.floor(11 * s)}px sans-serif`;
    ctx.fillText(`Rekord: ${hs.toLocaleString()} pts`, cx, cy + 106 * s);
    ctx.restore();

    // Buttons
    const btnGap = 44 * s;
    let btnY = cy + 118 * s;
    _drawButton(ctx, s, cx, btnY, 'next', '▶  Nächstes Board', '#16A34A', '#22C55E');
    btnY += btnGap;
    if (!info.retryUsed)
      _drawButton(ctx, s, cx, btnY, 'retry', '▶  Nochmal (Werbung)', '#B45309', '#F59E0B');
    btnY += btnGap;
    _drawButton(ctx, s, cx, btnY, 'shop', '🛒  Upgrade Shop', '#6D28D9', '#8B5CF6');
    btnY += btnGap;
    if (!info.dailyPlayedToday)
      _drawButton(ctx, s, cx, btnY, 'daily', '📅  Daily Board', '#4338CA', '#6366F1');
  }

  // ── Shop Screen ─────────────────────────────────────────────────────────
  function _drawShop(ctx, canvas, info) {
    const cx = canvas.width / 2, cy = canvas.height / 2, s = canvas.width / 836;
    const upgrades = info.upgradeStatus || [];
    _clearButtons();

    // Panel
    const panelW = 460 * s, panelH = 380 * s;
    const panelX = cx - panelW / 2, panelY = cy - panelH / 2;
    ctx.save();
    ctx.fillStyle = 'rgba(13,15,26,0.96)';
    ctx.beginPath(); ctx.roundRect(panelX, panelY, panelW, panelH, 16 * s); ctx.fill();
    ctx.strokeStyle = '#8B5CF6'; ctx.lineWidth = 2; ctx.stroke();

    // Titel
    ctx.fillStyle = '#8B5CF6'; ctx.font = `bold ${Math.floor(20 * s)}px sans-serif`;
    ctx.textAlign = 'center'; ctx.shadowColor = '#8B5CF6'; ctx.shadowBlur = 15;
    ctx.fillText('✦  UPGRADE SHOP  ✦', cx, panelY + 30 * s); ctx.shadowBlur = 0;

    // Sterne-Guthaben
    ctx.fillStyle = '#FFE600'; ctx.font = `bold ${Math.floor(14 * s)}px sans-serif`;
    ctx.shadowColor = '#FFE600'; ctx.shadowBlur = 8;
    ctx.fillText(`★ ${info.totalStars}  verfügbar`, cx, panelY + 52 * s); ctx.shadowBlur = 0;

    // Trennlinie
    ctx.strokeStyle = 'rgba(139,92,246,0.3)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(panelX + 16 * s, panelY + 62 * s);
    ctx.lineTo(panelX + panelW - 16 * s, panelY + 62 * s); ctx.stroke();

    // Upgrade-Einträge
    const rowH = 68 * s;
    upgrades.forEach((upg, i) => {
      const rowY = panelY + 70 * s + i * rowH;
      const rowX = panelX + 16 * s;
      const rowW = panelW - 32 * s;

      // Zeilen-Hintergrund
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.01)';
      ctx.beginPath(); ctx.roundRect(rowX, rowY, rowW, rowH - 4 * s, 6 * s); ctx.fill();

      // Icon + Label
      ctx.font = `${Math.floor(22 * s)}px sans-serif`;
      ctx.textAlign = 'left'; ctx.fillStyle = '#FFFFFF';
      ctx.fillText(upg.icon, rowX + 8 * s, rowY + 28 * s);

      ctx.font = `bold ${Math.floor(13 * s)}px sans-serif`;
      ctx.fillStyle = upg.maxed ? '#6EE7B7' : '#FFFFFF';
      ctx.fillText(upg.label, rowX + 36 * s, rowY + 22 * s);

      ctx.font = `${Math.floor(11 * s)}px sans-serif`;
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillText(upg.desc, rowX + 36 * s, rowY + 38 * s);

      // Level-Punkte (Stufen-Dots)
      for (let dot = 0; dot < upg.maxLevel; dot++) {
        const dotX = rowX + 36 * s + dot * 14 * s;
        const dotY = rowY + 52 * s;
        ctx.beginPath(); ctx.arc(dotX, dotY, 4 * s, 0, Math.PI * 2);
        ctx.fillStyle = dot < upg.level ? '#8B5CF6' : 'rgba(255,255,255,0.15)';
        ctx.fill();
      }

      // Kauf-Button rechts
      const btnW = 80 * s, btnH = 28 * s;
      const btnX = rowX + rowW - btnW - 4 * s;
      const btnY = rowY + (rowH - 4 * s) / 2 - btnH / 2;

      if (upg.maxed) {
        ctx.fillStyle = 'rgba(110,231,183,0.15)';
        ctx.beginPath(); ctx.roundRect(btnX, btnY, btnW, btnH, 6 * s); ctx.fill();
        ctx.fillStyle = '#6EE7B7'; ctx.font = `bold ${Math.floor(11 * s)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('MAX ✓', btnX + btnW / 2, btnY + btnH * 0.68);
      } else {
        const canBuy = upg.canBuy;
        ctx.fillStyle = canBuy ? '#7C3AED' : 'rgba(255,255,255,0.08)';
        ctx.shadowColor = canBuy ? '#8B5CF6' : 'transparent';
        ctx.shadowBlur  = canBuy ? 10 : 0;
        ctx.beginPath(); ctx.roundRect(btnX, btnY, btnW, btnH, 6 * s); ctx.fill();
        ctx.shadowBlur  = 0;
        ctx.fillStyle   = canBuy ? '#FFFFFF' : 'rgba(255,255,255,0.3)';
        ctx.font        = `bold ${Math.floor(11 * s)}px sans-serif`;
        ctx.textAlign   = 'center';
        ctx.fillText(`★ ${upg.cost}`, btnX + btnW / 2, btnY + btnH * 0.68);

        if (canBuy) _registerButton('buy_' + upg.id, btnX, btnY, btnW, btnH);
      }
    });

    ctx.restore();

    // Zurück-Button
    _drawButton(ctx, s, cx, panelY + panelH + 12 * s, 'shop_back',
      '← Weiter spielen', '#374151', '#6B7280', 180);
  }

  // ── Haupt-Render ────────────────────────────────────────────────────────
  function draw(ctx, canvas, state, bubbles, lastResult, info) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    _applyShake(ctx);
    _drawBackground(ctx, canvas);

    if (state !== 'SHOP') {
      bubbles.forEach(b => _drawBubble(ctx, b));
      if (typeof Particles !== 'undefined') Particles.draw(ctx);
    }

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
      case 'SHOP':
        _drawShop(ctx, canvas, info);
        break;
    }

    ctx.restore();
    _drawFlash(ctx, canvas);
  }

  // ── Color Helpers ────────────────────────────────────────────────────────
  function lightenColor(hex, amount) { return _shiftColor(hex, amount); }
  function darkenColor(hex, amount)  { return _shiftColor(hex, -amount); }
  function _shiftColor(hex, amount) {
    const num = parseInt(hex.replace('#', ''), 16);
    const r   = Math.min(255, Math.max(0, (num >> 16) + amount));
    const g   = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amount));
    const b   = Math.min(255, Math.max(0, (num & 0xff) + amount));
    return `rgb(${r},${g},${b})`;
  }

  return { draw, triggerShake, triggerFlash, getHitButton };
})();