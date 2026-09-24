/* Hand-drawn Canvas artwork + fixed-step client. All assets are generated locally. */
(() => {
  'use strict';
  const { Game, LEVELS, UPGRADES, W, H, clamp } = Sunny;
  const $ = id => document.getElementById(id), canvas = $('arena'), ctx = canvas.getContext('2d');
  let game = new Game(), lastTime = 0, accumulator = 0, visualTime = 0, screenState = '', best = 0, shake = 0, bannerTime = 0, autoFire = false, muted = true, audio = null, soundTime = 0;
  const prefs = { difficulty:'cozy', assist:true, softMotion:true, hints:true, numbers:false, volume:.35, muted:true, coachDone:false };
  try { const saved = JSON.parse(localStorage.getItem('sunny-delivery-prefs')); if(saved && typeof saved === 'object') { for(const k of ['assist','softMotion','hints','numbers','muted','coachDone']) if(typeof saved[k] === 'boolean') prefs[k]=saved[k]; if(['cozy','standard'].includes(saved.difficulty))prefs.difficulty=saved.difficulty;if(Number.isFinite(saved.volume))prefs.volume=clamp(saved.volume,0,1); } } catch {}
  game.mode=prefs.difficulty;muted=prefs.muted;
  let playerRecoil=0;
  let settingsOpen=false, toastUntil=0, hitUntil=0, lastHitSound=0, lastNumber=0, tutorial=new Set();
  let savedRun = null;
  try { const data = JSON.parse(localStorage.getItem('sunny-delivery-run')); if (Game.restore(data)) savedRun = data; } catch {}
  if (savedRun) { $('continue').classList.remove('hidden'); $('continue').textContent = `续送第 ${savedRun.wave + 1} 站`; }
  let particles = [], rings = [], floats = [], aim = { x: 840, y: 380 }, firing = false, pressed = { dash: false, echo: false, pulse: false }, keys = new Set();
  try { best = Number(localStorage.getItem('sunny-delivery-best')) || 0; } catch { /* Storage can be disabled in private/file mode. */ }
  $('best-score').textContent = String(best).padStart(6, '0');
  const ink = '#536052', orange = '#ed9364', mint = '#7abfaf', pink = '#d9928d', blue = '#8bafc4', purple = '#ad97bf';
  const TAU = Math.PI * 2;
  function rr(x, y, w, h, r, fill, stroke, line = 2) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = line; ctx.stroke(); } }
  function line(x1, y1, x2, y2, color, width = 2) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke(); }
  function ellipse(x, y, rx, ry, color) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.fillStyle = color; ctx.fill(); }
  function circle(x, y, r, fill, stroke, lw = 2) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); } }
  function text(s, x, y, size, color, align = 'left', weight = '400') { ctx.font = `${weight} ${size}px ui-monospace, SFMono-Regular, sans-serif`; ctx.textAlign = align; ctx.fillStyle = color; ctx.fillText(s, x, y); }
  function path(points, fill, stroke, lw = 2) { ctx.beginPath(); points.forEach(([x,y],i) => i ? ctx.lineTo(x,y) : ctx.moveTo(x,y)); ctx.closePath(); if (fill) {ctx.fillStyle=fill;ctx.fill();} if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=lw;ctx.stroke();} }
  function spark(x, y, color, count = 10, speed = 150) { if(prefs.softMotion) count=Math.ceil(count*.5); for (let i = 0; i < count && particles.length < 420; i++) { const a = Math.random() * TAU, v = speed * (.25 + Math.random()); particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, color, life: .3 + Math.random() * .4, max: .7, size: 2 + Math.random() * 4, angle: Math.random() * TAU }); } }
  function floating(label, x, y, color = '#849d6e') { if (floats.length < 30) floats.push({ label, x, y, color, life: 1.1 }); }
  function tone(freq, duration = .08, type = 'sine', volume = .035, bend = 0) {
    if (muted) return;
    try { if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)(); if (audio.state === 'suspended') audio.resume().catch(() => {}); const now = audio.currentTime; const osc = audio.createOscillator(), gain = audio.createGain(); osc.type = type; osc.frequency.setValueAtTime(freq, now); if (bend) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + bend), now + duration); gain.gain.setValueAtTime(Math.max(.0001,volume*prefs.volume), now); gain.gain.exponentialRampToValueAtTime(.0001, now + duration); osc.connect(gain); gain.connect(audio.destination); osc.start(now); osc.stop(now + duration); } catch { /* Sound is optional. */ }
  }
  function drainEvents() {
    for (const e of game.events.splice(0)) {
      if (e.type === 'shot') { playerRecoil=4;tutorial.add('fire'); if (visualTime - soundTime > .09) { tone(340, .055, 'triangle', .018, -160); soundTime = visualTime; } spark(e.x + Math.cos(e.angle)*27, e.y + Math.sin(e.angle)*27, '#ffc65d', 2, 55); }
      else if (e.type === 'hit') { spark(e.x,e.y,e.ghost?'#87c8b7':'#f6bd61',4,90);if(!e.ghost){hitUntil=visualTime+.12;if(visualTime-lastHitSound>.075){tone(1050,.028,'triangle',.012,-200);lastHitSound=visualTime;}}if(prefs.numbers && visualTime-lastNumber>.075){floating(String(Math.round(e.damage)),e.x,e.y-20,e.ghost?'#71ac99':'#b88b51');lastNumber=visualTime;} }
      else if (e.type === 'wallHit') spark(e.x, e.y, '#c4b08a', 2, 65);
      else if (e.type === 'kill') { spark(e.x, e.y, e.kind === 'boss' ? '#ed966e' : '#c9b582', e.kind === 'boss' ? 55 : 16, 190); spark(e.x, e.y, '#ffffff', 6, 125); rings.push({ x:e.x, y:e.y, radius:e.kind==='boss'?140:40, life:.45, max:.45, color:'#e9bb6d' }); shake = Math.max(shake, e.kind === 'boss' ? 8 : 1.7); tone(180,.18,'triangle',.035,-130); }
      else if (e.type === 'hurt') { shake = 6; spark(e.x,e.y,'#e79480',12); floating(game.player.hp<game.player.maxHp*.3?'电量低，先拉开距离':'机体受损',e.x,e.y-30,'#c97d63'); tone(130,.22,'sawtooth',.025,-70); }
      else if (e.type === 'dash') { tutorial.add('dash'); spark(e.x,e.y,'#fff5ce',12,100); tone(500,.13,'sine',.025,350); }
      else if (e.type === 'echo') { tutorial.add('echo'); spark(e.x,e.y,'#75c5b1',20,160); floating('过去的我：来了！',e.x,e.y-40,'#60aa99'); tone(580,.2,'sine',.04,350); }
      else if (e.type === 'pulse' || e.type === 'ring') { rings.push({ x:e.x, y:e.y, radius:e.radius, life:.5, max:.5, color:e.color || '#e7a484' }); if (e.type === 'pulse') { tutorial.add('pulse'); floating(e.returned ? `${e.returned} 件，全部退回！` : '本件拒收！',e.x,e.y-40,'#d8906e'); tone(420,.26,'triangle',.045,520); shake = 2.5; } }
      else if (e.type === 'pickup') { spark(e.x,e.y,'#8ac9a2',3,70); tone(920,.065,'sine',.016,250); }
      else if(e.type==='parcel'){floating('取件成功，回中央邮筒签收',e.x,e.y-45,'#b28b4c');tone(660,.13,'sine',.04,300);}
      else if(e.type==='delivered'){spark(e.x,e.y,'#8bc7a2',30,190);rings.push({x:e.x,y:e.y,radius:95,life:.7,max:.7,color:'#85baa0'});floating('签收！+350 积分 / +18 电量',e.x,e.y-50,'#6a9e80');notice('妥投成功，分身和退件冷却各缩短 3 秒',true);tone(790,.25,'triangle',.045,380);}
      else if(e.type==='practice'){$('wave-banner').innerHTML='先试试，再出发。<small>这里不扣电、无时限，靶机自动补充。</small>';bannerTime=2.3;$('wave-banner').classList.remove('hidden');}
      else if (e.type === 'level') { $('mode-label').textContent=game.mode==='cozy'?'悠闲派送':'标准派送'; persistRun(); const level = LEVELS[e.wave]; $('wave-banner').innerHTML = `${String(e.wave+1).padStart(2,'0')} / ${level.name}<small>${level.place}${level.boss ? ' · 主管来了！' : ' · 准备开始派件'}</small>`; bannerTime = 1.6; $('wave-banner').classList.remove('hidden'); }
      else if (e.type === 'clear') { floating(game.delivery?.state==='carrying'?'街区已清理，顺手去签收吧':'街区清理完成！',game.player.x,game.player.y-42,'#73a484'); tone(660,.2,'triangle',.04,320); }
      else if (e.type === 'end') { best = Math.max(best, game.score); try { localStorage.setItem('sunny-delivery-best', String(best)); } catch {} $('best-score').textContent = String(best).padStart(6,'0'); if (e.won) { savedRun=null;try { localStorage.removeItem('sunny-delivery-run'); } catch {} } if (e.won) for(let i=0;i<7;i++) spark(150+i*150,170,['#f0b45b','#8bcbb3','#d3a9c3'][i%3],40,230); }
    }
  }
  function drawGround(menu = false) {
    ctx.fillStyle = game.level.color; ctx.fillRect(0,0,W,H);
    // Paper grain: a cached, deterministic dot arrangement rather than image assets.
    ctx.fillStyle = '#667b4510'; for(let y=14;y<H;y+=27) for(let x=14;x<W;x+=27) ctx.fillRect(x+(y%3)*4,y,1.5,1.5);
    rr(44,44,W-88,H-88,27,'#f8f7e255','#ccd7ba',2);
    ctx.setLineDash([7,10]); rr(66,66,W-132,H-132,20,null,'#b9c8a166',2); ctx.setLineDash([]);
    // Crossroads and painted lane markings.
    rr(62,325,W-124,110,12,'#f7f5e280'); rr(525,66,150,H-132,10,'#f7f5e25c');
    ctx.setLineDash([16,18]); line(85,380,1115,380,'#c5ceb566',2); line(600,85,600,675,'#c5ceb566',2); ctx.setLineDash([]);
    for(const [x,y,a] of [[140,380,0],[1040,380,Math.PI],[600,130,Math.PI/2],[600,635,-Math.PI/2]]) { ctx.save();ctx.translate(x,y);ctx.rotate(a);path([[-12,-8],[0,-8],[0,-14],[15,0],[0,14],[0,8],[-12,8]],'#d5dfc3');ctx.restore(); }
    if(!menu) { ctx.save();ctx.translate(600,385);ctx.rotate(-.18);text(String(game.wave+1).padStart(2,'0'),0,0,128,'#b4c69920','center','800');text('SUNNY DELIVERY',0,31,12,'#a9bb922d','center','700');ctx.restore(); }
    if(!menu)drawDistrict();
    // Border garden, flowers, and small road studs.
    for(let x=92;x<1130;x+=95){rr(x,25,26,5,2,'#b6c79e');rr(x,H-29,26,5,2,'#b6c79e');}
    for(let y=90;y<700;y+=100){rr(24,y,5,26,2,'#b6c79e');rr(W-29,y,5,26,2,'#b6c79e');}
    for(const [x,y] of [[91,91],[1107,88],[96,659],[1106,660]]) drawPlant(x,y);
    if(game.level.rule==='belt') for(const [y,dir] of [[260,1],[500,-1]]) { rr(55,y-42,1090,84,9,'#dfd6b575','#c9bc90',2); ctx.save();ctx.beginPath();ctx.rect(60,y-39,1080,78);ctx.clip();for(let x=-50;x<1250;x+=54){const xx=x+(visualTime*90*dir)%54;line(xx,y-24,xx+dir*20,y,'#c1b387',3);line(xx+dir*20,y,xx,y+24,'#c1b387',3);}ctx.restore(); }
    for(const z of game.hotZones()){ctx.globalAlpha=z.active?.8:z.warn?(prefs.softMotion?.55:.45+.15*Math.sin(visualTime*10)):.16;rr(z.x,z.y,z.w,z.h,8,z.active?'#ef9a79':'#d6b779');ctx.setLineDash([8,8]);rr(z.x+5,z.y+5,z.w-10,z.h-10,4,null,'#ba795b',2);ctx.setLineDash([]);ctx.globalAlpha=1;}
    if(game.level.rule==='wind') {ctx.globalAlpha=.5;for(let i=0;i<9;i++){const x=((visualTime*130+i*149)%1350)-100,y=90+(i*79)%590;line(x,y,x+52,y,'#a1c0b2',2);line(x+16,y+7,x+32,y+7,'#a1c0b2',1);}ctx.globalAlpha=1;}
    if(game.level.rule==='magnet'){ctx.save();ctx.translate(600,380);ctx.rotate(visualTime*.1);ctx.setLineDash([5,20]);circle(0,0,220,null,'#b9a9c444',2);circle(0,0,300,null,'#b9a9c433',1);ctx.setLineDash([]);ctx.restore();}
  }
  function districtTheme(){return ['garden','coast','depot','garden','depot','roof','garden','depot','coast','roof','depot','roof'][game.wave];}
  function drawDistrict(){
    const theme=districtTheme();
    if(theme==='coast'){
      ctx.fillStyle='#b0d7d1';ctx.fillRect(0,0,W,24);ctx.fillRect(0,H-24,W,24);
      for(let x=35;x<W;x+=55){ctx.beginPath();ctx.moveTo(x,12);ctx.quadraticCurveTo(x+12,5,x+25,12);ctx.strokeStyle='#e3f6e4';ctx.lineWidth=2;ctx.stroke();ctx.beginPath();ctx.moveTo(x,H-12);ctx.quadraticCurveTo(x+12,H-19,x+25,H-12);ctx.stroke();}
      for(const [x,y]of [[150,110],[1030,635]]){ctx.save();ctx.translate(x,y);ctx.rotate(-.2);ellipse(0,0,29,13,'#e1cfab60');path([[-10,0],[0,-13],[12,0],[0,9]],'#f2c1a299');ctx.restore();}
      for(let x=180;x<1040;x+=180){line(x,51,x+75,51,'#cab99955',4);line(x,709,x+75,709,'#cab99955',4);}
    }else if(theme==='depot'){
      for(let x=110;x<1100;x+=80)for(let y=110;y<680;y+=80){line(x-3,y,x+3,y,'#afae9450',1);line(x,y-3,x,y+3,'#afae9450',1);}
      for(const [x,y]of [[75,310],[1075,440]]){ctx.save();ctx.translate(x,y);rr(0,0,48,65,5,null,'#c7b991',1);ctx.setLineDash([4,4]);line(9,10,39,10,'#bcad83');ctx.setLineDash([]);text('D'+String(game.wave+1).padStart(2,'0'),24,38,11,'#b4a782','center');ctx.restore();}
      for(let x=95;x<1110;x+=32){line(x,39,x+14,39,'#cfc19f',5);line(x,H-39,x+14,H-39,'#cfc19f',5);}
    }else if(theme==='roof'){
      ctx.save();ctx.globalAlpha=.22;for(let x=80;x<1140;x+=80)line(x,75,x,685,'#9baf9e',1);for(let y=80;y<690;y+=80)line(75,y,1125,y,'#9baf9e',1);ctx.restore();
      for(const [x,y]of [[180,120],[1020,640]]){circle(x,y,29,null,'#a7bea459',2);text('H',x,y+9,26,'#a7bea459','center','600');}
      for(let x=150;x<1100;x+=150){rr(x,7,66,18,4,'#bdcbb6','#a5b69e',1);line(x+6,14,x+60,14,'#e4ebd9',2);rr(x,H-25,66,18,4,'#bdcbb6','#a5b69e',1);}
    }else{
      for(const [x,y]of [[174,155],[1035,156],[172,601],[1038,595]]){
        ellipse(x,y,34,23,'#c8d8b52b');for(let i=0;i<5;i++){const a=i*2.4,dx=Math.cos(a)*20,dy=Math.sin(a)*14;circle(x+dx,y+dy,3.5,i%2?'#f5d38c':'#e7bbae');circle(x+dx,y+dy,1.3,'#fff7df');}
      }
      ctx.save();ctx.setLineDash([2,8]);circle(600,380,170,null,'#baccaa2c',2);ctx.setLineDash([]);ctx.restore();
    }
  }
  function drawDelivery(){
    const d=game.delivery;if(!d)return;const home=d.drop;
    ctx.save();ctx.setLineDash([5,7]);circle(home.x,home.y,59,d.state==='carrying'?'#9ecaab28':'#fff4c11a',d.state==='carrying'?'#83b393':'#c3cda8',1.7);ctx.setLineDash([]);
    ellipse(home.x+3,home.y-12,24,9,'#6f906b18');rr(home.x-17,home.y-47,34,38,9,'#aed2bd','#7ba38c',1.7);rr(home.x-17,home.y-30,34,6,1,'#77a48d');rr(home.x-11,home.y-41,22,4,2,'#e4f1d9');line(home.x-10,home.y-9,home.x-10,home.y, '#89a289',2);line(home.x+10,home.y-9,home.x+10,home.y,'#89a289',2);
    text(d.state==='done'?'已签收':d.state==='carrying'?'进入圆圈 · 自动签收':'签收邮筒',home.x,home.y+77,11,d.state==='carrying'?'#70956e':'#9aab87','center');
    if(d.progress>0&&d.state!=='done'){ctx.beginPath();ctx.arc(home.x,home.y,59,-Math.PI/2,-Math.PI/2+d.progress*TAU);ctx.strokeStyle='#76af91';ctx.lineWidth=5;ctx.stroke();}
    if(d.state==='done'){rr(home.x-28,home.y+18,56,23,6,'#e4f0da','#b5cda4',1);text('妥投',home.x,home.y+34,12,'#7c9d68','center');}
    if(d.state==='waiting'){
      const bob=prefs.softMotion?0:Math.sin(visualTime*2)*3;ellipse(d.x+2,d.y+13,21,8,'#8a81501e');circle(d.x,d.y,32,null,'#d7b76b88',1.5);drawParcel(d.x,d.y+bob,1);rr(d.x-23,d.y-51,46,20,6,'#fff5d9','#e2cc92',1);text('取件',d.x,d.y-37,11,'#af9157','center');
    }else if(d.state==='carrying'){
      const p=game.player,a=Math.atan2(home.y-p.y,home.x-p.x);if(Math.hypot(p.x-home.x,p.y-home.y)>100){ctx.save();ctx.translate(p.x+Math.cos(a)*64,p.y+Math.sin(a)*64);ctx.rotate(a);path([[10,0],[-5,-6],[-1,0],[-5,6]],'#b39451aa');ctx.restore();}
    }
    ctx.restore();
  }
  function drawParcel(x,y,scale=1){ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);rr(-15,-13,30,26,5,'#f4cd87','#ac9568',1.6);path([[-15,-13],[0,-20],[15,-13],[0,-7]],'#ffdc9e','#ac9568',1.4);line(0,-7,0,13,'#c0a36b',2);rr(4,-3,7,7,1,'#fff4d7');line(-10,4,-5,4,'#b0935d',1.3);ctx.restore();}
  function drawPlant(x,y){ellipse(x+4,y+8,22,11,'#65785014');rr(x-15,y-2,30,19,6,'#d6c2a1','#b8a686',1.5);ellipse(x-9,y-7,10,16,'#9bb889');ellipse(x+9,y-5,9,13,'#afc597');ellipse(x,y-16,9,15,'#bccc98');circle(x+5,y-23,3,'#f6c879');}
  function drawCrate(r) {
    rr(r.x+6,r.y+9,r.w,r.h,9,'#61704e1b');rr(r.x,r.y,r.w,r.h,8,r.variant===1?'#c1d4c2':r.variant===2?'#d5c8db':'#e6cea1','#b1af8b',2);
    rr(r.x+4,r.y+4,r.w-8,r.h-8,5,null,'#fffbe575',2);rr(r.x+r.w*.45,r.y,11,r.h,0,'#fff2c47a');
    for(let x=r.x+40;x<r.x+r.w;x+=40)line(x,r.y+3,x,r.y+r.h-3,'#8b8e7138',1);
    ctx.save();ctx.translate(r.x+r.w*.24,r.y+r.h*.5);ctx.rotate(-.13);rr(-15,-11,30,22,2,'#f8f4de');text('↑ ↑',0,1,10,'#9a9a7a','center');line(-8,6,8,6,'#c2bea3',1);ctx.restore();
    for(const x of [r.x+8,r.x+r.w-8]){circle(x,r.y+8,2,'#aaa788');circle(x,r.y+r.h-8,2,'#aaa788');}
  }
  function drawRobot(x,y,angle,scale=1,kind='player',time=0,ghost=false,flash=false,recoil=0){
    ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);
    if(ghost)ctx.globalAlpha=.53;
    ellipse(4,11,23,12,'#405b4824');
    // Legs remain upright; the articulated cannon follows the aim independently.
    const walk=Math.sin(time*13)*2;
    rr(-23,-10+walk,11,28,5,ghost?'#81baa8':'#697364','#4a5a4f',1.5);rr(12,-10-walk,11,28,5,ghost?'#81baa8':'#697364','#4a5a4f',1.5);
    for(const sx of [-20,15])for(let i=0;i<3;i++)line(sx,-4+i*7,sx+5,-4+i*7,'#9fab90',1);
    const body=flash?'#fffce4':ghost?'#b1e0ca':kind==='player'?'#ffd47b':kind==='hunter'?'#eaa48b':kind==='shooter'?'#b5cfdd':kind==='charger'?'#cdb8df':'#efb77e';
    rr(-18,-22,36,38,9,body,ink,2);rr(-14,-19,28,4,2,'#ffffff65');
    line(0,-22,0,-33,ink,2);circle(0,-34,3.5,ghost?'#81c8ac':'#ea986d',ink,1.5);
    rr(-12,-11,24,12,4,ghost?'#5c9f8c':'#56695e');rr(-8,-7,4,4,1,'#fff7d5');rr(4,-7,4,4,1,'#fff7d5');
    line(-3,6,3,6,ink,1.5);rr(8,8,5,4,1,'#fff1c9');
    // Little parcel backpack, hand rivets, and rotatable delivery cannon.
    rr(-9,15,18,6,2,ghost?'#9bceba':'#d5b27a',ink,1.5);
    ctx.save();ctx.rotate(angle);ctx.translate(-recoil,0);rr(12,3,21,11,4,ghost?'#a2d6c4':'#d7c09b',ink,2);rr(28,3,11,11,3,ghost?'#8ac8b2':'#85ac9d',ink,1.5);line(32,5,32,12,'#b7d2bd',1.5);circle(12,8,5,body,ink,1.5);ctx.restore();
    if(kind==='hunter'){path([[-17,-18],[-24,-28],[-9,-23]],body,ink,1.5);path([[17,-18],[24,-28],[9,-23]],body,ink,1.5);}
    if(kind==='shooter'){line(-13,-26,13,-26,ink,2);circle(0,-29,7,body,ink,1.5);circle(0,-29,2,'#fbf6df');}
    if(kind==='charger'){path([[-17,-21],[-22,-33],[-6,-23]],'#c1a3d1',ink,1.5);path([[17,-21],[22,-33],[6,-23]],'#c1a3d1',ink,1.5);rr(-21,9,42,7,3,'#b29ac1',ink,1.5);}
    if(kind==='boss'){ctx.save();ctx.translate(0,-24);path([[-15,0],[-17,-14],[-7,-8],[0,-19],[7,-8],[17,-14],[15,0]],'#e7ab5f',ink,1.5);ctx.restore();rr(-30,0,10,17,3,'#cfaa79',ink,1.5);rr(20,0,10,17,3,'#cfaa79',ink,1.5);}
    ctx.restore();
  }
  function drawPaperPlane(b){const a=Math.atan2(b.vy,b.vx);ctx.save();ctx.translate(b.x,b.y);ctx.rotate(a);path([[11,0],[-8,-7],[-4,0],[-8,7]],'#fffdf5','#d99573',1.5);line(-4,0,11,0,'#e6b99c',1);ctx.restore();}
  function renderMenu() {
    drawGround(true);
    // A bespoke oversized hero illustration, built from the same articulated robot as the game.
    ctx.save();ctx.translate(865,390);ctx.rotate(-.12);
    ctx.setLineDash([6,10]);ellipse(0,74,136,34,'#9bb77b16');ctx.setLineDash([]);
    circle(0,-5,153,'#fff9d536');circle(0,-5,126,null,'#bbcd9e5c',1.5);
    ctx.save();ctx.rotate(.15);drawRobot(0,Math.sin(visualTime*1.7)*4,-.35,3.25,'player',visualTime*.25);ctx.restore();
    ctx.save();ctx.translate(106,-74+Math.sin(visualTime*2)*5);ctx.rotate(.3);rr(-24,-17,48,34,6,'#fff9ec','#c9bc98',2);line(-24,-17,0,2,'#c9bc98',1.5);line(24,-17,0,2,'#c9bc98',1.5);ctx.restore();
    ctx.save();ctx.translate(-100,69);ctx.rotate(-.13);rr(-28,-23,56,46,6,'#efd2a1','#b9ad89',2);rr(-4,-23,8,46,0,'#f9e6b8');text('↑ ↑',-18,6,13,'#9c9279');ctx.restore();ctx.restore();
    for(const [x,y,s] of [[987,196,8],[745,218,6],[1059,403,7]]) {line(x-s,y,x+s,y,'#c7b875',2);line(x,y-s,x,y+s,'#c7b875',2);}
    ctx.save();ctx.translate(980,166);ctx.rotate(.12);rr(-48,-20,96,40,7,'#fffaf0','#d8d9ba',1.5);text('100% 元气',0,5,12,'#92a278','center');ctx.restore();
  }
  function renderWorld() {
    drawGround();
    for(const r of game.crates)drawCrate(r);drawDelivery();
    // Previous four seconds are visible as a subtle dotted route.
    if(game.history.length>10){ctx.beginPath();game.history.forEach((f,i)=>{if(i%8===0){if(i===0)ctx.moveTo(f.x,f.y);else ctx.lineTo(f.x,f.y);}});ctx.strokeStyle='#80bbaa35';ctx.lineWidth=3;ctx.setLineDash([3,8]);ctx.stroke();ctx.setLineDash([]);}
    for(const item of game.pickups){const y=item.y+Math.sin(visualTime*4+item.x)*3;ellipse(item.x,y+9,8,4,'#81996920');rr(item.x-6,y-8,12,15,3,'#b9d9a6','#90b283',1.5);rr(item.x-2,y-11,4,3,1,'#90b283');line(item.x-3,y-1,item.x+3,y-1,'#fdfbea',2);line(item.x,y-4,item.x,y+2,'#fdfbea',2);}
    for(const e of game.enemies)if(e.spawn>0){ctx.save();ctx.globalAlpha=prefs.softMotion?.8:.5+.3*Math.sin(visualTime*12);circle(e.x,e.y,e.r+15,null,'#c09b7c',2);ctx.setLineDash([4,5]);circle(e.x,e.y,e.r+25,null,'#cbb488',1);ctx.setLineDash([]);text('!',e.x,e.y+5,20,'#ba9970','center','700');ctx.restore();}
    for(const e of game.enemies)if(e.spawn<=0&&e.kind==='charger'&&e.phase==='warn'){ctx.save();ctx.translate(e.x,e.y);ctx.rotate(e.chargeAngle);ctx.fillStyle='#bd8fb224';ctx.fillRect(0,-e.r,270,e.r*2);ctx.setLineDash([8,8]);line(0,0,270,0,'#b286a9',2);ctx.setLineDash([]);ctx.restore();}
    for(const e of game.enemies)if(e.spawn<=0&&e.kind==='boss'&&e.fireCd<.6){circle(e.x,e.y,55+(prefs.softMotion?0:Math.sin(visualTime*15)*3),null,'#cf8e65aa',3);}
    for(const g of game.ghosts)if(g.delay<=0){drawRobot(g.x,g.y,g.angle,1,'player',visualTime,true);text('代班中',g.x,g.y-44,9,'#6fac95','center');}
    for(const e of [...game.enemies].sort((a,b)=>a.y-b.y))if(e.spawn<=0){drawRobot(e.x,e.y,e.phase==='charge'?e.chargeAngle:e.angle,e.kind==='boss'?1.8:e.kind==='charger'?1.13:1,e.kind,(e.travel||0)*.015,false,!prefs.softMotion&&e.hit>0);if(e.training)text('试驾靶机',e.x,e.y-50,10,'#8a9d75','center');if(e.hp<e.maxHp&&e.kind!=='boss'){rr(e.x-18,e.y-41,36,3,2,'#a59a8738');rr(e.x-18,e.y-41,36*clamp(e.hp/e.maxHp,0,1),3,2,e.kind==='hunter'?pink:e.kind==='shooter'?blue:purple);}}
    const p=game.player;if(p.dashTime>0){for(let i=1;i<=3;i++){ctx.globalAlpha=.16/i;drawRobot(p.x-p.dx*i*18,p.y-p.dy*i*18,p.angle,1,'player',0);ctx.globalAlpha=1;}}
    ctx.save();if(!prefs.softMotion&&p.invuln>0&&Math.floor(visualTime*18)%2===0&&p.dashTime<=0)ctx.globalAlpha=.5;drawRobot(p.x,p.y,p.angle,1,'player',(p.travel||0)*.015,false,false,playerRecoil);ctx.restore();
    if(p.invuln>0)circle(p.x,p.y,30,null,'#a4ca9770',1.5);text(game.delivery?.state==='carrying'?'派件中':'你',p.x,p.y+39,10,'#7c956a','center');if(game.delivery?.state==='carrying')drawParcel(p.x-21,p.y+12,.63);
    for(const b of game.bullets){if(b.plane){drawPaperPlane(b);continue;}if(b.friendly){const a=Math.atan2(b.vy,b.vx);line(b.x-Math.cos(a)*13,b.y-Math.sin(a)*13,b.x,b.y,b.ghost?'#75bfa9':'#eaa64b',5);circle(b.x,b.y,2.5,'#fff6c7');}else{circle(b.x+1,b.y+2,7,'#765c4420');circle(b.x,b.y,7,'#ed9786','#ac6159',1.6);circle(b.x,b.y,2.5,'#fff3ce');}}
    if(document.fullscreenElement){rr(78,76,212,62,12,'#fffef2dd','#cad4b8',1);text(`电量 ${Math.ceil(p.hp)} / ${p.maxHp}`,91,100,12,'#718c60');rr(91,113,180,7,4,'#dce5ce');rr(91,113,180*p.hp/p.maxHp,7,4,'#8ac5a3');text(`SPACE 冲刺 ${p.dashCd>0?p.dashCd.toFixed(1)+'s':'就绪'}     E 分身 ${p.echoCd>0?p.echoCd.toFixed(1)+'s':'就绪'}     Q 退件 ${p.pulseCd>0?p.pulseCd.toFixed(1)+'s':'就绪'}`,600,698,12,'#879c75','center');}
    // Cursor is drawn only during active combat.
    if(game.state==='playing'){ctx.save();ctx.translate(aim.x,aim.y);circle(0,0,10,null,'#788f7388',1);for(const [x,y]of [[-14,0],[14,0],[0,-14],[0,14]])line(x*.75,y*.75,x,y,'#728a67',1.5);circle(0,0,1.5,'#f1ad62');if(visualTime<hitUntil){for(const [x,y]of [[-1,-1],[1,-1],[-1,1],[1,1]])line(x*5,y*5,x*10,y*10,'#c58549',2.5);}ctx.restore();}
  }
  function drawEffects(dt){
    for(const p of particles){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=Math.exp(-dt*3);p.vy+=90*dt;ctx.save();ctx.globalAlpha=clamp(p.life/.2,0,1);ctx.translate(p.x,p.y);ctx.rotate(p.angle+p.life*3);rr(-p.size/2,-p.size/2,p.size,p.size,1,p.color);ctx.restore();}particles=particles.filter(p=>p.life>0);
    for(const r of rings){r.life-=dt;const age=1-r.life/r.max;ctx.globalAlpha=Math.max(0,1-age);circle(r.x,r.y,r.radius*(.15+age*.85),null,r.color,3*(1-age)+1);ctx.globalAlpha=1;}rings=rings.filter(r=>r.life>0);
    for(const f of floats){f.life-=dt;f.y-=18*dt;ctx.globalAlpha=clamp(f.life*2,0,1);text(f.label,f.x,f.y,13,f.color,'center','600');ctx.globalAlpha=1;}floats=floats.filter(f=>f.life>0);
  }
  function upgradeIcon(kind){const drawings={power:'<rect x="8" y="15" width="24" height="18" rx="5"/><path d="M32 20h13v8H32M15 15V8h10v7"/>',rapid:'<path d="M8 14h25M4 22h21M9 30h22"/><path d="m33 12 12 10-12 10"/>',split:'<path d="M6 22h19m0 0 18-14m-18 14h20M25 22l18 14"/><circle cx="25" cy="22" r="4"/>',health:'<rect x="10" y="10" width="30" height="26" rx="5"/><path d="M20 10V5h10v5M25 16v14m-7-7h14"/>',echo:'<rect x="7" y="7" width="25" height="25" rx="5"/><rect x="18" y="17" width="25" height="25" rx="5"/>',return:'<path d="m6 11 38 9-20 8-5 11zM6 11l18 17M35 36q12 1 12-8"/>',dash:'<path d="m8 9 14 13L8 35m15-26 14 13-14 13M41 11v22"/>',pierce:'<path d="M6 23h40m-9-9 10 9-10 9M20 9v28M28 9v28"/>',snack:'<rect x="12" y="8" width="28" height="31" rx="4"/><path d="M12 15h28M12 33h28"/><circle cx="26" cy="24" r="5"/>',blast:'<path d="m25 5 4 12 13-7-6 13 13 4-14 4 5 12-13-7-6 11-1-14-13 1 10-10-8-10 14 3z"/>'};return `<svg class="upgrade-icon" viewBox="0 0 54 48" fill="#f9e2ac" stroke="#a79f7a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${drawings[kind]}</svg>`;}
  function upgradePreview(id){
    const p=game.player,n=v=>Math.round(v),rate=v=>(1/v).toFixed(1),pct=v=>n(v*100)+'%';
    const values={power:`伤害 ${n(p.damage)} → ${n(p.damage*1.25)}`,rapid:`每秒 ${rate(p.fireRate)} → ${rate(p.fireRate*.83)} 发`,split:'单发 → 三路火力',health:`电量上限 ${p.maxHp} → ${p.maxHp+30} · 充满`,echo:`分身倍率 ${pct(p.echoDamage)} → ${pct(p.echoDamage+.35)}`,return:`退件半径 ${n(p.pulseRadius)} → ${n(p.pulseRadius*1.25)}`,dash:`移速 ${n(p.speed)} → ${n(p.speed*1.12)}`,pierce:`穿透 ${p.pierce} → ${p.pierce+1} 个`,snack:`每枚回血 ${4+p.healBonus} → ${7+p.healBonus}`,blast:'新增 · 击毁爆炸连锁'};return values[id];
  }
  function savePrefs(){try{localStorage.setItem('sunny-delivery-prefs',JSON.stringify(prefs));}catch{}}
  function soundLabel(){const quiet=muted||prefs.volume===0;$('sound').textContent=quiet?'声音 OFF':'声音 ON';$('sound').setAttribute('aria-label',quiet?'开启声音':'关闭声音');}
  function syncPrefs(){
    document.querySelectorAll('input[name=difficulty]').forEach(e=>e.checked=e.value===prefs.difficulty);
    for(const [id,k]of [['aim','assist'],['motion','softMotion'],['hints','hints'],['numbers','numbers']])$('setting-'+id).checked=prefs[k];
    $('setting-volume').value=Math.round(prefs.volume*100);$('volume-label').textContent=Math.round(prefs.volume*100)+'%';$('mode-label').textContent=prefs.difficulty==='cozy'?'悠闲派送':'标准派送';soundLabel();
  }
  function openSettings(){if(game.state==='playing')pause();settingsOpen=true;$('settings-screen').classList.remove('hidden');syncPrefs();document.querySelector('input[name=difficulty]:checked').focus({preventScroll:true});}
  function closeSettings(){settingsOpen=false;$('settings-screen').classList.add('hidden');(game.state==='paused'?$('resume'):$('preferences')).focus({preventScroll:true});}
  function notice(message,urgent=false){if(!urgent&&visualTime<toastUntil-.8)return;$('feedback-toast').textContent=message;$('feedback-toast').classList.remove('hidden');toastUntil=visualTime+1.5;}
  function useAbility(kind){if(game.state!=='playing'||settingsOpen)return;const p=game.player,cd=p[kind==='pulse'?'pulseCd':kind==='echo'?'echoCd':'dashCd'];if(cd>.01){notice(`正在准备，再等 ${cd.toFixed(1)} 秒`,true);return;}if(kind==='echo'&&game.history.length<15){notice('先移动或射击一下，分身会记住你的动作',true);return;}pressed[kind]=true;}
  function updateCoach(){
    const steps=[['move','WASD 移动；试着绕开箱子，找个舒服的位置。'],['fire','鼠标瞄准，按住左键开火。按 F 可以自动开火。'],['dash','按空格试试冲刺，短暂无敌，适合穿过弹幕。'],['echo','边走边开火，再按 E，让刚才的自己留下来代班。'],['pulse','等红色子弹靠近，按 Q，把它们折成纸飞机退回。']];
    const next=steps.find(([id])=>!tutorial.has(id));if(!next&&!prefs.coachDone){prefs.coachDone=true;savePrefs();notice('全部上手！按自己的节奏，快乐出发。');}
    const visible=game.state==='playing'&&game.wave===0&&prefs.hints&&(!prefs.coachDone||game.practice)&&Boolean(next)&&bannerTime<=0&&!settingsOpen;
    $('coach').classList.toggle('hidden',!visible);if(next)$('coach-copy').textContent=game.delivery?.state==='carrying'?'把包裹带回中央邮筒，进入圆圈就会自动签收。':next[1];
  }
  function syncScreen(){
    if(screenState===game.state)return;screenState=game.state;
    const screens={menu:'intro',paused:'pause-screen',upgrade:'upgrade-screen',dead:'end-screen',won:'end-screen'};
    for(const id of ['intro','pause-screen','upgrade-screen','end-screen'])$(id).classList.toggle('hidden',screens[game.state]!==id);
    $('leave-practice').classList.toggle('hidden',!game.practice);$('back-home').textContent=game.practice?'结束试驾，返回首页':'返回首页 · 下次从本站起点继续';$('restart-paused').textContent=game.practice?'重新开始试驾':'重新开始本次派送';
    $('pause').disabled=game.state!=='playing'&&game.state!=='paused';$('pause').setAttribute('aria-label',game.state==='paused'?'继续游戏':'暂停游戏');
    if(game.state==='upgrade'){$('upgrade-intro').textContent=`第 ${game.wave+1} 站已完成，恢复 20 点电量。下一站：${LEVELS[game.wave+1].name}`;const stats=game.stationStats;$('station-receipt').textContent=`${stats.delivered?'包裹妥投 · ':''}回收 ${stats.kills} 台 · 退回 ${stats.returned} 枚子弹 · 损失 ${Math.round(stats.damage)} 电量`;$('upgrade-cards').replaceChildren();game.options.forEach((u,i)=>{const b=document.createElement('button');b.innerHTML=`<span class="upgrade-number">福利 0${i+1} / 按 ${i+1}</span>${upgradeIcon(u.icon)}<span class="upgrade-name">${u.name}</span><span class="upgrade-effect">${upgradePreview(u.id)}</span><span class="upgrade-desc">${u.desc}</span>`;b.addEventListener('click',()=>choose(i));$('upgrade-cards').append(b);});$('upgrade-cards').firstElementChild?.focus({preventScroll:true});}
    if(game.state==='dead'||game.state==='won'){const won=game.state==='won';$('end-label').textContent=won?'12 / 12 · 全部妥投':'今日营业报告';$('end-title').textContent=won?'世界签收，准点下班。':'先充电，再出发。';$('end-copy').textContent=won?`十二个街区恢复晴天，额外妥投 ${game.deliveries} 件包裹。给过去的你，也发一份全勤奖。`:`你抵达了第 ${game.wave+1} 站「${game.level.name}」。改装已保留，可以从本站继续。`;$('final-score').textContent=game.score.toLocaleString();$('final-stats').textContent=`${game.kills} / ${formatTime(game.time)}`;$('best-line').textContent=`历史最高好评 ${best.toLocaleString()}`;$('retry').classList.toggle('hidden',won);firing=false;keys.clear();}
    if(game.state==='paused')$('resume').focus({preventScroll:true});
  }
  function formatTime(t){return `${Math.floor(t/60)}:${String(Math.floor(t%60)).padStart(2,'0')}`;}
  function hud(){const p=game.player;$('health-fill').style.width=`${p.hp/p.maxHp*100}%`;$('health-fill').style.background=p.hp<p.maxHp*.3?'#e39c85':'#8dc8ac';$('health-text').innerHTML=`${Math.ceil(p.hp)}<span> / ${p.maxHp}</span>`;$('wave-text').innerHTML=`${String(game.wave+1).padStart(2,'0')} <span>/ 12</span>`;$('score-text').textContent=String(game.score).padStart(6,'0');
    const dashMax=p.dashMax*(game.level.rule==='spring'?.48:1),echoMax=p.echoMax*(game.level.rule==='echo'?.5:1),pulseMax=p.pulseMax*(game.level.rule==='return'?.5:1);
    for(const [id,cd,max]of [['dash',p.dashCd,dashMax],['echo',p.echoCd,echoMax],['pulse',p.pulseCd,pulseMax]]){$(id+'-fill').style.width=`${clamp(1-cd/max,0,1)*100}%`;$('ability-'+id).classList.toggle('cooling',cd>0);$('ability-'+id).disabled=game.state!=='playing';$(id+'-status').textContent=cd>0?cd.toFixed(1)+'s':id==='echo'&&game.history.length<15&&game.state==='playing'?'记录中':'就绪';}
    updateCoach();updateDeliveryUI();
    $('battle-status').textContent=game.state==='menu'?'准备好快乐出发了吗？':`${game.enemies.length+game.spawnQueue.length} 台待回收 · ${formatTime(game.time)}${autoFire?' · 自动开火':''}`;
    if(game.practice){$('wave-text').innerHTML='试驾 <span>/ SAFE</span>';$('battle-status').textContent='不扣电 · 无时限 · 技能快速恢复';}else if(game.clearing>0&&game.delivery?.state==='carrying')$('battle-status').textContent=`清场完成 · 还有 ${game.clearing.toFixed(1)}s 可签收`;
    const boss=game.enemies.find(e=>e.kind==='boss');$('boss-hud').classList.toggle('hidden',!boss||game.state!=='playing');if(boss){$('boss-fill').style.width=`${boss.hp/boss.maxHp*100}%`;$('boss-name').textContent=game.wave===11?'总部总监 · 请结束加班':'分拣主管 · 说好的短会呢';}
  }
  function updateDeliveryUI(){const d=game.delivery,show=Boolean(d)&&game.state!=='menu';$('delivery-card').classList.toggle('hidden',!show);if(!show)return;const done=d.state==='done';$('delivery-card').classList.toggle('signed',done);$('delivery-title').textContent=done?'本单妥投，快乐送达':d.state==='carrying'?'包裹在车上，回中央签收':'顺路派件 · 找到橙色包裹';$('delivery-detail').textContent=done?'+350 积分 · +18 电量 · 冷却缩短':'奖励：回血 18 · 积分 350 · 技能加速';$('delivery-badge').textContent=done?'完成':d.state==='carrying'?'运输中':'可选';}
  function updateRoute(){const l=game.level;$('level-title').textContent=l.name;$('level-desc').textContent=l.desc;$('route-number').textContent=String(game.wave+1).padStart(2,'0');$('zone-label').textContent=`${l.place} / ${String(game.wave+1).padStart(2,'0')}`;$('seed-label').textContent=`派件编号 ${game.seed.toString(36).toUpperCase().slice(-6)}`;$('tip-text').textContent=l.tip;$('progress-text').textContent=`${game.completed} / 12`;$('objective').textContent=l.boss?'目标：回收主管与所有失控机甲':'目标：清理本站所有失控机甲';$('wave-steps').innerHTML=LEVELS.map((_,i)=>`<i class="${i<game.completed?'done':i===game.wave?'active':''}">${String(i+1).padStart(2,'0')}</i>`).join('');const counts={};game.upgrades.forEach(id=>counts[id]=(counts[id]||0)+1);$('installed-upgrades').innerHTML=game.upgrades.length?Object.entries(counts).map(([id,count])=>`<b>${UPGRADES.find(u=>u.id===id).name}${count>1?' ×'+count:''}</b>`).join(''):'<span>暂时原装，也很有力量。</span>';$('upgrade-count').textContent=`${game.upgrades.length} 件`;$('weapon-stats').textContent=`伤害 ${Math.round(game.player.damage)} · ${(1/game.player.fireRate).toFixed(1)} 发 / 秒`;if(game.practice){$('level-title').textContent='先试试，再出发';$('level-desc').textContent='这里不会扣电，没有时间限制。试试移动、射击、分身和退件，靶机会自动补充。';$('objective').textContent='随时点击右上角结束试驾';$('zone-label').textContent='驾驶员试驾区 / SAFE ZONE';}updateDeliveryUI();}
  function persistRun(){const data=game.saveData();if(!data)return;savedRun=data;try{localStorage.setItem('sunny-delivery-run',JSON.stringify(data));}catch{}}
  function resetInput(){keys.clear();firing=false;autoFire=false;pressed={dash:false,echo:false,pulse:false};particles=[];rings=[];floats=[];accumulator=0;bannerTime=0;toastUntil=0;playerRecoil=0;screenState='';}
  function home(){if(!game.practice&&game.state!=='won')persistRun();resetInput();game=new Game(Date.now(),prefs.difficulty);window.sunnyGame=game;settingsOpen=false;$('settings-screen').classList.add('hidden');$('continue').classList.toggle('hidden',!savedRun);if(savedRun)$('continue').textContent=`续送第 ${savedRun.wave+1} 站`;$('wave-banner').classList.add('hidden');updateRoute();hud();syncScreen();$('start').focus({preventScroll:true});}
  function practice(){resetInput();tutorial.clear();game=new Game(Date.now(),'cozy');window.sunnyGame=game;game.startPractice();updateRoute();hud();syncScreen();canvas.focus({preventScroll:true});}
  function start(){game=new Game(Date.now(),prefs.difficulty);tutorial.clear();window.sunnyGame=game;game.start();particles=[];rings=[];floats=[];keys.clear();pressed={dash:false,echo:false,pulse:false};autoFire=false;firing=false;accumulator=0;screenState='';updateRoute();syncScreen();canvas.focus({preventScroll:true});tone(580,.2,'triangle',.045,300);}
  function choose(i){if(game.choose(i)){keys.clear();firing=false;pressed={dash:false,echo:false,pulse:false};accumulator=0;updateRoute();syncScreen();canvas.focus({preventScroll:true});tone(750,.15,'triangle',.04,300);}}
  function pause(){if(game.state==='playing'||game.state==='paused'){game.togglePause();keys.clear();firing=false;pressed={dash:false,echo:false,pulse:false};accumulator=0;syncScreen();if(game.state==='playing')canvas.focus({preventScroll:true});}}
  $('continue').addEventListener('click',()=>{const restored=Game.restore(savedRun);if(!restored)return;game=restored;prefs.difficulty=game.mode;savePrefs();syncPrefs();window.sunnyGame=game;keys.clear();firing=false;autoFire=false;accumulator=0;screenState='';updateRoute();syncScreen();canvas.focus({preventScroll:true});});
  $('practice').addEventListener('click',practice);for(const id of ['leave-practice','back-home','end-home'])$(id).addEventListener('click',home);
  $('start').addEventListener('click',start);$('restart').addEventListener('click',start);$('restart-paused').addEventListener('click',()=>game.practice?practice():start());$('pause').addEventListener('click',pause);$('resume').addEventListener('click',pause);
  $('retry').addEventListener('click',()=>{game.retry();screenState='';keys.clear();firing=false;particles=[];rings=[];floats=[];accumulator=0;updateRoute();syncScreen();canvas.focus({preventScroll:true});});
  $('sound').addEventListener('click',()=>{if(prefs.volume===0){prefs.volume=.35;muted=false;}else muted=!muted;prefs.muted=muted;savePrefs();syncPrefs();if(!muted)tone(700,.13,'sine',.035,200);});
  for(const id of ['preferences','pause-preferences','mode-label'])$(id).addEventListener('click',openSettings);
  $('close-settings').addEventListener('click',closeSettings);
  document.querySelectorAll('input[name=difficulty]').forEach(e=>e.addEventListener('change',()=>{if(!e.checked)return;prefs.difficulty=e.value;game.mode=e.value;savePrefs();syncPrefs();if(game.checkpoint)persistRun();}));
  for(const [id,k]of [['aim','assist'],['motion','softMotion'],['hints','hints'],['numbers','numbers']])$('setting-'+id).addEventListener('change',e=>{prefs[k]=e.target.checked;if(k==='hints'&&prefs.hints){prefs.coachDone=false;tutorial.clear();}savePrefs();});
  $('setting-volume').addEventListener('input',e=>{prefs.volume=Number(e.target.value)/100;prefs.muted=false;muted=false;savePrefs();syncPrefs();});
  $('setting-volume').addEventListener('change',()=>tone(680,.1,'sine',.04,130));
  $('coach-dismiss').addEventListener('click',()=>{prefs.hints=false;savePrefs();$('coach').classList.add('hidden');canvas.focus({preventScroll:true});});
  for(const id of ['dash','echo','pulse'])$('ability-'+id).addEventListener('click',()=>{useAbility(id);canvas.focus({preventScroll:true});});
  document.querySelector('a.brand').addEventListener('click',e=>{e.preventDefault();if(game.state==='playing')pause();});
  $('fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('viewport').requestFullscreen();}catch{$('fullscreen').textContent='浏览器不支持';}});
  function pointer(e){const r=canvas.getBoundingClientRect();const scale=Math.min(r.width/W,r.height/H);const left=r.left+(r.width-W*scale)/2,top=r.top+(r.height-H*scale)/2;aim.x=clamp((e.clientX-left)/scale,0,W);aim.y=clamp((e.clientY-top)/scale,0,H);}
  canvas.addEventListener('pointermove',pointer);canvas.addEventListener('pointerdown',e=>{if(e.button===0&&game.state==='playing'){pointer(e);firing=true;canvas.focus({preventScroll:true});canvas.setPointerCapture(e.pointerId);}});window.addEventListener('pointerup',()=>firing=false);canvas.addEventListener('lostpointercapture',()=>firing=false);canvas.addEventListener('contextmenu',e=>e.preventDefault());
  window.addEventListener('keydown',e=>{
    if(settingsOpen){if(e.code==='Escape'){e.preventDefault();closeSettings();}else if(e.code==='Tab'){const list=[...$('settings-screen').querySelectorAll('button,input')].filter(el=>!el.disabled);const first=list[0],last=list.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}return;}
    if(['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName))return;
    const controls=['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowLeft','ArrowDown','ArrowRight','Space','KeyE','KeyQ','KeyF','Escape','KeyM','Digit1','Digit2','Digit3'];if(!controls.includes(e.code))return;if(game.state==='playing'||game.state==='upgrade'||e.code==='KeyM'||e.code==='Escape')e.preventDefault();if(e.repeat)return;
    if(e.code==='Escape'){pause();return;}if(e.code==='KeyM'){$('sound').click();return;}if(game.state==='upgrade'&&/^Digit[123]$/.test(e.code)){choose(Number(e.code.slice(-1))-1);return;}if(game.state!=='playing')return;
    keys.add(e.code);if(e.code==='Space')useAbility('dash');if(e.code==='KeyE')useAbility('echo');if(e.code==='KeyQ')useAbility('pulse');if(e.code==='KeyF'){autoFire=!autoFire;notice(autoFire?'自动开火已开启，移动鼠标瞄准即可':'已切回按住左键开火');}
  });
  window.addEventListener('keyup',e=>keys.delete(e.code));
  function backgroundPause(){keys.clear();firing=false;pressed={dash:false,echo:false,pulse:false};if(game.state==='playing'){game.togglePause();syncScreen();}lastTime=0;accumulator=0;}
  window.addEventListener('blur',backgroundPause);document.addEventListener('visibilitychange',()=>{if(document.hidden)backgroundPause();});
  function resize(){const r=canvas.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,2),scale=Math.min(r.width/W,r.height/H);const width=Math.round(W*scale*dpr),height=Math.round(H*scale*dpr);if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}}
  new ResizeObserver(resize).observe(canvas);resize();
  let hudTick=0,previousWave=-1,previousCompleted=-1;
  function frame(now){const dt=lastTime?Math.min((now-lastTime)/1000,.1):0;lastTime=now;visualTime+=dt;playerRecoil*=Math.exp(-dt*24);const active=game.state==='playing';
    if(active){accumulator+=dt;let steps=0;while(accumulator>=1/60&&steps<6){const mx=Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft')),my=Number(keys.has('KeyS')||keys.has('ArrowDown'))-Number(keys.has('KeyW')||keys.has('ArrowUp'));if(mx||my)tutorial.add('move');game.step(1/60,{mx,my,aimX:aim.x,aimY:aim.y,assistAim:prefs.assist,fire:firing||autoFire,...pressed});pressed={dash:false,echo:false,pulse:false};accumulator-=1/60;steps++;}}else accumulator=0;
    drainEvents();syncScreen();if(visualTime>=toastUntil)$('feedback-toast').classList.add('hidden');hudTick+=dt;if(hudTick>.08){hud();hudTick=0;}if(previousWave!==game.wave||previousCompleted!==game.completed){updateRoute();previousWave=game.wave;previousCompleted=game.completed;}
    bannerTime-=active?dt:0;if(bannerTime<=0||game.state!=='playing')$('wave-banner').classList.add('hidden');
    ctx.setTransform(canvas.width/W,0,0,canvas.height/H,0,0);ctx.clearRect(0,0,W,H);ctx.save();if(shake>0){if(!prefs.softMotion)ctx.translate((Math.random()-.5)*shake,(Math.random()-.5)*shake);shake=Math.max(0,shake-dt*20);}if(game.state==='menu')renderMenu();else renderWorld();drawEffects(game.state==='paused'||game.state==='upgrade'?0:dt);ctx.restore();requestAnimationFrame(frame);
  }
  window.sunnyGame=game;syncPrefs();updateRoute();hud();syncScreen();requestAnimationFrame(frame);
})();
