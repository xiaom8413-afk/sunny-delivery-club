'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { Game, LEVELS, segmentCircle, segmentBox } = require('../engine.js');
function arena(seed=47) { const g = new Game(seed); g.start(); g.spawnQueue = [{at:1e6,kind:'hunter'}]; g.events=[]; return g; }
function ticks(g,n,input={}) { for(let i=0;i<n;i++)g.step(1/60,input); }

test('每个站点地图可达，种子能重现布局',()=>{
  for(let seed=1;seed<=30;seed++)for(let wave=0;wave<12;wave++){
    const a = new Game(seed), b = new Game(seed);a.beginLevel(wave);b.beginLevel(wave);
    assert.deepEqual(a.crates,b.crates);assert.equal(a.blocked(a.player.x,a.player.y,a.player.r),false);
    for(let i=0;i<a.grid.length;i++)if(!a.grid[i])assert.ok(a.flow[i]>=0,`seed ${seed}, wave ${wave}, cell ${i}`);
  }
});
test('移动与冲刺不会穿透障碍或越界；斜向速度归一化',()=>{
  const g=arena();g.walls=[{x:0,y:0,w:1200,h:40},{x:700,y:0,w:40,h:760}];
  ticks(g,50,{mx:1,my:0,dash:true});assert.ok(g.player.x<=685.001);assert.equal(g.state,'playing');
  const a=arena(),b=arena();a.walls=[];b.walls=[];ticks(a,30,{mx:1});ticks(b,30,{mx:1,my:1});
  assert.ok(Math.abs(Math.hypot(a.player.x-600,a.player.y-380)-Math.hypot(b.player.x-600,b.player.y-380))<.001);
});
test('连续弹道检测命中最近目标，且墙壁先挡住子弹',()=>{
  assert.equal(segmentCircle(0,0,100,0,{x:50,y:0},10),.4);assert.equal(segmentBox(0,0,100,0,{x:25,y:-10,w:5,h:20}),.25);
  const g=arena();g.walls=[];g.enemies=[];g.spawn('hunter',{x:705,y:380});g.spawn('hunter',{x:755,y:380});
  for(const e of g.enemies){e.spawn=0;e.speed=0;}g.addBullet(600,380,0,true,100,{vx:12000,vy:0});g.step(1/60,{});
  assert.equal(g.kills,1);assert.equal(g.enemies.length,1);assert.ok(g.enemies[0].x>740);
  const h=arena();h.walls=[{x:670,y:300,w:10,h:160}];h.spawn('hunter',{x:705,y:380});h.enemies[0].spawn=0;h.enemies[0].speed=0;const hp=h.enemies[0].hp;
  h.addBullet(600,380,0,true,100,{vx:12000,vy:0});h.step(1/60);assert.equal(h.enemies[0].hp,hp);
});
test('分身重放真实轨迹和开火，冷却阻止重复调用',()=>{
  const g=arena();g.walls=[];ticks(g,120,{mx:.4,my:0,aimX:900,aimY:380,fire:true});const frames=g.history.map(f=>({...f}));g.echo();assert.equal(g.ghosts.length,1);g.echo();assert.equal(g.ghosts.length,1);
  g.step(1/60);assert.equal(g.ghosts[0].x,frames[0].x);assert.equal(g.ghosts[0].y,frames[0].y);assert.ok(g.bullets.some(b=>b.ghost));ticks(g,120);assert.equal(g.ghosts.length,0);
});
test('拒收只转换范围内敌弹，变成追踪纸飞机并计分',()=>{
  const g=arena();g.addBullet(650,380,Math.PI,false,12);g.addBullet(1000,380,Math.PI,false,12);g.addBullet(630,380,0,true,24);g.pulse();
  assert.equal(g.bullets[0].plane,true);assert.equal(g.bullets[0].friendly,true);assert.equal(g.bullets[1].friendly,false);assert.equal(g.bullets[2].plane,undefined);assert.equal(g.score,15);g.pulse();assert.equal(g.score,15);
});
test('特殊站点规则确实改变玩法',()=>{
  const wind=arena();wind.wave=1;wind.addBullet(600,200,0,true,1);wind.step(1/60);assert.ok(wind.bullets[0].vx>760);
  const belt=arena();belt.wave=4;belt.player.y=260;const x=belt.player.x;belt.step(1/60);assert.ok(belt.player.x>x);
  const twins=arena();twins.wave=6;ticks(twins,30,{fire:true});twins.echo();assert.equal(twins.ghosts.length,2);
  const hot=arena();hot.wave=7;hot.levelTime=4;hot.player.x=450;hot.player.invuln=0;hot.step(1/60);assert.equal(hot.player.hp,93);
  const spring=arena();spring.wave=8;spring.step(1/60,{dash:true,mx:1});assert.ok(spring.player.dashCd<.7);
  const returns=arena();returns.wave=2;returns.pulse();assert.equal(returns.player.pulseCd,3.5);
});
test('暂停冻结模拟；失败重试恢复站点、装备和基线分数',()=>{
  const g=arena();g.upgrades=['power'];g.player.damage=30;g.score=123;g.beginLevel(4);const time=g.time;g.togglePause();ticks(g,100,{mx:1,fire:true});assert.equal(g.time,time);assert.equal(g.player.x,600);g.togglePause();
  g.score=987;g.player.hp=1;g.player.invuln=0;g.damagePlayer(10);assert.equal(g.state,'dead');g.retry();assert.equal(g.state,'playing');assert.equal(g.wave,4);assert.equal(g.score,123);assert.equal(g.player.damage,30);assert.equal(g.player.hp,g.player.maxHp);assert.deepEqual(g.upgrades,['power']);
});
test('12 站从清场、三选一改装到胜利形成闭环',()=>{
  const g=new Game(71);g.start();
  for(let wave=0;wave<12;wave++){
    assert.equal(g.wave,wave);assert.equal(g.level,LEVELS[wave]);g.spawnQueue=[];g.enemies=[];ticks(g,90);
    if(wave<11){assert.equal(g.state,'upgrade');assert.equal(new Set(g.options.map(u=>u.id)).size,3);assert.equal(g.choose(0),true);}else assert.equal(g.state,'won');
  }
  assert.equal(g.completed,12);assert.equal(g.upgrades.length,11);assert.ok(g.score>4800);
});
test('对象数量设上限，持续模拟无 NaN、越界或无限增长',()=>{
  const g=arena();g.player.maxHp=g.player.hp=1e6;
  for(let i=0;i<100;i++)g.spawn(i%2?'shooter':'hunter');assert.equal(g.enemies.length,40);
  for(let i=0;i<600;i++)g.addBullet(600,380,0,false,1);assert.equal(g.bullets.length,320);
  for(let i=0;i<3600;i++){const a=i*.011;g.step(1/60,{mx:Math.cos(a),my:Math.sin(a),aimX:600+300*Math.cos(a+2),aimY:380+200*Math.sin(a+2),fire:true,dash:i%100===0,echo:i%480===0,pulse:i%420===0});g.events=[];assert.ok(Number.isFinite(g.player.x)&&Number.isFinite(g.player.hp));assert.ok(g.bullets.length<=320&&g.enemies.length<=40&&g.history.length<=240);}
});

test('大型首领与普通敌人均能绕过箱角抵达不同方位',()=>{
  for(let seed=1;seed<=12;seed++)for(const kind of ['hunter','boss'])for(const [px,py,ex,ey] of [[600,380,100,100],[800,100,100,100],[150,500,1000,100],[1050,660,140,120]]){
    const g=arena(seed);g.player.x=px;g.player.y=py;g.player.hp=g.player.maxHp=1e8;g.spawn(kind,{x:ex,y:ey});const e=g.enemies[0];e.spawn=0;e.fireCd=1e8;let minimum=Infinity;
    for(let i=0;i<2400;i++){g.step(1/60);minimum=Math.min(minimum,Math.hypot(e.x-px,e.y-py));g.events=[];}
    assert.ok(minimum<(kind==='boss'?320:60),`${seed} ${kind} stuck: ${minimum}`);
  }
});
test('存档还原装备、路线和分数，损坏存档不会启动游戏',()=>{
  const g=arena();g.upgrades=['power','health','echo'];for(const id of g.upgrades)require('../engine.js').UPGRADES.find(u=>u.id===id).apply(g.player);g.score=2300;g.kills=29;g.time=90;g.beginLevel(3);
  const data=JSON.parse(JSON.stringify(g.saveData())),r=Game.restore(data);assert.equal(r.wave,3);assert.equal(r.completed,3);assert.equal(r.score,2300);assert.equal(r.player.damage,g.player.damage);assert.equal(r.player.maxHp,g.player.maxHp);assert.deepEqual(r.crates,g.crates);assert.deepEqual(r.upgrades,g.upgrades);
  assert.equal(Game.restore(null),null);assert.equal(Game.restore({...data,wave:30}),null);assert.equal(Game.restore({...data,upgrades:['bad','power','power']}),null);assert.equal(Game.restore({...data,time:NaN}),null);
});

test('完整战斗模拟：真实弹道回收全部 12 站敌机和两位首领',()=>{
  const g=new Game(20260922);g.start();let bossKills=0;
  for(let wave=0;wave<12;wave++){
    // Protect the stationary pilot: this checks actual combat progression, not bot skill.
    g.player.invuln=1e6;
    for(let i=0;i<7200&&g.state==='playing';i++){
      const target=g.enemies.filter(e=>e.spawn<=0&&g.visible(g.player,e)).sort((a,b)=>Math.hypot(a.x-g.player.x,a.y-g.player.y)-Math.hypot(b.x-g.player.x,b.y-g.player.y))[0];
      g.step(1/60,{fire:Boolean(target),aimX:target?.x,aimY:target?.y,echo:i%480===300,pulse:i%420===200});
      bossKills+=g.events.filter(e=>e.type==='kill'&&e.kind==='boss').length;g.events=[];
    }
    assert.equal(g.state,wave===11?'won':'upgrade',`wave ${wave+1}: ${g.enemies.map(e=>e.kind+':'+Math.ceil(e.hp)).join(',')}`);
    if(wave<11){const pick=g.options.findIndex(u=>['power','split','rapid','echo'].includes(u.id));g.choose(Math.max(0,pick));}
  }
  assert.equal(bossKills,2);assert.equal(g.completed,12);assert.ok(g.kills>=172);
});

test('悠闲模式降低伤害与弹速，并随检查点保存；旧存档继续标准模式',()=>{
  const standard=new Game(9),cozy=new Game(9,'cozy');standard.start();cozy.start();
  for(const g of [standard,cozy]){g.player.invuln=0;g.damagePlayer(20);g.addBullet(100,100,0,false,10,{vx:220,vy:0});}
  assert.equal(standard.player.hp,80);assert.equal(cozy.player.hp,87);assert.equal(cozy.stationStats.damage,13);
  assert.equal(cozy.bullets[0].vx,187);assert.equal(standard.bullets[0].vx,220);assert.equal(Game.restore(cozy.saveData()).mode,'cozy');
  const old=standard.saveData();delete old.mode;assert.equal(Game.restore(old).mode,'standard');
});
test('辅助瞄准只吸附准星附近可见目标，不越过墙壁或转向远处',()=>{
  const g=arena();g.walls=[];g.spawn('hunter',{x:850,y:390});g.enemies[0].spawn=0;g.enemies[0].speed=0;
  g.step(1/60,{aimX:850,aimY:405,assistAim:true});assert.ok(Math.abs(g.player.angle-Math.atan2(10,250))<.001);
  g.step(1/60,{aimX:850,aimY:500,assistAim:true});assert.ok(Math.abs(g.player.angle-Math.atan2(120,250))<.001);
  g.walls=[{x:730,y:300,w:20,h:160}];g.step(1/60,{aimX:850,aimY:405,assistAim:true});assert.ok(Math.abs(g.player.angle-Math.atan2(25,250))<.001);
});
test('分批出场限制战场密度，等待中的敌机不会被吞掉',()=>{
  const g=new Game(12,'cozy');g.start();g.spawnQueue=Array.from({length:20},()=>({at:0,kind:'hunter'}));g.player.invuln=1e6;
  ticks(g,600);assert.equal(g.enemies.length,9);assert.equal(g.spawnQueue.length,11);
  g.enemies.pop();ticks(g,20);assert.equal(g.enemies.length,9);assert.equal(g.spawnQueue.length,10);
});

test('十二套街区布局各不相同，包裹位置与大型机甲区域均可达',()=>{
  const signatures=new Set();
  for(let wave=0;wave<12;wave++)for(let seed=1;seed<=8;seed++){
    const g=new Game(seed);g.beginLevel(wave);if(seed===1)signatures.add(JSON.stringify(g.crates));
    for(let i=0;i<g.gridLarge.length;i++)if(!g.gridLarge[i])assert.ok(g.flowLarge[i]>=0);
    if(g.delivery){assert.equal(g.blocked(g.delivery.x,g.delivery.y,18),false);assert.ok(g.flow[g.cell(g.delivery.x,g.delivery.y)]>=0);}else assert.ok(g.level.boss);
  }
  assert.equal(signatures.size,12);
});
test('可选派件完成后补电、加分、加速技能，只能领取一次',()=>{
  const g=arena();g.player.hp=40;Object.assign(g.player,{x:g.delivery.x,y:g.delivery.y});g.step(1/60);assert.equal(g.delivery.state,'carrying');
  Object.assign(g.player,{x:600,y:380,pulseCd:5,echoCd:6});ticks(g,42);assert.equal(g.delivery.state,'done');assert.equal(g.deliveries,1);assert.equal(g.score,350);assert.equal(g.player.hp,58);assert.ok(g.player.echoCd<2.4&&g.player.pulseCd<1.4);assert.equal(g.stationStats.delivered,true);
  ticks(g,80);assert.equal(g.score,350);assert.equal(g.deliveries,1);
  g.player.invuln=0;g.damagePlayer(1000);g.retry();assert.equal(g.score,0);assert.equal(g.deliveries,0);assert.equal(g.delivery.state,'waiting');
});
test('携带包裹清场后留出签收时间，完成后自动进入改装',()=>{
  const g=arena();g.spawnQueue=[];Object.assign(g.player,{x:g.delivery.x,y:g.delivery.y});g.step(1/60);assert.ok(g.clearing>5);ticks(g,100);assert.equal(g.state,'playing');
  Object.assign(g.player,{x:600,y:380});ticks(g,140);assert.equal(g.delivery.state,'done');assert.equal(g.state,'upgrade');
});
test('试驾免伤、补充靶机、缩短技能冷却，不产生正式存档或通关',()=>{
  const g=new Game(42);g.startPractice();assert.equal(g.practice,true);assert.equal(g.delivery,null);assert.equal(g.saveData(),null);assert.equal(g.player.echoMax,2);
  g.player.invuln=0;g.damagePlayer(1e6);assert.equal(g.player.hp,100);ticks(g,200);assert.equal(g.enemies.length,2);
  for(const e of g.enemies)g.hitEnemy(e,1e6);ticks(g,220);assert.equal(g.enemies.length,2);assert.equal(g.state,'playing');assert.equal(g.completed,0);assert.equal(g.saveData(),null);
});
test('各街区的猎犬、破城者与首领都能绕行到达玩家附近',()=>{
  for(let seed=1;seed<=3;seed++)for(let wave=0;wave<12;wave++)for(const kind of ['hunter','charger','boss']){
    const g=new Game(seed);g.beginLevel(wave);g.spawnQueue=[{at:1e6,kind:'hunter'}];g.player.hp=g.player.maxHp=1e8;g.player.x=1050;g.player.y=660;g.spawn(kind,{x:100,y:100});const e=g.enemies[0];e.spawn=0;e.fireCd=1e6;e.summon=1e6;let best=Infinity;
    for(let i=0;i<2400;i++){g.step(1/60);best=Math.min(best,Math.hypot(e.x-g.player.x,e.y-g.player.y));g.events=[];}
    assert.ok(best<(kind==='boss'?320:75),`wave=${wave+1} seed=${seed} kind=${kind} nearest=${best}`);
  }
});
