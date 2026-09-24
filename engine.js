/* Deterministic simulation. No DOM, network, build step or third-party runtime. */
(function (root) {
  'use strict';
  const W = 1200, H = 760, TILE = 40, COLS = 30, ROWS = 19, TAU = Math.PI * 2;
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  function rng(seed) { let s = seed >>> 0; return () => { s += 0x6D2B79F5; let t = Math.imul(s ^ s >>> 15, 1 | s); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const LEVELS = [
    { name: '第一单，别紧张', place: '阳光广场', rule: 'normal', count: 7, desc: '普通街区，先熟悉操作。按 E 叫出过去的你，按 Q 把附近子弹退回去。', tip: '冲刺时短暂无敌。遇到围攻，空格先溜。', color: '#e9f0d7' },
    { name: '风把快递吹歪了', place: '吹风海岸', rule: 'wind', count: 10, desc: '海风会把双方子弹向右吹。借一点风，绕过箱子命中敌人。', tip: '风力只影响子弹，纸飞机仍会追踪目标。', color: '#dfefe3' },
    { name: '无理由退件日', place: '退件服务中心', rule: 'return', count: 12, desc: '哨兵大量出没！退件冷却减半，范围扩大，敌人的弹幕就是你的弹药。', tip: '等子弹靠近再按 Q，一次退回一整片。', color: '#f1e8d9' },
    { name: '昨天的我真能干', place: '复印机公园', rule: 'echo', count: 13, desc: '分身冷却减半。先边走边射击，再按 E，让过去的自己继续加班。', tip: '分身重复真实轨迹。先绕到敌人侧面再复制。', color: '#e4ecdf' },
    { name: '传送带不想下班', place: '自动分拣站', rule: 'belt', count: 15, desc: '两条传送带方向相反，会推动站在上面的所有机甲。', tip: '传送带也会推动敌人。沿着传送方向走更快。', color: '#eeeccc' },
    { name: '主管说开个短会', place: '第一会议室', rule: 'boss', count: 6, boss: true, desc: '分拣主管到了。躲开红色预警，把环形弹幕整片退回，争取准时下班。', tip: '首领闪烁时即将发射。退件能消除附近弹幕。', color: '#e9e2d3' },
    { name: '一个我不够用了', place: '双倍快乐街', rule: 'twins', count: 17, desc: '每次按 E 会出现两位分身，第二位稍迟到场。三人份的快乐！', tip: '自动开火按 F 切换，分身也会记住开火。', color: '#e4ecd2' },
    { name: '地板有点烫脚', place: '烘焙配送站', rule: 'hot', count: 18, desc: '烘焙区周期性升温。条纹闪烁是预警，亮红色地面会持续扣电。', tip: '地面变红前离开条纹区。冲刺可穿过热区。', color: '#f1e3d2' },
    { name: '溜得快也是业绩', place: '弹簧试验场', rule: 'spring', count: 20, desc: '冲刺冷却缩短，落点产生冲击波。把走位变成攻击！', tip: '冲刺结束的冲击能击退并伤害附近敌人。', color: '#e0e9e8' },
    { name: '包裹自己飞过来', place: '磁力仓库', rule: 'magnet', count: 21, desc: '回收电池从更远处飞来，每枚额外补电并缩短技能冷却。', tip: '击毁敌人掉落电池。保持移动，把补给收进来。', color: '#e9e4ef' },
    { name: '全员加急，谢谢', place: '跨区快线', rule: 'rush', count: 23, desc: '敌机加速，但你的武器射速也大幅提升。下班前的最后冲刺！', tip: '高射速会被分身完整复刻。一次 E 就是双份火力。', color: '#f0eccf' },
    { name: '总监的最后一单', place: '晴空总部', rule: 'final', count: 10, boss: true, desc: '总部总监有两阶段弹幕与召援。用分身交叉火力和退件结束加班！', tip: '总监半血进入二阶段。留好 Q，退回密集弹幕。', color: '#e0ece0' }
  ];
  const UPGRADES = [
    { id: 'power', name: '大力出奇迹', desc: '每发伤害 +25%。打孔机也有一个重炮梦。', icon: 'power', apply: p => p.damage *= 1.25 },
    { id: 'rapid', name: '手速不讲道理', desc: '射速 +20%。咔哒咔哒，更快一点。', icon: 'rapid', apply: p => p.fireRate *= .83 },
    { id: 'split', name: '这单一式三份', desc: '额外两发散射，每发造成主弹 42% 的伤害。', icon: 'split', max: 1, apply: p => p.split = true },
    { id: 'health', name: '超大号充电宝', desc: '电量上限 +30，并立即充满。', icon: 'health', apply: p => { p.maxHp += 30; p.hp = p.maxHp; } },
    { id: 'echo', name: '优秀代班员工', desc: '分身伤害 +35%，冷却缩短 15%。', icon: 'echo', apply: p => { p.echoDamage += .35; p.echoMax *= .85; } },
    { id: 'return', name: '退件专业户', desc: '退件范围 +25%，纸飞机伤害 +40%。', icon: 'return', apply: p => { p.pulseRadius *= 1.25; p.returnDamage *= 1.4; } },
    { id: 'dash', name: '带薪溜得飞快', desc: '移动速度 +12%，冲刺冷却缩短 18%。', icon: 'dash', apply: p => { p.speed *= 1.12; p.dashMax *= .82; } },
    { id: 'pierce', name: '打通上下游', desc: '子弹多穿透一个目标。纸箱墙依然会挡住子弹。', icon: 'pierce', apply: p => p.pierce++ },
    { id: 'snack', name: '随身小零食', desc: '拾取电池额外恢复 3 点电量。', icon: 'snack', apply: p => p.healBonus += 3 },
    { id: 'blast', name: '最后还要放个炮', desc: '击毁敌机产生小爆炸，伤害附近敌人。', icon: 'blast', max: 1, apply: p => p.blast = true }
  ];
  function segmentBox(x, y, dx, dy, r, pad = 0) {
    let lo = 0, hi = 1;
    for (const [origin, delta, min, max] of [[x, dx, r.x - pad, r.x + r.w + pad], [y, dy, r.y - pad, r.y + r.h + pad]]) {
      if (Math.abs(delta) < 1e-8) { if (origin < min || origin > max) return Infinity; }
      else { let a = (min - origin) / delta, b = (max - origin) / delta; if (a > b) [a, b] = [b, a]; lo = Math.max(lo, a); hi = Math.min(hi, b); if (lo > hi) return Infinity; }
    }
    return lo;
  }
  function segmentCircle(x, y, dx, dy, c, radius) {
    const ox = x - c.x, oy = y - c.y, a = dx * dx + dy * dy;
    const k = ox * ox + oy * oy - radius * radius;
    if (k <= 0) return 0;
    if (!a) return Infinity;
    const b = ox * dx + oy * dy, d = b * b - a * k;
    if (d < 0) return Infinity;
    const t = (-b - Math.sqrt(d)) / a;
    return t >= 0 && t <= 1 ? t : Infinity;
  }
  class Game {
    constructor(seed = Date.now(), mode = 'standard') {
      this.mode = mode === 'cozy' ? 'cozy' : 'standard'; this.practice = false; this.delivery = null; this.deliveries = 0;
      this.seed = seed >>> 0; this.random = rng(this.seed); this.state = 'menu'; this.time = 0; this.wave = 0;
      this.player = this.makePlayer(); this.score = 0; this.kills = 0; this.completed = 0; this.upgrades = []; this.nextId = 1;
      this.events = []; this.enemies = []; this.bullets = []; this.pickups = []; this.ghosts = []; this.history = []; this.spawnQueue = [];
      this.flow = new Int16Array(COLS * ROWS); this.flowLarge = new Int16Array(COLS * ROWS); this.generateMap(); this.options = []; this.levelTime = 0;
    }
    makePlayer() { return { x: 600, y: 380, r: 15, hp: 100, maxHp: 100, angle: 0, speed: 245, damage: 24, fireRate: .16, fireCd: 0, dashCd: 0, dashTime: 0, dashMax: 1.25, dx: 1, dy: 0, invuln: 0, echoCd: 0, echoMax: 8, echoDamage: .75, pulseCd: 0, pulseMax: 7, pulseRadius: 220, returnDamage: 48, pierce: 0, healBonus: 0, split: false, blast: false }; }
    get level() { return LEVELS[this.wave]; }
    emit(type, data = {}) { if (this.events.length < 250) this.events.push({ type, ...data }); }
    cell(x, y) { return clamp(Math.floor(y / TILE), 0, ROWS - 1) * COLS + clamp(Math.floor(x / TILE), 0, COLS - 1); }
    generateMap() {
      const random = rng(this.seed ^ Math.imul(this.wave + 1, 0x45d9f3b));
      // Authored street plans, with small seeded shifts; every layout is checked for both body sizes.
      const plans = [
        [[6,4,3,2],[22,4,3,2],[6,13,3,2],[22,13,3,2],[12,3,2,2],[16,14,2,2]],
        [[8,4,2,4],[20,4,2,4],[8,12,2,3],[20,12,2,3],[14,3,2,2]],
        [[6,4,5,2],[19,4,5,2],[6,13,5,2],[19,13,5,2]],
        [[7,8,2,3],[21,8,2,3],[12,4,3,2],[15,13,3,2],[5,4,2,2],[23,13,2,2]],
        [[7,3,4,2],[20,3,4,2],[7,14,4,2],[20,14,4,2],[6,8,3,3],[21,8,3,3]],
        [[7,5,2,2],[21,5,2,2],[7,12,2,2],[21,12,2,2]],
        [[6,5,2,4],[22,10,2,4],[13,3,4,2],[13,14,4,2],[22,4,2,2],[6,13,2,2]],
        [[6,4,3,2],[22,4,3,2],[6,13,3,2],[22,13,3,2],[14,3,2,2],[14,14,2,2]],
        [[6,4,2,2],[12,5,2,2],[22,4,2,2],[6,13,2,2],[18,13,2,2],[23,11,2,2]],
        [[5,7,3,3],[22,7,3,3],[10,3,4,2],[16,14,4,2],[7,13,2,2],[23,13,2,2]],
        [[6,4,4,2],[19,6,4,2],[6,11,4,2],[19,14,4,2],[14,3,2,2],[14,14,2,2]],
        [[7,5,2,2],[21,5,2,2],[7,12,2,2],[21,12,2,2],[14,3,2,2],[14,14,2,2]]
      ];
      const border = [{x:0,y:0,w:W,h:40},{x:0,y:H-40,w:W,h:40},{x:0,y:40,w:40,h:H-80},{x:W-40,y:40,w:40,h:H-80}];
      this.crates = plans[this.wave].map(([x,y,w,h],i)=>({x:(x+Math.floor(random()*3)-1)*TILE,y:y*TILE,w:w*TILE,h:h*TILE,variant:i%3}));
      // Reserve the central delivery zone. Remove a late prop if it would isolate a walkable pocket.
      this.crates=this.crates.filter(r=>!(600>r.x-70&&600<r.x+r.w+70&&380>r.y-70&&380<r.y+r.h+70));
      while(true){
        this.walls=[...border,...this.crates];this.grid=new Uint8Array(COLS*ROWS);
        for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++)if(this.walls.some(r=>x*TILE>=r.x&&x*TILE<r.x+r.w&&y*TILE>=r.y&&y*TILE<r.y+r.h))this.grid[y*COLS+x]=1;
        this.gridLarge=Uint8Array.from(this.grid,(_,i)=>this.blocked((i%COLS+.5)*TILE,(Math.floor(i/COLS)+.5)*TILE,31)?1:0);
        this.updateFlow();
        if((!this.grid.some((v,i)=>!v&&this.flow[i]<0)&&!this.gridLarge.some((v,i)=>!v&&this.flowLarge[i]<0))||!this.crates.length)break;
        this.crates.pop();
      }
      this.flowTimer=0;
    }
    updateFlow() {
      for (const [field, grid] of [[this.flow, this.grid], [this.flowLarge, this.gridLarge]]) {
        field.fill(-1); let start = this.cell(this.player.x, this.player.y);
        if (grid[start]) { let nearest = Infinity; for (let i = 0; i < grid.length; i++) if (!grid[i]) { const d = Math.hypot((i % COLS + .5) * TILE - this.player.x, (Math.floor(i / COLS) + .5) * TILE - this.player.y); if (d < nearest) { nearest = d; start = i; } } }
        const q = [start]; field[start] = 0;
        for (let i = 0; i < q.length; i++) { const c = q[i], x = c % COLS; for (const n of [x > 0 ? c - 1 : -1, x < COLS - 1 ? c + 1 : -1, c - COLS, c + COLS]) if (n >= 0 && n < grid.length && !grid[n] && field[n] < 0) { field[n] = field[c] + 1; q.push(n); } }
      }
    }
    start() { this.state = 'playing'; this.beginLevel(0); }
    beginLevel(index, retry = false) {
      this.stationStats = { kills: 0, returned: 0, damage: 0, delivered: false }; this.spawnDelay = 0;
      this.wave = index; this.state = 'playing'; this.levelTime = 0; this.clearing = -1; this.bullets = []; this.enemies = []; this.ghosts = []; this.history = []; this.pickups = []; this.spawnQueue = []; this.events = [];
      const p = this.player; Object.assign(p, { x: 600, y: 380, dashCd: 0, dashTime: 0, echoCd: 0, pulseCd: 0, invuln: 2, fireCd: 0 });
      this.generateMap(); this.createDelivery();
      if (!retry) this.checkpoint = { player: { ...p }, score: this.score, kills: this.kills, upgrades: [...this.upgrades], time: this.time, deliveries: this.deliveries };
      const level = this.level;
      if (level.boss) this.spawnQueue.push({ at: 1, kind: 'boss' });
      for (let i = 0; i < level.count; i++) { let kind = 'hunter'; if (index > 0 && i % 3 === 1) kind = 'shooter'; if (index > 2 && i % 4 === 3) kind = 'charger'; if (level.rule === 'return' && i % 4 !== 0) kind = 'shooter'; this.spawnQueue.push({ at: 1.5 + Math.floor(i / 3) * (level.boss ? 3 : 2.4) + (i % 3) * .3, kind }); }
      this.spawnQueue.sort((a, b) => a.at - b.at); this.emit('level', { wave: index });
    }
    retry() { if (this.state !== 'dead') return; Object.assign(this.player, this.checkpoint.player, { hp: this.checkpoint.player.maxHp }); this.score = this.checkpoint.score; this.kills = this.checkpoint.kills; this.upgrades = [...this.checkpoint.upgrades]; this.deliveries = this.checkpoint.deliveries || 0; this.beginLevel(this.wave, true); }
    saveData() { if (!this.checkpoint || this.practice) return null; const c = this.checkpoint; return { version: 1, mode: this.mode, seed: this.seed, wave: this.wave, hp: c.player.hp, score: c.score, kills: c.kills, upgrades: [...c.upgrades], time: c.time, deliveries: c.deliveries || 0 }; }
    static restore(data) {
      if (!data || data.version !== 1 || !Number.isInteger(data.seed) || !Number.isInteger(data.wave) || data.wave < 0 || data.wave >= LEVELS.length || !Array.isArray(data.upgrades) || data.upgrades.length !== data.wave) return null;
      if (![data.hp, data.score, data.kills, data.time].every(n => Number.isFinite(n) && n >= 0)) return null;
      const g = new Game(data.seed, data.mode);
      for (const id of data.upgrades) { const u = UPGRADES.find(item => item.id === id); if (!u || (u.max && g.upgrades.filter(item => item === id).length >= u.max)) return null; u.apply(g.player); g.upgrades.push(id); }
      g.player.hp = clamp(data.hp, 1, g.player.maxHp); g.score = Math.floor(data.score); g.kills = Math.floor(data.kills); g.time = data.time; g.completed = data.wave; g.deliveries = Number.isInteger(data.deliveries) ? clamp(data.deliveries,0,data.wave) : 0; g.beginLevel(data.wave); return g;
    }
    startPractice() {
      this.practice=true;this.start();this.spawnQueue=[];this.delivery=null;this.trainingRespawn=0;
      Object.assign(this.player,{dashMax:.7,echoMax:2,pulseMax:2});this.events=[];this.emit('practice');
    }
    createDelivery() {
      if(this.practice||this.level.boss){this.delivery=null;return;}
      const locations=[{x:120,y:160},{x:1080,y:600},{x:120,y:600},{x:1080,y:160}];
      const point=locations[(this.seed+this.wave)%locations.length];
      this.delivery={...point,drop:{x:600,y:380},state:'waiting',progress:0};
    }
    updateDelivery(dt) {
      const d=this.delivery,p=this.player;if(!d||d.state==='done')return;
      if(d.state==='waiting'&&dist(p,d)<36){d.state='carrying';this.emit('parcel',{x:p.x,y:p.y});}
      if(d.state==='carrying'){
        if(dist(p,d.drop)<65){d.progress=Math.min(1,d.progress+dt/.65);if(d.progress>=1){d.state='done';this.deliveries++;this.stationStats.delivered=true;this.score+=350;p.hp=Math.min(p.maxHp,p.hp+18);p.echoCd=Math.max(0,p.echoCd-3);p.pulseCd=Math.max(0,p.pulseCd-3);p.invuln=Math.max(p.invuln,1);this.emit('delivered',{x:d.drop.x,y:d.drop.y});}}
        else d.progress=Math.max(0,d.progress-dt*.7);
      }
    }
    togglePause() { if (this.state === 'playing') this.state = 'paused'; else if (this.state === 'paused') this.state = 'playing'; }
    choose(index) { if (this.state !== 'upgrade' || !this.options[index]) return false; const u = this.options[index]; u.apply(this.player); this.upgrades.push(u.id); this.beginLevel(this.wave + 1); return true; }
    spawn(kind, position) {
      if (this.enemies.length >= 40) return;
      let x = 120, y = 120;
      if (position) { x = position.x; y = position.y; }
      else for (let i = 0; i < 60; i++) { const side = Math.floor(this.random() * 4); x = side < 2 ? (side === 0 ? 100 : 1100) : 100 + this.random() * 1000; y = side >= 2 ? (side === 2 ? 100 : 660) : 100 + this.random() * 560; if (!this.blocked(x, y, 31) && Math.hypot(x - this.player.x, y - this.player.y) > 290) break; }
      const scaling = 1 + this.wave * .1;
      const base = kind === 'hunter' ? [43, 99, 15] : kind === 'shooter' ? [64, 70, 17] : kind === 'charger' ? [115, 78, 20] : [this.wave === 11 ? 2700 : 1350, 46, 29];
      const hp = kind === 'boss' ? base[0] : base[0] * scaling;
      this.enemies.push({ id: this.nextId++, kind, x, y, r: base[2], hp, maxHp: hp, speed: base[1] * (this.level.rule === 'rush' ? 1.32 : 1) * (this.mode === 'cozy' ? .9 : 1), angle: 0, spawn: .85, fireCd: 1.1 + this.random(), phase: 'walk', phaseTime: 0, hit: 0, wobble: this.random() * TAU, summon: 10 });
    }
    blocked(x, y, radius) { return this.walls.some(r => x > r.x - radius && x < r.x + r.w + radius && y > r.y - radius && y < r.y + r.h + radius); }
    move(e, vx, vy, dt) {
      const beforeX=e.x,beforeY=e.y;
      // Axis resolution is stable because the fixed step limits maximum motion to < half a tile.
      e.x += vx * dt;
      for (const r of this.walls) if (e.x + e.r > r.x + 1e-6 && e.x - e.r < r.x + r.w - 1e-6 && e.y + e.r > r.y + 1e-6 && e.y - e.r < r.y + r.h - 1e-6) e.x = vx > 0 ? r.x - e.r : vx < 0 ? r.x + r.w + e.r : e.x;
      e.y += vy * dt;
      for (const r of this.walls) if (e.x + e.r > r.x + 1e-6 && e.x - e.r < r.x + r.w - 1e-6 && e.y + e.r > r.y + 1e-6 && e.y - e.r < r.y + r.h - 1e-6) e.y = vy > 0 ? r.y - e.r : vy < 0 ? r.y + r.h + e.r : e.y;
      e.x = clamp(e.x, 40 + e.r, W - 40 - e.r); e.y = clamp(e.y, 40 + e.r, H - 40 - e.r);e.travel=(e.travel||0)+Math.hypot(e.x-beforeX,e.y-beforeY);
    }
    visible(a, b, pad = 0) { return !this.walls.some(r => segmentBox(a.x, a.y, b.x - a.x, b.y - a.y, r, pad) <= 1); }
    steer(e) {
      const p = this.player;
      if (this.visible(e, p, e.r + 2)) { const d = dist(e, p) || 1; return [(p.x - e.x) / d, (p.y - e.y) / d]; }
      const c = this.cell(e.x, e.y), cx = c % COLS, field = e.r > 20 ? this.flowLarge : this.flow; let best = c;
      for (const n of [cx > 0 ? c - 1 : -1, cx < COLS - 1 ? c + 1 : -1, c - COLS, c + COLS]) if (n >= 0 && n < field.length && field[n] >= 0 && (field[best] < 0 || field[n] < field[best])) best = n;
      const tx = (best % COLS + .5) * TILE, ty = (Math.floor(best / COLS) + .5) * TILE, d = Math.hypot(tx - e.x, ty - e.y) || 1;
      return [(tx - e.x) / d, (ty - e.y) / d];
    }
    addBullet(x, y, angle, friendly, damage, extra = {}) {
      if (this.bullets.length >= 320) return;
      const speed = friendly ? 760 : 205 + this.wave * 5;
      const bullet = { x, y, px: x, py: y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, r: friendly ? 4 : 7, life: friendly ? 1.55 : 5, friendly, damage, pierce: friendly ? this.player.pierce : 0, hit: new Set(), ...extra };
      if (!friendly && this.mode === 'cozy') { bullet.vx *= .85; bullet.vy *= .85; }
      this.bullets.push(bullet);
    }
    fireAt(x, y, a, damage, ghost = false) {
      const p = this.player; this.addBullet(x + Math.cos(a) * 24, y + Math.sin(a) * 24, a, true, damage, { ghost });
      if (p.split) for (const da of [-.15, .15]) this.addBullet(x + Math.cos(a) * 24, y + Math.sin(a) * 24, a + da, true, damage * .42, { ghost });
      if (!ghost) this.emit('shot', { x, y, angle: a });
    }
    damagePlayer(amount) { const p = this.player; if (this.practice || p.invuln > 0 || this.state !== 'playing') return; const actual = Math.min(p.hp, amount * (this.mode === 'cozy' ? .65 : 1)); p.hp -= actual; this.stationStats.damage += actual; p.invuln = this.mode === 'cozy' ? .9 : .65; this.emit('hurt', { x: p.x, y: p.y }); if (p.hp <= 0) { this.state = 'dead'; this.emit('end', { won: false }); } }
    hitEnemy(e, amount) { if (e.hp <= 0 || e.spawn > 0) return; e.hp -= amount; e.hit = .12; if (e.hp <= 0) { this.kills++; this.stationStats.kills++; this.score += e.kind === 'boss' ? 2500 : e.kind === 'hunter' ? 100 : 160; this.emit('kill', { x: e.x, y: e.y, kind: e.kind }); this.pickups.push({ x: e.x, y: e.y, r: 8, life: 25 }); if (this.player.blast) { this.emit('ring', { x: e.x, y: e.y, radius: 78, color: '#f3af62' }); for (const n of this.enemies) if (n !== e && n.hp > 0 && dist(e, n) < 78) this.hitEnemy(n, this.player.damage * .65); } } }
    pulse() {
      const p = this.player; if (p.pulseCd > 0) return;
      const radius = Math.min(550, p.pulseRadius * (this.level.rule === 'return' ? 1.3 : 1));
      p.pulseCd = p.pulseMax * (this.level.rule === 'return' ? .5 : 1); let returned = 0;
      for (const b of this.bullets) if (!b.friendly && dist(p, b) <= radius) { b.friendly = true; b.plane = true; b.damage = p.returnDamage; b.life = 3; b.r = 6; b.hit.clear(); b.vx *= -2; b.vy *= -2; b.pierce = 0; returned++; }
      for (const e of this.enemies) if (e.spawn <= 0 && e.hp > 0 && dist(p, e) < radius) { this.hitEnemy(e, 22); const d = dist(p, e) || 1; this.move(e, (e.x - p.x) / d * 800, (e.y - p.y) / d * 800, 1 / 60); }
      p.invuln = Math.max(p.invuln, .25); this.score += returned * 15; this.stationStats.returned += returned; this.emit('pulse', { x: p.x, y: p.y, radius, returned });
    }
    echo() { const p = this.player; if (p.echoCd > 0 || this.history.length < 15) return; p.echoCd = p.echoMax * (this.level.rule === 'echo' ? .5 : 1); const frames = this.history.map(f => ({ ...f })); this.ghosts.push({ frames, index: 0, x: frames[0].x, y: frames[0].y, angle: frames[0].angle, delay: 0 }); if (this.level.rule === 'twins') this.ghosts.push({ frames, index: 0, x: frames[0].x, y: frames[0].y, angle: frames[0].angle, delay: .5 }); this.emit('echo', { x: p.x, y: p.y }); }
    belts(e, dt) { if (this.level.rule !== 'belt') return; const force=e===this.player?100:e.speed*.3; if (Math.abs(e.y - 260) < 42) this.move(e, force, 0, dt); if (Math.abs(e.y - 500) < 42) this.move(e, -force, 0, dt); }
    hotZones() { if (this.level.rule !== 'hot') return []; const phase = this.levelTime % 7; return [{ x: 420, y: 60, w: 100, h: 640, active: phase > 3 && phase < 5.8, warn: phase > 1.5 && phase <= 3 }, { x: 700, y: 60, w: 100, h: 640, active: phase > 3 && phase < 5.8, warn: phase > 1.5 && phase <= 3 }]; }
    step(dt, input = {}) {
      if (this.state !== 'playing') return; dt = Math.min(dt, 1 / 30); this.time += dt; this.levelTime += dt; const p = this.player;
      for (const key of ['fireCd', 'dashCd', 'echoCd', 'pulseCd', 'invuln']) p[key] = Math.max(0, p[key] - dt);
      if (Number.isFinite(input.aimX) && Number.isFinite(input.aimY)) {
        p.angle = Math.atan2(input.aimY - p.y, input.aimX - p.x);
        if (input.assistAim) {
          let nearest = Infinity, assisted = p.angle;
          for (const e of this.enemies) if (e.hp > 0 && e.spawn <= 0) {
            const cursorDistance = Math.hypot(e.x - input.aimX, e.y - input.aimY), a = Math.atan2(e.y - p.y, e.x - p.x), delta = Math.atan2(Math.sin(a - p.angle), Math.cos(a - p.angle));
            if (cursorDistance < e.r + 45 && cursorDistance < nearest && Math.abs(delta) < .14 && this.visible(p, e, 4)) { nearest = cursorDistance; assisted = a; }
          }
          p.angle = assisted;
        }
      }
      let mx = input.mx || 0, my = input.my || 0, ml = Math.hypot(mx, my); if (ml > 0) { mx /= ml; my /= ml; }
      if (input.dash && p.dashCd <= 0) { p.dx = ml ? mx : Math.cos(p.angle); p.dy = ml ? my : Math.sin(p.angle); p.dashTime = .17; p.dashCd = p.dashMax * (this.level.rule === 'spring' ? .48 : 1); p.invuln = Math.max(p.invuln, .25); this.emit('dash', { x: p.x, y: p.y }); }
      if (p.dashTime > 0) { p.dashTime -= dt; this.move(p, p.dx * 820, p.dy * 820, dt); if (p.dashTime <= 0 && this.level.rule === 'spring') { this.emit('ring', { x: p.x, y: p.y, radius: 115, color: '#79bdc2' }); for (const e of this.enemies) if (dist(p, e) < 115) this.hitEnemy(e, p.damage * 2); } }
      else this.move(p, mx * p.speed, my * p.speed, dt);
      this.belts(p, dt);this.updateDelivery(dt);
      if (input.pulse) this.pulse(); if (input.echo) this.echo();
      let fired = false;
      if (input.fire && p.fireCd <= 0) { this.fireAt(p.x, p.y, p.angle, p.damage); p.fireCd = Math.max(.045, p.fireRate * (this.level.rule === 'rush' ? .7 : 1)); fired = true; }
      this.history.push({ x: p.x, y: p.y, angle: p.angle, fired, damage: p.damage }); if (this.history.length > 240) this.history.shift();
      for (const g of this.ghosts) { if (g.delay > 0) { g.delay -= dt; continue; } const f = g.frames[g.index++]; if (!f) continue; Object.assign(g, { x: f.x, y: f.y, angle: f.angle }); if (f.fired) this.fireAt(g.x, g.y, g.angle, f.damage * p.echoDamage, true); }
      this.ghosts = this.ghosts.filter(g => g.index < g.frames.length);
      if(this.practice){
        this.trainingRespawn-=dt;
        if(this.enemies.length<2&&this.trainingRespawn<=0){const kind=this.enemies.some(e=>e.kind==='shooter')?'hunter':'shooter';this.spawn(kind,{x:kind==='shooter'?1000:840,y:380});const e=this.enemies.at(-1);e.training=true;e.speed=0;e.spawn=.6;this.trainingRespawn=1.3;}
      }
      this.spawnDelay -= dt;
      const crowdLimit = this.mode === 'cozy' ? 9 : 14;
      if (this.spawnQueue.length && this.spawnQueue[0].at <= this.levelTime && this.enemies.length < crowdLimit && this.spawnDelay <= 0) { this.spawn(this.spawnQueue.shift().kind); this.spawnDelay = .24; }
      this.flowTimer -= dt; if (this.flowTimer <= 0) { this.updateFlow(); this.flowTimer = .18; }
      for (const e of this.enemies) {
        if (e.hp <= 0) continue; e.hit = Math.max(0, e.hit - dt); e.spawn -= dt; if (e.spawn > 0) continue;
        e.angle = Math.atan2(p.y - e.y, p.x - e.x); e.fireCd -= dt;
        let [vx, vy] = this.steer(e), speed = e.speed; const d = dist(e, p);
        if (e.kind === 'shooter') { const clearShot = this.visible(e, p, 8); if (d < 245 && clearShot) { vx = -Math.cos(e.angle) * .7 + Math.sin(e.angle) * .5; vy = -Math.sin(e.angle) * .7 - Math.cos(e.angle) * .5; } else if (d < 355 && clearShot) { vx = Math.sin(e.angle) * .65; vy = -Math.cos(e.angle) * .65; }
          if (e.fireCd < 0 && clearShot) { this.addBullet(e.x, e.y, e.angle, false, 11); e.fireCd = Math.max(.8, 1.9 - this.wave * .04); this.emit('enemyShot', { x: e.x, y: e.y }); }
        }
        if (e.kind === 'charger') { if (e.phase === 'walk' && d < 370 && this.visible(e, p, e.r)) { e.phase = 'warn'; e.phaseTime = .72; e.chargeAngle = e.angle; }
          if (e.phase === 'warn') { speed = 0; e.phaseTime -= dt; if (e.phaseTime <= 0) { e.phase = 'charge'; e.phaseTime = .55; } }
          else if (e.phase === 'charge') { vx = Math.cos(e.chargeAngle); vy = Math.sin(e.chargeAngle); speed = 470; e.phaseTime -= dt; if (e.phaseTime <= 0) { e.phase = 'rest'; e.phaseTime = 1.2; } }
          else if (e.phase === 'rest') { speed = 30; e.phaseTime -= dt; if (e.phaseTime <= 0) e.phase = 'walk'; }
        }
        if (e.kind === 'boss') { const phase2 = this.wave === 11 && e.hp < e.maxHp / 2; if (d < 240 && this.visible(e, p, e.r + 2)) { vx = -vx; vy = -vy; }
          if (e.fireCd <= 0) { const count = phase2 ? 22 : 15; const offset = this.levelTime * .55; for (let j = 0; j < count; j++) this.addBullet(e.x, e.y, j / count * TAU + offset, false, 13, { vx: Math.cos(j / count * TAU + offset) * (phase2 ? 220 : 180), vy: Math.sin(j / count * TAU + offset) * (phase2 ? 220 : 180) }); for (let j = -1; j <= 1; j++) this.addBullet(e.x, e.y, e.angle + j * .16, false, 14); e.fireCd = phase2 ? 1.6 : 2.2; this.emit('bossShot', { x: e.x, y: e.y }); }
          e.summon -= dt; if (this.wave === 11 && e.summon < 0 && this.enemies.length < 12) { this.spawn('hunter'); this.spawn('shooter'); e.summon = phase2 ? 8 : 12; }
        }
        // Local separation prevents an entire group collapsing to one point.
        for (const n of this.enemies) if (n !== e && n.hp > 0 && n.spawn <= 0) { const nd = dist(e, n); if (nd < e.r + n.r + 8 && nd > .01) { vx += (e.x - n.x) / nd * .6; vy += (e.y - n.y) / nd * .6; } }
        const vl = Math.hypot(vx, vy); if (vl > 1) { vx /= vl; vy /= vl; } this.move(e, vx * speed, vy * speed, dt); this.belts(e, dt);
        if (d < p.r + e.r + 2) this.damagePlayer(e.kind === 'charger' ? 20 : e.kind === 'boss' ? 23 : 10);
      }
      for (const b of this.bullets) {
        b.life -= dt; if (b.life <= 0) continue; b.px = b.x; b.py = b.y;
        if (b.plane) { let target = null, nearest = Infinity; for (const e of this.enemies) if (e.hp > 0 && e.spawn <= 0 && !b.hit.has(e.id)) { const d = dist(b, e); if (d < nearest && this.visible(b, e)) { nearest = d; target = e; } } if (target) { const a = Math.atan2(target.y - b.y, target.x - b.x); b.vx += (Math.cos(a) * 470 - b.vx) * Math.min(1, dt * 9); b.vy += (Math.sin(a) * 470 - b.vy) * Math.min(1, dt * 9); } }
        else if (this.level.rule === 'wind') b.vx += 105 * dt;
        const dx = b.vx * dt, dy = b.vy * dt;
        let wallT = Infinity; for (const r of this.walls) wallT = Math.min(wallT, segmentBox(b.x, b.y, dx, dy, r, b.r));
        if (b.friendly) {
          const hits = []; for (const e of this.enemies) if (e.hp > 0 && e.spawn <= 0 && !b.hit.has(e.id)) { const t = segmentCircle(b.x, b.y, dx, dy, e, e.r + b.r); if (t <= 1 && t < wallT) hits.push({ e, t }); }
          hits.sort((a, z) => a.t - z.t);
          for (const { e, t } of hits) { b.hit.add(e.id); this.hitEnemy(e, b.damage); this.emit('hit', { x: b.x + dx * t, y: b.y + dy * t, ghost: b.ghost, damage: b.damage }); if (b.pierce-- <= 0) { b.life = 0; break; } }
        } else if (segmentCircle(b.x, b.y, dx, dy, p, p.r + b.r) < wallT) { const t = segmentCircle(b.x, b.y, dx, dy, p, p.r + b.r); if (t <= 1) { this.damagePlayer(b.damage); b.life = 0; } }
        if (wallT <= 1) { b.life = 0; if (b.friendly) this.emit('wallHit', { x: b.x + dx * wallT, y: b.y + dy * wallT }); }
        b.x += dx; b.y += dy;
      }
      this.bullets = this.bullets.filter(b => b.life > 0 && b.x > 0 && b.x < W && b.y > 0 && b.y < H); this.enemies = this.enemies.filter(e => e.hp > 0);
      for (const item of this.pickups) { item.life -= dt; const d = dist(item, p), magnet = this.level.rule === 'magnet'; if (d < (magnet ? 440 : 145)) { item.x += (p.x - item.x) / (d || 1) * Math.min(d, 360 * dt); item.y += (p.y - item.y) / (d || 1) * Math.min(d, 360 * dt); } if (d < 22) { item.life = 0; p.hp = Math.min(p.maxHp, p.hp + 4 + p.healBonus + (magnet ? 3 : 0)); if (magnet) { p.echoCd = Math.max(0, p.echoCd - 1); p.pulseCd = Math.max(0, p.pulseCd - 1); } this.score += 25; this.emit('pickup', { x: p.x, y: p.y }); } }
      this.pickups = this.pickups.filter(i => i.life > 0);
      for (const z of this.hotZones()) if (z.active && p.x > z.x && p.x < z.x + z.w && p.y > z.y && p.y < z.y + z.h) this.damagePlayer(7);
      if (this.state !== 'playing' || this.practice) return;
      if (this.spawnQueue.length === 0 && this.enemies.length === 0) { if (this.clearing < 0) { this.clearing = this.delivery?.state==='carrying'?6:1.3; this.bullets = []; this.emit('clear'); } this.clearing -= dt;if(this.delivery?.state==='done')this.clearing=Math.min(this.clearing,1.3);
        if (this.clearing <= 0) { this.completed = this.wave + 1; this.score += 400 + Math.round(p.hp) * 3; this.bullets = []; if (this.wave === LEVELS.length - 1) { this.state = 'won'; this.emit('end', { won: true }); } else { p.hp = Math.min(p.maxHp, p.hp + 20); const pool = UPGRADES.filter(u => !u.max || this.upgrades.filter(id => id === u.id).length < u.max); for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(this.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; } this.options = pool.slice(0, 3); this.state = 'upgrade'; this.emit('upgrade'); } }
      }
    }
  }
  const api = { Game, LEVELS, UPGRADES, W, H, TILE, COLS, ROWS, clamp, rng, segmentBox, segmentCircle };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Sunny = api;
})(typeof window !== 'undefined' ? window : globalThis);
