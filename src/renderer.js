// renderer.js — Canvas Rendering aller Game States
//
// Abhängigkeit: ui.js muss VOR dieser Datei geladen sein.
// Button-Registry und Result-Button-Definitionen liegen in ui.js.

const Renderer = (() => {

  // ── Prestige Themes ────────────────────────────────────────────────────
  const THEMES = {
    default:     { bg: '#0D0F1A', grid: 'rgba(255,255,255,0.03)', accent: '#00C6FF', launcher: '#FF4757', particle: null,      bubbleOverlay: null },
    gold:        { bg: '#120E00', grid: 'rgba(245,158,11,0.05)',  accent: '#F59E0B', launcher: '#F59E0B', particle: '#FFD700', bubbleOverlay: 'rgba(255,200,0,0.12)' },
    deep_sea:    { bg: '#020C12', grid: 'rgba(6,182,212,0.05)',   accent: '#06B6D4', launcher: '#06B6D4', particle: '#22D3EE', bubbleOverlay: 'rgba(6,182,212,0.08)' },
    plasma:      { bg: '#0A0015', grid: 'rgba(232,121,249,0.05)', accent: '#E879F9', launcher: '#D946EF', particle: '#E879F9', bubbleOverlay: 'rgba(232,121,249,0.1)' },
    void:        { bg: '#030008', grid: 'rgba(109,40,217,0.06)',  accent: '#8B5CF6', launcher: '#8B5CF6', particle: '#6D28D9', bubbleOverlay: 'rgba(109,40,217,0.15)' },
    reactor_god: { bg: '#000005', grid: 'rgba(255,255,255,0.05)', accent: '#FFFFFF', launcher: '#FFFFFF', particle: 'rainbow',  bubbleOverlay: 'rainbow' },
  };

  function _getTheme(name) { return THEMES[name] || THEMES.default; }

  // ── Shake + Flash ──────────────────────────────────────────────────────
  let _shakeIntensity=0,_shakeDuration=0,_shakeMaxDur=1,_flashAlpha=0;
  function triggerShake(i,f){if(i>_shakeIntensity)_shakeIntensity=i;if(f>_shakeDuration){_shakeDuration=f;_shakeMaxDur=f;}}
  function triggerFlash(a){if(a>_flashAlpha)_flashAlpha=a;}
  function _applyShake(ctx){if(_shakeDuration<=0)return;const mag=_shakeIntensity*(_shakeDuration/_shakeMaxDur);ctx.translate((Math.random()*2-1)*mag,(Math.random()*2-1)*mag);if(--_shakeDuration<=0)_shakeIntensity=0;}
  function _drawFlash(ctx,canvas){if(_flashAlpha<0.005){_flashAlpha=0;return;}ctx.save();ctx.globalAlpha=_flashAlpha;ctx.fillStyle='#FFFFFF';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.restore();_flashAlpha*=.80;}

  // ── Trail ──────────────────────────────────────────────────────────────
  const TRAIL_MAX=24;let _trailPoints=[];
  function _updateTrail(launcher,enabled){if(!enabled||!launcher?.visible){_trailPoints=[];return;}_trailPoints.push({x:launcher.x,y:launcher.y,t:1.0});if(_trailPoints.length>TRAIL_MAX)_trailPoints.shift();_trailPoints.forEach(p=>{p.t=Math.max(0,p.t-.04);});_trailPoints=_trailPoints.filter(p=>p.t>0);}
  function _drawTrail(ctx,color){if(_trailPoints.length<2)return;ctx.save();for(let i=1;i<_trailPoints.length;i++){const a=_trailPoints[i-1],b=_trailPoints[i];ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.strokeStyle=`rgba(${color||'255,71,87'},${b.t*.5})`;ctx.lineWidth=b.t*4;ctx.shadowColor=`rgba(${color||'255,71,87'},0.8)`;ctx.shadowBlur=8;ctx.stroke();}ctx.restore();}

  // ── Buttons ─────────────────────────────────────────────────────────────
  // Registry liegt in ui.js (UI.register / UI.clear / UI.getHit).
  // _drawButton zeichnet den Button und registriert ihn in der UI-Registry.
  function _drawButton(ctx,s,cx,y,id,label,bg,glow,w=200){
    const bw=w*s,bh=36*s,bx=cx-bw/2;
    ctx.save();
    ctx.fillStyle=bg;ctx.shadowColor=glow;ctx.shadowBlur=14;
    ctx.beginPath();ctx.roundRect(bx,y,bw,bh,8*s);ctx.fill();
    ctx.shadowBlur=0;ctx.fillStyle='#FFF';
    ctx.font=`bold ${Math.floor(13*s)}px sans-serif`;ctx.textAlign='center';
    ctx.fillText(label,cx,y+bh*.66);
    ctx.restore();
    UI.register(id,bx,y,bw,bh);
  }

  // ── Background ──────────────────────────────────────────────────────────
  function _drawBackground(ctx,canvas,theme){
    const t=_getTheme(theme);
    if(theme==='reactor_god'){
      const hue=(Date.now()/50)%360;
      ctx.fillStyle=`hsl(${hue},60%,3%)`; ctx.fillRect(0,0,canvas.width,canvas.height);
    } else {
      ctx.fillStyle=t.bg; ctx.fillRect(0,0,canvas.width,canvas.height);
    }
    ctx.strokeStyle=t.grid; ctx.lineWidth=1;
    const gs=Math.floor(canvas.width/20);
    for(let x=0;x<canvas.width;x+=gs){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,canvas.height);ctx.stroke();}
    for(let y=0;y<canvas.height;y+=gs){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(canvas.width,y);ctx.stroke();}
  }

  // ── Bubble ──────────────────────────────────────────────────────────────
  function _drawStandardBubble(ctx,r,bubble,theme){
    const t=_getTheme(theme);
    ctx.shadowColor=bubble.type.glowColor; ctx.shadowBlur=20;
    const g=ctx.createRadialGradient(-r*.3,-r*.3,r*.1,0,0,r);
    g.addColorStop(0,lightenColor(bubble.type.color,60));
    g.addColorStop(.5,bubble.type.color);
    g.addColorStop(1,darkenColor(bubble.type.color,40));
    ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2); ctx.fillStyle=g; ctx.fill();
    ctx.shadowBlur=0;
    ctx.beginPath(); ctx.arc(-r*.28,-r*.28,r*.25,0,Math.PI*2); ctx.fillStyle='rgba(255,255,255,0.35)'; ctx.fill();
    if(t.bubbleOverlay&&t.bubbleOverlay!=='rainbow'){
      ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2); ctx.fillStyle=t.bubbleOverlay; ctx.fill();
    } else if(t.bubbleOverlay==='rainbow'){
      const hue=(Date.now()/20+bubble.x)%360;
      ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2); ctx.fillStyle=`hsla(${hue},80%,60%,0.2)`; ctx.fill();
    }
  }

  function _drawShieldBubble(ctx,r,bubble){
    const dmg=bubble.hitCount>=1;
    ctx.shadowColor='#7C3AED'; ctx.shadowBlur=dmg?30:15;
    const g=ctx.createRadialGradient(-r*.3,-r*.3,r*.1,0,0,r);
    g.addColorStop(0,dmg?'#C4B5FD':'#DDD6FE'); g.addColorStop(.5,dmg?'#8B5CF6':'#A78BFA'); g.addColorStop(1,dmg?'#4C1D95':'#6D28D9');
    ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2); ctx.fillStyle=g; ctx.fill(); ctx.shadowBlur=0;
    ctx.beginPath();ctx.moveTo(0,-r*.45);ctx.lineTo(r*.35,-r*.2);ctx.lineTo(r*.35,r*.1);ctx.lineTo(0,r*.45);ctx.lineTo(-r*.35,r*.1);ctx.lineTo(-r*.35,-r*.2);ctx.closePath();
    ctx.strokeStyle=dmg?'rgba(196,181,253,0.5)':'rgba(255,255,255,0.7)'; ctx.lineWidth=dmg?1:2; ctx.stroke();
    ctx.fillStyle=dmg?'rgba(250,204,21,0.9)':'rgba(255,255,255,0.8)';
    ctx.font=`bold ${Math.floor(r*.4)}px sans-serif`; ctx.textAlign='center'; ctx.fillText(dmg?'!':'2',0,r*.15);
    if(bubble.showHit){ctx.globalAlpha*=.4;ctx.fillStyle='#FFF';ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();}
  }

  function _drawGlassBubble(ctx,r,bubble){
    ctx.shadowColor='#7DD3FC'; ctx.shadowBlur=10; ctx.globalAlpha*=.55;
    const g=ctx.createRadialGradient(-r*.3,-r*.3,r*.05,0,0,r);
    g.addColorStop(0,'rgba(224,242,254,0.9)');g.addColorStop(.5,'rgba(186,230,253,0.5)');g.addColorStop(1,'rgba(125,211,252,0.3)');
    ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fillStyle=g;ctx.fill();ctx.shadowBlur=0;
    ctx.setLineDash([3,3]);ctx.strokeStyle='rgba(186,230,253,0.8)';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
    ctx.strokeStyle='rgba(255,255,255,0.6)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-r*.15,-r*.2);ctx.lineTo(0,0);ctx.lineTo(r*.1,r*.25);ctx.stroke();
  }

  function _drawPhantomBubble(ctx,r,bubble){
    const pulse=.5+Math.sin(Date.now()/400)*.25;
    ctx.shadowColor='#6EE7B7';ctx.shadowBlur=25*pulse;ctx.globalAlpha*=pulse;
    const g=ctx.createRadialGradient(0,0,0,0,0,r);g.addColorStop(0,'rgba(209,250,229,0.7)');g.addColorStop(1,'rgba(110,231,183,0.1)');
    ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fillStyle=g;ctx.fill();ctx.shadowBlur=0;
    ctx.setLineDash([4,4]);ctx.strokeStyle=`rgba(110,231,183,${pulse})`;ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
    ctx.globalAlpha=1;ctx.fillStyle=`rgba(110,231,183,${pulse*.9})`;ctx.font=`bold ${Math.floor(r*.55)}px sans-serif`;ctx.textAlign='center';ctx.fillText('?',0,r*.2);
  }

  function _drawLockedBubble(ctx,r,bubble){
    const ul=!bubble.locked;
    ctx.shadowColor=ul?'#A78BFA':'#57534E';ctx.shadowBlur=ul?20:8;
    const col=ul?'#A78BFA':'#78716C';
    const g=ctx.createRadialGradient(-r*.3,-r*.3,r*.1,0,0,r);g.addColorStop(0,lightenColor(col,30));g.addColorStop(1,darkenColor(col,30));
    ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fillStyle=g;ctx.fill();ctx.shadowBlur=0;
    ctx.font=`${Math.floor(r*.6)}px sans-serif`;ctx.textAlign='center';
    ctx.fillStyle=ul?'rgba(167,139,250,0.9)':'rgba(255,255,255,0.6)';ctx.fillText(ul?'✓':'🔒',0,r*.22);
    if(bubble.showHit){ctx.globalAlpha*=.5;ctx.fillStyle='#A78BFA';ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();}
  }

  function _drawVoidBubble(ctx,r,bubble){
    const pulse=.7+Math.sin(Date.now()/300)*.3;
    ctx.shadowColor='#7C3AED';ctx.shadowBlur=35*pulse;
    const g=ctx.createRadialGradient(0,0,0,0,0,r);
    g.addColorStop(0,`rgba(49,10,110,${pulse})`);g.addColorStop(.5,'rgba(15,3,40,0.95)');g.addColorStop(1,'rgba(0,0,0,1)');
    ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fillStyle=g;ctx.fill();ctx.shadowBlur=0;
    for(let i=0;i<3;i++){
      const angle=Date.now()/500+i*(Math.PI*2/3);
      ctx.beginPath();ctx.arc(Math.cos(angle)*r*.35,Math.sin(angle)*r*.35,r*.18,0,Math.PI*2);
      ctx.fillStyle=`rgba(139,92,246,${.4*pulse})`;ctx.fill();
    }
    ctx.fillStyle=`rgba(167,139,250,${pulse})`;ctx.font=`bold ${Math.floor(r*.3)}px sans-serif`;ctx.textAlign='center';ctx.fillText('VOID',0,-r*.05);
    ctx.font=`${Math.floor(r*.22)}px sans-serif`;ctx.fillStyle=`rgba(200,180,255,${pulse*.7})`;ctx.fillText('500 pts',0,r*.25);
  }

  function _drawBubble(ctx,bubble,theme){
    if(bubble.state===BubbleState.DEAD) return;
    ctx.save();
    let scale=1,opacity=1;
    if(bubble.state===BubbleState.EXPLODING){scale=1+bubble.explosionProgress*.8;opacity=1-bubble.explosionProgress;}
    ctx.globalAlpha=opacity;ctx.translate(bubble.x,bubble.y);ctx.scale(scale,scale);
    const r=bubble.radius,n=bubble.type.name;
    if     (n==='SHIELD')  _drawShieldBubble(ctx,r,bubble);
    else if(n==='GLASS')   _drawGlassBubble(ctx,r,bubble);
    else if(n==='PHANTOM') _drawPhantomBubble(ctx,r,bubble);
    else if(n==='LOCKED')  _drawLockedBubble(ctx,r,bubble);
    else if(n==='VOID')    _drawVoidBubble(ctx,r,bubble);
    else                   _drawStandardBubble(ctx,r,bubble,theme);
    if(bubble.state===BubbleState.EXPLODING){
      ctx.shadowColor=bubble.type.glowColor;ctx.shadowBlur=15;
      ctx.beginPath();ctx.arc(0,0,bubble.explosionRadius*bubble.explosionProgress,0,Math.PI*2);
      ctx.strokeStyle=bubble.type.color;ctx.lineWidth=3*(1-bubble.explosionProgress);
      ctx.globalAlpha=(1-bubble.explosionProgress)*.6;ctx.stroke();
    }
    ctx.restore();
  }

  // ── Launcher (Standard + Krone P6) ─────────────────────────────────────
  function _drawLauncher(ctx,canvas,info){
    if(!info.launcher?.visible) return;
    if(info.tapsUsed>=info.tapsMax) return;
    const s=canvas.width/836,x=info.launcher.x,y=info.launcher.y;
    const r=22*s,explR=info.launcherRadius,od=!!info.overdrivePending;
    const t=_getTheme(info.activeTheme);
    const hasCrown=info.activeUnlocks?.includes('crown_launcher');
    ctx.save();
    _drawTrail(ctx,t.launcher==='#FF4757'?'255,71,87':t.launcher.replace('#','').match(/.{2}/g).map(x=>parseInt(x,16)).join(','));
    const pulse=.4+Math.sin(Date.now()/300)*.15;
    ctx.globalAlpha=od?.9:pulse;
    ctx.beginPath();ctx.arc(x,y,explR,0,Math.PI*2);
    ctx.strokeStyle=od?'#FFE600':t.accent;ctx.lineWidth=(od?2.5:1.5)*s;
    ctx.setLineDash([6*s,4*s]);ctx.stroke();ctx.setLineDash([]);
    ctx.globalAlpha=1;ctx.shadowColor=od?'#FFE600':t.launcher;ctx.shadowBlur=od?35:25;
    const col=od?['#FFDD57','#F59E0B','#B45309']:[lightenColor(t.launcher,40),t.launcher,darkenColor(t.launcher,40)];
    const g=ctx.createRadialGradient(x-r*.3,y-r*.3,r*.1,x,y,r);
    g.addColorStop(0,col[0]);g.addColorStop(.5,col[1]);g.addColorStop(1,col[2]);
    ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fillStyle=g;ctx.fill();ctx.shadowBlur=0;
    ctx.beginPath();ctx.arc(x-r*.28,y-r*.28,r*.25,0,Math.PI*2);ctx.fillStyle='rgba(255,255,255,0.4)';ctx.fill();
    if(hasCrown){
      ctx.fillStyle='#FFD700';ctx.strokeStyle='#B8860B';ctx.lineWidth=1;
      const cw=r*.9,ch=r*.55,cx2=x-cw/2,cy2=y-r-ch;
      ctx.beginPath();ctx.moveTo(cx2,cy2+ch);ctx.lineTo(cx2,cy2+ch*.3);ctx.lineTo(cx2+cw*.25,cy2+ch*.6);ctx.lineTo(cx2+cw*.5,cy2);ctx.lineTo(cx2+cw*.75,cy2+ch*.6);ctx.lineTo(cx2+cw,cy2+ch*.3);ctx.lineTo(cx2+cw,cy2+ch);ctx.closePath();
      ctx.fill();ctx.stroke();
    }
    ctx.fillStyle=od?'#FFE600':'rgba(255,255,255,0.7)';
    ctx.font=`bold ${Math.floor(10*s)}px sans-serif`;ctx.textAlign='center';
    ctx.fillText(od?'⚡':'KLICK',x,y+r+14*s);
    ctx.restore();
  }

  // ── Zeitlupe Button (P7) ────────────────────────────────────────────────
  function _drawSlowMotionButton(ctx,canvas,info){
    if(!info.slowMotionAvailable||info.slowMotionUsed) return;
    if(info.state!=='PLAYING'&&info.state!=='EXPLODING') return;
    const s=canvas.width/836;
    const bw=52*s,bh=52*s,bx=canvas.width-68*s,by=canvas.height-68*s;
    ctx.save();
    const active=info.slowMotionActive;
    ctx.fillStyle=active?'rgba(99,102,241,0.9)':'rgba(99,102,241,0.5)';
    ctx.shadowColor='#6366F1';ctx.shadowBlur=active?20:8;
    ctx.beginPath();ctx.roundRect(bx,by,bw,bh,10*s);ctx.fill();ctx.shadowBlur=0;
    ctx.strokeStyle='rgba(165,180,252,0.8)';ctx.lineWidth=1.5;ctx.stroke();
    ctx.fillStyle='#FFF';ctx.font=`${Math.floor(22*s)}px sans-serif`;ctx.textAlign='center';
    ctx.fillText('⏳',bx+bw/2,by+bh*.68);
    ctx.font=`bold ${Math.floor(8*s)}px sans-serif`;
    ctx.fillText(active?'AKTIV':'ZL',bx+bw/2,by+bh*.92);
    ctx.restore();
    UI.register('slow_motion',bx,by,bw,bh);
  }

  // ── Hardcore Badge ──────────────────────────────────────────────────────
  function _drawHardcoreBadge(ctx,canvas){
    const s=canvas.width/836;
    ctx.save();
    ctx.strokeStyle='rgba(239,68,68,0.6)';ctx.lineWidth=3*s;
    ctx.strokeRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle='rgba(239,68,68,0.85)';ctx.font=`bold ${Math.floor(11*s)}px sans-serif`;
    ctx.textAlign='left';ctx.fillText('💎 HARDCORE  ×5',8*s,canvas.height-8*s);
    ctx.restore();
  }

  // ── Missions Panel ──────────────────────────────────────────────────────
  function _drawMissionsPanel(ctx,canvas,info){
    const s=canvas.width/836,ms=info.missions||[];if(!ms.length)return;
    const px=12*s,py=44*s,lh=22*s;
    ctx.save();ctx.font=`bold ${Math.floor(9*s)}px sans-serif`;ctx.textAlign='left';ctx.fillStyle='rgba(255,255,255,0.3)';ctx.fillText('MISSIONEN',px,py);
    ms.forEach((m,i)=>{const my=py+12*s+i*lh;const done=m.completed;ctx.fillStyle=done?'#FFE600':'rgba(255,255,255,0.15)';ctx.shadowColor=done?'#FFE600':'transparent';ctx.shadowBlur=done?8:0;ctx.fillText('★',px,my);ctx.shadowBlur=0;ctx.fillStyle=done?'rgba(255,255,255,0.9)':'rgba(255,255,255,0.35)';ctx.fillText(m.label,px+14*s,my);});
    ctx.restore();
  }

  // ── Level + Prestige Badge ───────────────────────────────────────────────
  function _drawLevelBadge(ctx,canvas,level,prestigeLevel,theme){
    const s=canvas.width/836,cx=canvas.width/2,p=prestigeLevel>0,t=_getTheme(theme);
    const label=p?`✦ LVL ${level}  P${prestigeLevel}`:`LEVEL ${level}`;
    ctx.save();ctx.font=`bold ${Math.floor(13*s)}px sans-serif`;
    const tw=ctx.measureText(label).width,pw=tw+20*s,ph=22*s,bx=cx-pw/2,by=6*s;
    const bg=p?'rgba(245,158,11,0.2)':`${t.accent}22`;
    const border=p?'rgba(245,158,11,0.7)':`${t.accent}99`;
    ctx.fillStyle=bg;ctx.strokeStyle=border;ctx.lineWidth=1;ctx.beginPath();ctx.roundRect(bx,by,pw,ph,ph/2);ctx.fill();ctx.stroke();
    ctx.fillStyle=p?'#F59E0B':t.accent;ctx.shadowColor=p?'#F59E0B':t.accent;ctx.shadowBlur=8;
    ctx.textAlign='center';ctx.fillText(label,cx,by+ph*.72);ctx.restore();
  }

  // ── Toasts ──────────────────────────────────────────────────────────────
  function _drawMilestoneToast(ctx,canvas,milestone){
    if(!milestone) return;
    const s=canvas.width/836,cx=canvas.width/2;
    const tw=280*s,th=56*s,tx=cx-tw/2,ty=canvas.height-80*s;
    ctx.save();ctx.fillStyle='rgba(17,24,39,0.96)';ctx.shadowColor='#F59E0B';ctx.shadowBlur=20;
    ctx.beginPath();ctx.roundRect(tx,ty,tw,th,12*s);ctx.fill();ctx.shadowBlur=0;
    ctx.strokeStyle='#F59E0B';ctx.lineWidth=1.5;ctx.stroke();
    ctx.fillStyle='#F59E0B';ctx.font=`bold ${Math.floor(14*s)}px sans-serif`;ctx.textAlign='center';ctx.fillText(milestone.label,cx,ty+22*s);
    ctx.fillStyle='rgba(255,255,255,0.6)';ctx.font=`${Math.floor(11*s)}px sans-serif`;ctx.fillText(`+${milestone.stars} ★ freigeschaltet`,cx,ty+40*s);
    ctx.restore();
  }

  function _drawPrestigeUnlockToast(ctx,canvas,unlock){
    if(!unlock) return;
    const s=canvas.width/836,cx=canvas.width/2;
    const tw=300*s,th=68*s,tx=cx-tw/2,ty=canvas.height*.12;
    ctx.save();ctx.fillStyle='rgba(17,24,39,0.97)';ctx.shadowColor='#F59E0B';ctx.shadowBlur=25;
    ctx.beginPath();ctx.roundRect(tx,ty,tw,th,12*s);ctx.fill();ctx.shadowBlur=0;
    ctx.strokeStyle='#F59E0B';ctx.lineWidth=2;ctx.stroke();
    ctx.font=`${Math.floor(24*s)}px sans-serif`;ctx.textAlign='center';ctx.fillText(unlock.icon,cx-100*s,ty+42*s);
    ctx.fillStyle='#F59E0B';ctx.font=`bold ${Math.floor(14*s)}px sans-serif`;ctx.fillText(`✦ PRESTIGE UNLOCK: ${unlock.label}`,cx+10*s,ty+24*s);
    ctx.fillStyle='rgba(255,255,255,0.65)';ctx.font=`${Math.floor(11*s)}px sans-serif`;ctx.fillText(unlock.desc,cx+10*s,ty+44*s);
    ctx.restore();
  }

  // ── HUD ─────────────────────────────────────────────────────────────────
  function _drawHUD(ctx,canvas,info){
    const s=canvas.width/836;
    ctx.save();
    ctx.fillStyle='rgba(255,255,255,0.9)';ctx.font=`bold ${Math.floor(22*s)}px sans-serif`;ctx.textAlign='right';
    ctx.fillText(UI.formatScore(info.totalScore),canvas.width-16*s,34*s);
    ctx.fillStyle='rgba(255,255,255,0.5)';ctx.font=`bold ${Math.floor(11*s)}px sans-serif`;ctx.textAlign='left';ctx.fillText('TAPS',16*s,20*s);
    for(let i=0;i<info.tapsMax;i++){const filled=i<(info.tapsMax-info.tapsUsed),cx2=(22+i*26)*s,cy2=34*s,r=9*s;ctx.beginPath();ctx.arc(cx2,cy2,r,0,Math.PI*2);if(filled){ctx.fillStyle='#00C6FF';ctx.shadowColor='#00C6FF';ctx.shadowBlur=10;ctx.fill();}else{ctx.shadowBlur=0;ctx.strokeStyle='rgba(255,255,255,0.15)';ctx.lineWidth=1.5;ctx.stroke();}ctx.shadowBlur=0;}
    if(info.overdrivePending){ctx.fillStyle='#FFE600';ctx.shadowColor='#FFE600';ctx.shadowBlur=12;ctx.font=`bold ${Math.floor(11*s)}px sans-serif`;ctx.textAlign='left';ctx.fillText('⚡ OVERDRIVE BEREIT',16*s,52*s);ctx.shadowBlur=0;}
    if(info.slowMotionActive){ctx.fillStyle='rgba(99,102,241,0.9)';ctx.font=`bold ${Math.floor(13*s)}px sans-serif`;ctx.textAlign='center';ctx.fillText('⏳ ZEITLUPE AKTIV',canvas.width/2,54*s);}
    _drawLevelBadge(ctx,canvas,info.level,info.prestigeLevel||0,info.activeTheme);
    if(info.adaptiveDiffLabel){ctx.fillStyle='rgba(239,68,68,0.8)';ctx.font=`bold ${Math.floor(10*s)}px sans-serif`;ctx.textAlign='center';ctx.fillText(info.adaptiveDiffLabel,canvas.width/2,32*s);}
    if(info.chainLength>0){ctx.textAlign='center';ctx.font=`bold ${Math.floor(30*s)}px sans-serif`;ctx.fillStyle='#FFE600';ctx.shadowColor='#FFE600';ctx.shadowBlur=20;ctx.fillText(`×${info.multiplier}  ${UI.formatChain(info.chainLength)}`,canvas.width/2,38*s);ctx.shadowBlur=0;}
    _drawMissionsPanel(ctx,canvas,info);
    const streakText=UI.formatStreak(info.currentStreak);
    if(streakText){ctx.fillStyle='#F97316';ctx.shadowColor='#F97316';ctx.shadowBlur=10;ctx.font=`bold ${Math.floor(12*s)}px sans-serif`;ctx.textAlign='right';ctx.fillText(streakText,canvas.width-12*s,56*s);ctx.shadowBlur=0;}
    ctx.restore();
  }

  // ── Tutorial Hint (IDLE, erstes Board) ──────────────────────────────────
  function _drawTutorialHint(ctx, canvas, info) {
    const cx  = canvas.width / 2;
    const s   = canvas.width / 836;
    const t   = _getTheme(info.activeTheme);
    const now = Date.now();

    const ringPulse = 0.2 + Math.sin(now / 650) * 0.18;
    ctx.save();
    ctx.globalAlpha = ringPulse;
    ctx.strokeStyle = t.accent;
    ctx.lineWidth   = 2 * s;
    ctx.shadowColor = t.accent;
    ctx.shadowBlur  = 22;
    ctx.beginPath();
    ctx.arc(cx, canvas.height * 0.50, 95 * s, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    const textPulse = 0.4 + Math.sin(now / 480) * 0.6;
    ctx.save();
    ctx.globalAlpha = textPulse;
    ctx.fillStyle   = t.accent;
    ctx.font        = `bold ${Math.floor(17 * s)}px sans-serif`;
    ctx.textAlign   = 'center';
    ctx.shadowColor = t.accent;
    ctx.shadowBlur  = 14;
    ctx.fillText('▼  TIPPE ZUM STARTEN  ▼', cx, canvas.height * 0.89);
    ctx.restore();
  }

  // ── IDLE ────────────────────────────────────────────────────────────────
  function _drawIdle(ctx,canvas,info){
    const cx=canvas.width/2,s=canvas.width/836,t=_getTheme(info.activeTheme);
    _drawLevelBadge(ctx,canvas,info.level,info.prestigeLevel||0,info.activeTheme);
    _drawMissionsPanel(ctx,canvas,info);

    if (info.isTutorialBoard) {
      _drawTutorialHint(ctx, canvas, info);
      return;
    }

    ctx.save();
    ctx.fillStyle=t.accent;ctx.font=`bold ${Math.floor(48*s)}px sans-serif`;ctx.textAlign='center';ctx.shadowColor=t.accent;ctx.shadowBlur=30;
    ctx.fillText('BUBBLE REACTOR',cx,canvas.height*.50);
    ctx.shadowBlur=0;ctx.fillStyle='rgba(255,255,255,0.5)';ctx.font=`${Math.floor(17*s)}px sans-serif`;
    ctx.fillText('Bewege die Maus — klicke zum Zünden',cx,canvas.height*.56);
    ctx.fillStyle='#FFE600';ctx.shadowColor='#FFE600';ctx.shadowBlur=10;ctx.font=`bold ${Math.floor(14*s)}px sans-serif`;
    ctx.fillText(UI.formatStars(info.totalStars),cx,canvas.height*.61);ctx.shadowBlur=0;
    const streakText=UI.formatStreak(info.currentStreak);
    if(streakText){ctx.fillStyle='#F97316';ctx.font=`${Math.floor(12*s)}px sans-serif`;ctx.fillText(streakText,cx,canvas.height*.65);}
    const pulse=.8+Math.sin(Date.now()/400)*.2;ctx.globalAlpha=pulse;ctx.fillStyle='#39FF14';
    ctx.font=`bold ${Math.floor(16*s)}px sans-serif`;ctx.fillText('▼  KLICK ZUM STARTEN  ▼',cx,canvas.height*.70);
    ctx.restore();
  }

  // ── Result Screen ───────────────────────────────────────────────────────
  function _drawResult(ctx,canvas,result,info){
    if(!result) return;
    const cx=canvas.width/2,cy=canvas.height/2,s=canvas.width/836;
    UI.clear();
    ctx.save();
    ctx.fillStyle='rgba(13,15,26,0.92)';ctx.beginPath();ctx.roundRect(cx-220*s,cy-185*s,440*s,440*s,16*s);ctx.fill();
    ctx.strokeStyle='#00C6FF';ctx.lineWidth=2;ctx.stroke();
    ctx.fillStyle='rgba(255,255,255,0.3)';ctx.font=`${Math.floor(12*s)}px sans-serif`;ctx.textAlign='center';
    ctx.fillText(`BOARD ${info.boardIndex+1}  ·  LEVEL ${info.level}${info.isWeeklyBoard?' 🏆':''}${info.hardcoreMode?' 💎':''}`,cx,cy-162*s);
    ctx.fillStyle='#FFF';ctx.font=`bold ${Math.floor(38*s)}px sans-serif`;ctx.shadowColor='#00C6FF';ctx.shadowBlur=15;
    ctx.fillText(UI.formatScore(info.totalScore),cx,cy-120*s);ctx.shadowBlur=0;
    const bc=Math.max(0,...(info.tapsResults||[]).map(r=>r.chainLength));
    ctx.fillStyle='#FFE600';ctx.font=`${Math.floor(15*s)}px sans-serif`;ctx.fillText(`Beste Chain: ${bc}`,cx,cy-88*s);
    ctx.fillStyle='rgba(255,255,255,0.45)';ctx.font=`bold ${Math.floor(11*s)}px sans-serif`;ctx.fillText('MISSIONEN',cx,cy-60*s);
    const ms=info.missions||[],se=ms.filter(m=>m.completed).length;
    ms.forEach((m,i)=>{const my=cy-38*s+i*32*s;ctx.font=`${Math.floor(18*s)}px sans-serif`;if(m.completed){ctx.fillStyle='#FFE600';ctx.shadowColor='#FFE600';ctx.shadowBlur=10;}else{ctx.fillStyle='rgba(255,255,255,0.18)';ctx.shadowBlur=0;}ctx.fillText('★',cx-100*s,my+6*s);ctx.shadowBlur=0;ctx.textAlign='left';ctx.font=`${Math.floor(14*s)}px sans-serif`;ctx.fillStyle=m.completed?'#FFF':'rgba(255,255,255,0.35)';ctx.fillText(m.label,cx-78*s,my+6*s);ctx.textAlign='center';});
    ctx.font=`${Math.floor(22*s)}px sans-serif`;
    for(let i=0;i<3;i++){ctx.fillStyle=i<se?'#FFE600':'rgba(255,255,255,0.15)';if(i<se){ctx.shadowColor='#FFE600';ctx.shadowBlur=12;}else ctx.shadowBlur=0;ctx.fillText('★',cx+(i-1)*30*s,cy+68*s);}
    ctx.shadowBlur=0;
    ctx.fillStyle='rgba(255,255,255,0.35)';ctx.font=`${Math.floor(12*s)}px sans-serif`;ctx.fillText(UI.formatStars(info.totalStars),cx,cy+88*s);
    const hs=Storage.get(Storage.KEYS.HIGH_SCORE)||0;
    ctx.fillStyle='rgba(255,255,255,0.25)';ctx.font=`${Math.floor(11*s)}px sans-serif`;ctx.fillText(UI.formatHighScore(hs),cx,cy+104*s);
    ctx.restore();

    // Buttons: UI.getResultButtons entscheidet welche — renderer zeichnet sie
    const buttons = UI.getResultButtons(info);
    const gap = 44 * s;
    let btnY = cy + 116 * s;
    buttons.forEach(btn => {
      _drawButton(ctx, s, cx, btnY, btn.id, btn.label, btn.bg, btn.glow, btn.w || 200);
      btnY += gap;
    });

    // Countdown-Balken nur beim Tutorial-Result
    if (info.autoNextProgress >= 0) {
      _drawAutoNextBar(ctx, cx, btnY, s, info.autoNextProgress);
    }
  }

  // ── Auto-Next Countdown-Balken ───────────────────────────────────────────
  function _drawAutoNextBar(ctx, cx, topY, s, progress) {
    const barW = 200 * s, barH = 5 * s, barX = cx - barW / 2;
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath(); ctx.roundRect(barX, topY, barW, barH, barH / 2); ctx.fill();
    if (progress > 0) {
      ctx.fillStyle = '#00C6FF'; ctx.shadowColor = '#00C6FF'; ctx.shadowBlur = 6;
      ctx.beginPath(); ctx.roundRect(barX, topY, barW * Math.min(progress, 1), barH, barH / 2); ctx.fill();
      ctx.shadowBlur = 0;
    }
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.font = `${Math.floor(10 * s)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('automatisch weiter...', cx, topY + 16 * s);
    ctx.restore();
  }

  // ── Shop Screen ─────────────────────────────────────────────────────────
  function _drawShop(ctx,canvas,info){
    const cx=canvas.width/2,s=canvas.width/836,upgrades=info.upgradeStatus||[];
    UI.clear();
    ctx.save();ctx.fillStyle='rgba(5,7,15,0.97)';ctx.fillRect(0,0,canvas.width,canvas.height);

    if(info.prestigeAvailable){
      ctx.fillStyle='rgba(245,158,11,0.15)';ctx.strokeStyle='rgba(245,158,11,0.5)';ctx.lineWidth=1;
      ctx.beginPath();ctx.roundRect(16*s,8*s,canvas.width-32*s,30*s,6*s);ctx.fill();ctx.stroke();
      ctx.fillStyle='#F59E0B';ctx.shadowColor='#F59E0B';ctx.shadowBlur=10;ctx.font=`bold ${Math.floor(11*s)}px sans-serif`;ctx.textAlign='center';
      ctx.fillText('✦  ALLE UPGRADES MAXED — PRESTIGE VERFÜGBAR!  ✦',cx-60*s,28*s);ctx.restore();ctx.save();
      _drawButton(ctx,s,canvas.width-90*s,10*s,'prestige','✦ PRESTIGE','#92400E','#F59E0B',100);ctx.save();
    }

    const headerY=info.prestigeAvailable?50*s:10*s;
    ctx.fillStyle='#8B5CF6';ctx.font=`bold ${Math.floor(18*s)}px sans-serif`;ctx.textAlign='center';ctx.shadowColor='#8B5CF6';ctx.shadowBlur=14;
    ctx.fillText('✦  UPGRADE SHOP  ✦',cx,headerY+22*s);ctx.shadowBlur=0;
    ctx.fillStyle='#FFE600';ctx.shadowColor='#FFE600';ctx.shadowBlur=8;ctx.font=`bold ${Math.floor(13*s)}px sans-serif`;
    ctx.fillText(`${UI.formatStars(info.totalStars)}  ·  Prestige ${info.prestigeLevel||0}`,cx,headerY+40*s);ctx.shadowBlur=0;

    if(info.hardcoreAvailable){
      const hbg=info.hardcoreMode?'#7F1D1D':'#1F2937';
      const hgl=info.hardcoreMode?'#EF4444':'#6B7280';
      _drawButton(ctx,s,cx,headerY+48*s,'hardcore_toggle',info.hardcoreMode?'💎 HARDCORE AN':'💎 HARDCORE AUS',hbg,hgl,160);
    }

    ctx.strokeStyle='rgba(139,92,246,0.3)';ctx.lineWidth=1;
    const divY=headerY+(info.hardcoreAvailable?90:56)*s;
    ctx.beginPath();ctx.moveTo(16*s,divY);ctx.lineTo(canvas.width-16*s,divY);ctx.stroke();

    const rowH=46*s,colW=(canvas.width-24*s)/2,startY=divY+8*s;
    upgrades.forEach((upg,i)=>{
      const col=i%2,row=Math.floor(i/2),cellX=12*s+col*colW,cellY=startY+row*rowH;
      ctx.save();ctx.fillStyle=upg.maxed?'rgba(110,231,183,0.06)':'rgba(255,255,255,0.04)';
      ctx.strokeStyle=upg.maxed?'rgba(110,231,183,0.2)':'rgba(139,92,246,0.15)';ctx.lineWidth=1;
      ctx.beginPath();ctx.roundRect(cellX+2*s,cellY+2*s,colW-8*s,rowH-5*s,6*s);ctx.fill();ctx.stroke();
      ctx.font=`${Math.floor(16*s)}px sans-serif`;ctx.textAlign='left';ctx.fillStyle='#FFF';ctx.fillText(upg.icon,cellX+8*s,cellY+20*s);
      ctx.font=`bold ${Math.floor(10.5*s)}px sans-serif`;ctx.fillStyle=upg.maxed?'#6EE7B7':'#FFF';ctx.fillText(upg.label,cellX+30*s,cellY+16*s);
      ctx.font=`${Math.floor(9*s)}px sans-serif`;ctx.fillStyle='rgba(255,255,255,0.4)';ctx.fillText(upg.desc,cellX+30*s,cellY+28*s);
      for(let d=0;d<upg.maxLevel;d++){ctx.beginPath();ctx.arc(cellX+30*s+d*10*s,cellY+40*s,3*s,0,Math.PI*2);ctx.fillStyle=d<upg.level?'#8B5CF6':'rgba(255,255,255,0.15)';ctx.fill();}
      const bw=60*s,bh=20*s,bx=cellX+colW-68*s,by2=cellY+rowH-26*s;
      if(upg.maxed){ctx.fillStyle='rgba(110,231,183,0.15)';ctx.beginPath();ctx.roundRect(bx,by2,bw,bh,4*s);ctx.fill();ctx.fillStyle='#6EE7B7';ctx.font=`bold ${Math.floor(9*s)}px sans-serif`;ctx.textAlign='center';ctx.fillText('MAX ✓',bx+bw/2,by2+bh*.72);}
      else{ctx.fillStyle=upg.canBuy?'#7C3AED':'rgba(255,255,255,0.07)';ctx.shadowColor=upg.canBuy?'#8B5CF6':'transparent';ctx.shadowBlur=upg.canBuy?8:0;ctx.beginPath();ctx.roundRect(bx,by2,bw,bh,4*s);ctx.fill();ctx.shadowBlur=0;ctx.fillStyle=upg.canBuy?'#FFF':'rgba(255,255,255,0.25)';ctx.font=`bold ${Math.floor(9*s)}px sans-serif`;ctx.textAlign='center';ctx.fillText(`★ ${upg.cost}`,bx+bw/2,by2+bh*.72);if(upg.canBuy)UI.register('buy_'+upg.id,bx,by2,bw,bh);}
      ctx.restore();
    });

    const roadY=startY+Math.ceil(upgrades.length/2)*rowH+8*s;
    ctx.fillStyle='rgba(245,158,11,0.3)';ctx.strokeStyle='rgba(245,158,11,0.4)';ctx.lineWidth=1;
    ctx.beginPath();ctx.roundRect(16*s,roadY,canvas.width-32*s,16*s,4*s);ctx.fill();ctx.stroke();
    ctx.fillStyle='#F59E0B';ctx.font=`bold ${Math.floor(10*s)}px sans-serif`;ctx.textAlign='center';
    ctx.fillText('✦  PRESTIGE FAHRPLAN  ✦',cx,roadY+11*s);
    const unlocks=info.prestigeUnlocks||[];
    const pLevel=info.prestigeLevel||0;
    unlocks.forEach((u,i)=>{
      const col=i%5,row2=Math.floor(i/5);
      const ux=28*s+col*(canvas.width-56*s)/4.2,uy=roadY+22*s+row2*36*s;
      const done=u.level<=pLevel,next=u.level===pLevel+1;
      ctx.save();
      ctx.fillStyle=done?'rgba(245,158,11,0.2)':next?'rgba(99,102,241,0.2)':'rgba(255,255,255,0.04)';
      ctx.strokeStyle=done?'rgba(245,158,11,0.6)':next?'rgba(99,102,241,0.6)':'rgba(255,255,255,0.1)';
      ctx.lineWidth=next?1.5:1;
      ctx.beginPath();ctx.roundRect(ux-2*s,uy,34*s,30*s,5*s);ctx.fill();ctx.stroke();
      ctx.font=`${Math.floor(13*s)}px sans-serif`;ctx.textAlign='center';ctx.fillText(u.icon,ux+15*s,uy+16*s);
      ctx.font=`${Math.floor(7.5*s)}px sans-serif`;
      ctx.fillStyle=done?'#F59E0B':next?'#A5B4FC':'rgba(255,255,255,0.3)';
      ctx.fillText(`P${u.level}`,ux+15*s,uy+27*s);
      if(done){ctx.fillStyle='rgba(245,158,11,0.8)';ctx.font=`${Math.floor(8*s)}px sans-serif`;ctx.fillText('✓',ux+15*s,uy+8*s);}
      ctx.restore();
    });

    ctx.restore();
    _drawButton(ctx,s,cx,canvas.height-46*s,'shop_back','← Weiter spielen','#374151','#6B7280',200);
  }

  // ── Haupt-Render ────────────────────────────────────────────────────────
  function draw(ctx,canvas,state,bubbles,lastResult,info){
    const theme=info.activeTheme||'default';
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.save();_applyShake(ctx);
    _drawBackground(ctx,canvas,theme);
    _updateTrail(info.launcher||{},info.trailEnabled);
    if(state!=='SHOP'){bubbles.forEach(b=>_drawBubble(ctx,b,theme));if(typeof Particles!=='undefined')Particles.draw(ctx);}
    switch(state){
      case 'IDLE':      _drawIdle(ctx,canvas,info);   _drawLauncher(ctx,canvas,info); break;
      case 'PLAYING':   _drawHUD(ctx,canvas,info);    _drawLauncher(ctx,canvas,info); _drawSlowMotionButton(ctx,canvas,{...info,state}); break;
      case 'EXPLODING': _drawHUD(ctx,canvas,info);    _drawSlowMotionButton(ctx,canvas,{...info,state}); break;
      case 'RESULT':    _drawHUD(ctx,canvas,info);    _drawResult(ctx,canvas,lastResult,info); break;
      case 'SHOP':      _drawShop(ctx,canvas,info);   break;
    }
    if(info.hardcoreMode&&state!=='SHOP') _drawHardcoreBadge(ctx,canvas);
    ctx.restore();
    _drawFlash(ctx,canvas);
    if(state==='RESULT') _drawMilestoneToast(ctx,canvas,info.pendingMilestone);
    _drawPrestigeUnlockToast(ctx,canvas,info.pendingPrestigeUnlock);
  }

  function lightenColor(hex,a){return _shiftColor(hex,a);}
  function darkenColor(hex,a){return _shiftColor(hex,-a);}
  function _shiftColor(hex,a){const n=parseInt(hex.replace('#',''),16);return `rgb(${Math.min(255,Math.max(0,(n>>16)+a))},${Math.min(255,Math.max(0,((n>>8)&0xff)+a))},${Math.min(255,Math.max(0,(n&0xff)+a))})`;}

  // getHitButton bleibt als öffentliche API — delegiert an UI.getHit.
  // game.js ruft weiterhin Renderer.getHitButton(cx, cy) auf — keine Änderung nötig.
  function getHitButton(cx, cy) { return UI.getHit(cx, cy); }

  return { draw, triggerShake, triggerFlash, getHitButton };
})();