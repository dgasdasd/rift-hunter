import './style.css';
import {World} from './world.js';
import {Audio} from './audio.js';
import {BALANCE,WEAPONS,ENEMY_TYPES,PERKS,ROOM_TYPES,ROOM_LAYOUTS} from './data.js';
import {createRun,tick,action,interact,choosePerk,chooseRoute,eventChoice,buy,canGainPerk,restore,serialize,STEP} from './simulation.js';

const $=s=>document.querySelector(s);
const escapeText=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}};
const write=(key,v)=>{try{localStorage.setItem(key,JSON.stringify(v));return true;}catch{return false;}};
const settings={quality:'medium',volume:.65,music:true,autoAim:true,showFps:false,reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches,...read('rift-settings',{})};
document.documentElement.dataset.reduced=String(settings.reducedMotion);
const meta={runs:0,wins:0,best:0,shards:0,...read('rift-meta',{})};
let selected='sword',difficulty=0,run=createRun(),started=false,screen='',previousScreen='',overlayKey='',saved=read('rift-run',null),accumulator=0,last=performance.now(),hudTime=0,saveTime=0,toastTimer=0,bannerTimer=0,finishHandled=false,hiddenPause=false;
const keys=new Set(),held={attack:false,heavy:false},pointer={x:0,y:0,last:-10000},touch={x:0,z:0,active:false},buffers=new Map();
let world,audio;
document.querySelector('#app').innerHTML=`
  <canvas id="world" aria-label="裂隙猎场 3D 游戏场景"></canvas><div class="shade"></div>
  <div class="brand"><span class="brand-symbol">裂</span><div>裂隙猎场<small>RIFT HUNTER</small></div></div>
  <div class="top-actions"><button class="quiet-btn" data-ui="help">操作指南</button><button class="quiet-btn" data-ui="settings">设置</button></div>
  <main class="menu" id="menu"></main>
  <div class="hud" id="hud">
    <div class="status-panel"><div class="hunter-name"><strong>遗迹猎人</strong><span id="weapon-label"></span></div><div class="bar"><div class="bar-fill health-fill" id="hp-fill"></div></div><div class="bar-label"><span>生命 <b id="hp-text"></b></span><span id="shield-text"></span></div><div class="bar"><div class="bar-fill stamina-fill" id="stamina-fill"></div></div><div class="bar-label"><span>耐力</span><span id="stamina-text"></span></div><div class="mini-stats"><div>◈ <b id="gold-text"></b> <span>金币</span></div><div>✦ <b id="kills-text"></b> <span>击败</span></div></div></div>
    <div class="room-panel"><small id="stage-text"></small><h2 id="room-name"></h2><div class="room-objective" id="objective"></div></div>
    <div class="hud-actions"><button class="hud-action" data-ui="map">路线 <kbd>Tab</kbd></button><button class="hud-action" data-ui="pause">暂停 <kbd>Esc</kbd></button></div>
    <div class="boss-panel"><div class="boss-name" id="boss-name"></div><div class="bar"><div class="bar-fill" id="boss-fill"></div></div></div>
    <div class="loadout"><div class="loadout-label">铭文构筑 <span id="perk-count"></span></div><div class="perk-row" id="perks"></div></div>
    <div class="action-bar"><div class="action-slot"><kbd>鼠标 / J</kbd><small>普通攻击</small></div><div class="action-slot"><kbd>右键 / K</kbd><small>重击 · 23 耐力</small></div><div class="action-slot"><kbd>Space</kbd><small>闪避</small></div><div class="action-slot" id="skill-slot"><kbd>E</kbd><small id="skill-text">武器技能</small></div><div class="action-slot"><kbd>Q</kbd><small id="potion-text">治疗药水</small></div></div>
    <div class="bottom-hint">W A S D 移动 · F 交互<br>滚轮缩放 · 按住中键转动视角</div><button class="interact-prompt" id="interact" data-game="interact"><kbd>F</kbd><span></span></button>
  </div>
  <div class="touch-controls" id="touch"><div class="joystick" aria-label="移动摇杆"><div class="joystick-knob"></div></div><div class="touch-buttons"><button class="touch-btn attack" data-touch="attack">攻击</button><button class="touch-btn heavy" data-touch="heavy">重击</button><button class="touch-btn dash" data-touch="dash">闪避</button><button class="touch-btn skill" data-touch="skill">技能</button><button class="touch-btn potion" data-touch="potion">药水</button></div></div>
  <div class="float-layer"></div><div class="damage-vignette"></div><div class="toast" role="status"></div><div class="room-banner"><strong></strong><small></small></div>
  <div class="overlay" id="overlay" role="dialog" aria-modal="true"></div><div class="fps hidden"></div>
  <div class="loading"><div><strong>裂隙猎场</strong><p>正在点亮遗迹……</p></div></div>`;

function button(label,ui,cls='secondary'){return `<button class="${cls}" data-ui="${ui}">${label}</button>`;}
const perkBy=id=>PERKS.find(p=>p.id===id);
const elapsed=time=>`${Math.floor(time/60).toString().padStart(2,'0')}:${Math.floor(time%60).toString().padStart(2,'0')}`;
function menu(){
  $('.menu').classList.remove('hidden');$('.brand').classList.remove('hidden');$('.top-actions').classList.remove('hidden');$('.shade').classList.remove('playing');$('.hud').classList.remove('visible');$('#touch').classList.remove('visible');
  $('#menu').innerHTML=`<div class="menu-content"><div class="eyebrow">遗迹深处，等待你的下一次选择</div><h1>裂隙猎场</h1><div class="subtitle">RIFT HUNTER</div><p class="intro">穿过破碎星门，猎杀古老守卫。<br>选择你的武器，让每一枚铭文改变战局。</p><div class="weapon-heading">选择本次远征的武器</div><div class="weapon-select">${Object.entries(WEAPONS).map(([id,w],i)=>`<button class="weapon-card ${selected===id?'selected':''}" data-weapon="${id}" aria-pressed="${selected===id}"><div class="weapon-mark">${['刃','锤','弩'][i]}</div><strong>${w.name}</strong><small>${w.tag}</small></button>`).join('')}</div><div class="weapon-desc">${WEAPONS[selected].desc}</div><div class="menu-controls">${button('开启远征　↗','start','primary')}${saved&&restore(JSON.stringify(saved))?button('继续远征','continue'):''}${button('操作指南','help')}</div><div class="run-detail"><span>10 段路线 · 两位守关者 · 30 种铭文</span><button class="quiet-btn" data-ui="difficulty">难度：${difficulty?'试炼':'冒险'} ${difficulty?'（通关后解锁）':''}</button></div></div><aside class="expedition-note"><small>猎人手记</small><p>沿途的岔路通向商人、圣所，或更危险的精英守卫。<br>力量总有代价，选择属于你。</p><strong>${meta.wins} <span style="font:11px var(--serif);color:#b8c6af">次远征胜利</span></strong><p>最佳战绩 ${meta.best} · 星砂 ${meta.shards}<br>${meta.shards>=50?'收藏解锁：翡翠猎人徽记':`收集 ${Math.max(0,50-meta.shards)} 星砂解锁翡翠徽记`}</p></aside><div class="menu-footer">可随时暂停 · 进度自动保存于当前浏览器 · 建议使用键盘与鼠标</div>`;
}
function save(){if(!started||['victory','defeat'].includes(run.status))return;if(write('rift-run',JSON.parse(serialize(run))))saved=JSON.parse(serialize(run));}
function start(continuing=false){
  audio.unlock();const restored=continuing&&saved?restore(JSON.stringify(saved)):null;run=restored??createRun(selected,Date.now()>>>0,difficulty);run.cosmetic=meta.shards>=50;selected=run.weapon;started=true;finishHandled=false;screen='';overlayKey='';accumulator=0;keys.clear();buffers.clear();held.attack=false;held.heavy=false;pointer.last=-10000;
  $('#menu').classList.add('hidden');$('.brand').classList.add('hidden');$('.top-actions').classList.add('hidden');$('.shade').classList.add('playing');$('.hud').classList.add('visible');world.serial=-1;save();banner(ROOM_LAYOUTS[run.room.layout].name,`第 ${run.stage+1} 段 · ${ROOM_TYPES[run.room.type].name}`);updateHud();syncOverlay();
  if(!continuing&&!read('rift-tutorial',false)){screen='help';syncOverlay();write('rift-tutorial',true);}
}
function toast(text){$('.toast').textContent=text;$('.toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('.toast').classList.remove('show'),2600);}
function banner(title,sub){$('.room-banner strong').textContent=title;$('.room-banner small').textContent=sub;$('.room-banner').classList.add('show');clearTimeout(bannerTimer);bannerTimer=setTimeout(()=>$('.room-banner').classList.remove('show'),2200);}
function activeMode(){return screen||(started?run.status:'');}
function syncOverlay(force=false){
  const mode=activeMode();const key=mode+':'+run.roomSerial+':'+run.offers.join(',')+':'+run.rewardLeft;
  if(!force&&key===overlayKey)return;overlayKey=key;
  const overlay=$('#overlay');if(!mode||mode==='playing'){overlay.classList.remove('visible');overlay.innerHTML='';return;}overlay.classList.add('visible');held.attack=false;held.heavy=false;keys.clear();touch.x=touch.z=0;touch.active=false;$('.joystick-knob').style.transform='';
  let html='';
  if(mode==='help')html=`<div class="panel narrow"><div class="panel-tag">猎人入门 · ${WEAPONS[run.weapon].name}</div><h2>把握每一次出手</h2><p class="panel-sub">鼠标指向攻击方向；触屏玩家自动瞄准。普攻 ${WEAPONS[run.weapon].damage} 伤害，间隔 ${WEAPONS[run.weapon].interval} 秒；重击 ${WEAPONS[run.weapon].heavy} 伤害。</p><div class="help-grid">${[['W A S D / 方向键','移动'],['鼠标左键 / J','普通攻击，长按连续攻击'],['鼠标右键 / K',`重击，消耗 ${WEAPONS[run.weapon].heavyCost} 耐力`],['Space',`闪避，消耗 ${BALANCE.combat.dashCost} 耐力，短暂无敌`],['E',`技能，${WEAPONS[run.weapon].skillCooldown} 秒基础冷却，${WEAPONS[run.weapon].skillCost} 耐力`],['Q',`药水恢复 ${BALANCE.shop.potionHeal}+铭文加成的生命`],['F','宝箱、祭坛、商人、星门交互'],['Esc / Tab','暂停 / 查看路线']].map(([k,v])=>`<div class="help-row"><kbd>${k}</kbd><span>${v}</span></div>`).join('')}</div><div class="tip">耐力平时每秒恢复 ${BALANCE.player.staminaRegen} 点，攻击时回复 ${Math.round(BALANCE.player.attackRegen*100)}%，闪避时暂停回复。留一点耐力躲避红色预警。<br>盾兵正面减伤，可绕背或重击。触屏使用左侧摇杆和右侧动作按钮。</div><div class="panel-buttons">${button('知道了','close','primary')}</div></div>`;
  if(mode==='settings')html=`<div class="panel narrow"><div class="panel-tag">远征设置</div><h2>调整你的体验</h2><div class="setting-row"><label for="quality">画面质量<small>低档关闭动态阴影</small></label><select id="quality"><option value="low" ${settings.quality==='low'?'selected':''}>流畅</option><option value="medium" ${settings.quality==='medium'?'selected':''}>均衡</option><option value="high" ${settings.quality==='high'?'selected':''}>精细</option></select></div><div class="setting-row"><label for="volume">声音音量</label><input id="volume" type="range" min="0" max="1" step=".05" value="${settings.volume}"></div><div class="setting-row"><label for="music">背景音乐</label><input id="music" type="checkbox" ${settings.music?'checked':''}></div><div class="setting-row"><label for="autoAim">辅助瞄准<small>停止移动鼠标时，朝附近敌人攻击</small></label><input id="autoAim" type="checkbox" ${settings.autoAim?'checked':''}></div><div class="setting-row"><label for="reducedMotion">减少镜头与界面动效</label><input id="reducedMotion" type="checkbox" ${settings.reducedMotion?'checked':''}></div><div class="setting-row"><label for="showFps">显示帧率</label><input id="showFps" type="checkbox" ${settings.showFps?'checked':''}></div><div class="panel-buttons">${button('完成','close','primary')}</div></div>`;
  if(mode==='upgrade')html=`<div class="panel"><div class="panel-tag">遗迹赐予 · ${run.rewardLeft>1?'双重奖励':'铭文选择'}</div><h2>让力量生长</h2><p class="panel-sub">选择一枚铭文。本次远征中永久生效，相同铭文最多叠加三次。${run.rewardLeft>1?'选择后还可再选一枚。':''}</p><div class="choice-grid">${run.offers.map((id,i)=>{const p=perkBy(id);return `<button class="choice-card" data-perk="${id}"><small>${p.kind}</small><span class="symbol">${['✧','◇','✦'][i]}</span><h3>${p.name}</h3><p>${p.desc}</p><div class="choose-label">选择铭文　${i+1} ↗</div></button>`;}).join('')}</div><div class="panel-footer"><span>当前生命 ${Math.ceil(run.player.hp)} / ${run.player.maxHp} · 金币 ${run.gold}</span><span>数字键 1 / 2 / 3 快速选择</span></div></div>`;
  if(mode==='route')html=`<div class="panel"><div class="panel-tag">第 ${run.stage+2} 段 · 路线抉择</div><h2>前方，通向何处</h2><p class="panel-sub">查看自己的生命、金币与铭文，选择适合当前构筑的路线。</p><div class="choice-grid ${run.choices.length===2?'two':''}">${run.choices.map((c,i)=>`<button class="choice-card" data-route="${i}"><small>${ROOM_TYPES[c.type].name}</small><span class="symbol">${c.type==='boss'?'王':c.type==='elite'?'险':'途'}</span><h3>${ROOM_LAYOUTS[c.layout].name}</h3><p>${ROOM_TYPES[c.type].desc}</p><div class="choose-label">进入遗迹　${i+1} ↗</div></button>`).join('')}</div><div class="panel-footer"><span>生命 ${Math.ceil(run.player.hp)} / ${run.player.maxHp} · 药水 ${run.player.potions} · 金币 ${run.gold}</span><span>本次远征共 10 段路线</span></div></div>`;
  if(mode==='pause'||mode==='inventory')html=`<div class="panel"><div class="panel-tag">${WEAPONS[run.weapon].name} · ${elapsed(run.time)}</div><h2>远征暂歇</h2><p class="panel-sub">${run.perks.length?'已获得的铭文构筑':'你还没有获得铭文。击败第一批守卫，选择你的成长路线。'}</p><div class="inventory-list">${[...new Set(run.perks)].map(id=>{const p=perkBy(id);return `<div class="inventory-item">${p.name} ×${run.perks.filter(k=>k===id).length}<small>${p.desc}</small></div>`;}).join('')}</div><div class="panel-buttons">${button('继续远征','resume','primary')}${button('设置','settings')}${button('操作指南','help')}${button('保存并返回主界面','home')}</div><div class="panel-footer"><span>第 ${run.stage+1} 段 · 击败 ${run.kills} 名守卫</span><span>已自动保存当前进度</span></div></div>`;
  if(mode==='map')html=`<div class="panel"><div class="panel-tag">远征路线</div><h2>深入破碎遗迹</h2><p class="panel-sub">第 5 段挑战磐石守门者，第 10 段抵达裂隙核心。其余岔路在前进时揭晓。</p><div class="map-track">${Array.from({length:10},(_,i)=>{const room=run.history?.find(r=>r.stage===i);return `<div class="map-room ${run.stage===i?'current':''}"><strong>${i+1}</strong>${room?ROOM_TYPES[room.type].name:i===4?'磐石王座':i===9?'裂隙核心':'未知岔路'}${run.stage===i?'<br>当前位置':''}</div>`;}).join('')}</div><div class="panel-buttons">${button('返回遗迹','close','primary')}</div></div>`;
  if(mode==='shop')html=`<div class="panel"><div class="panel-tag">流浪商人 · 金币 ${run.gold}</div><h2>为下一战做准备</h2><p class="panel-sub">铭文 ${BALANCE.shop.rune} 金币，治疗恢复 ${BALANCE.shop.healAmount} 生命。每件商品、治疗和药水各限购一次。</p><div class="shop-grid">${run.shopOffers.map(id=>{const p=perkBy(id),sold=run.purchased?.includes(id)||!canGainPerk(run,id);return `<div class="shop-item"><h3>${p.name}</h3><p>${p.desc}</p><button data-buy="${id}" ${sold||run.gold<BALANCE.shop.rune?'disabled':''}>${sold?'已购买 / 已满级':`购买 · ${BALANCE.shop.rune} 金币`}</button></div>`;}).join('')}<div class="shop-item"><h3>治疗服务</h3><p>恢复 ${BALANCE.shop.healAmount} 点生命，限一次。<br>当前 ${Math.ceil(run.player.hp)} / ${run.player.maxHp}</p><button data-buy="heal" ${run.purchased?.includes('heal')||run.gold<BALANCE.shop.heal||run.player.hp>=run.player.maxHp?'disabled':''}>${run.purchased?.includes('heal')?'已使用':`恢复 · ${BALANCE.shop.heal} 金币`}</button></div><div class="shop-item"><h3>治疗药水</h3><p>获得一瓶，限一次。<br>持有 ${run.player.potions} / ${BALANCE.player.potionCap} 瓶</p><button data-buy="potion" ${run.purchased?.includes('potion')||run.gold<BALANCE.shop.potion||run.player.potions>=BALANCE.player.potionCap?'disabled':''}>${run.purchased?.includes('potion')?'已购买':`购买 · ${BALANCE.shop.potion} 金币`}</button></div></div><div class="panel-buttons">${button('离开商人','close-shop','primary')}</div></div>`;
  if(mode==='event'||mode==='chest'){const chest=mode==='chest',cost=chest?BALANCE.event.chestCost:BALANCE.event.sacrifice,safeGold=chest?BALANCE.event.chestSafe:BALANCE.event.eventSafe;html=`<div class="panel narrow"><div class="panel-tag">${chest?'诅咒宝箱':'命运祭坛'}</div><h2>${chest?'你愿意承担代价吗':'力量总有代价'}</h2><p class="panel-sub">${chest?`献出 ${cost} 生命，唤醒精英守卫；击败它获得额外铭文和金币。`:`献出 ${cost} 生命，直接获得一枚自选随机铭文。`}也可以稳妥领取 ${safeGold} 金币。<br>当前生命 ${Math.ceil(run.player.hp)} / ${run.player.maxHp}</p><div class="panel-buttons"><button class="primary" data-risk="yes" ${run.player.hp<=cost?'disabled':''}>${chest?'解开诅咒':'献出生命'} · −${cost} 生命</button><button class="secondary" data-risk="no">领取 ${safeGold} 金币</button></div></div>`;}
  if(mode==='victory'||mode==='defeat'){const win=mode==='victory',score=Math.round(run.kills*35+run.roomsCleared*120+run.gold+(win?1500:0)),shards=Math.max(3,run.roomsCleared*5+(win?30:0));html=`<div class="panel narrow"><div class="panel-tag">${win?'星门再次开启':'每次归来，都更了解遗迹'}</div><h2>${win?'远征凯旋':'猎人暂时倒下'}</h2><p class="panel-sub">${win?'你击败了裂隙之主，完成这次远征。试炼难度已解锁，下一次尝试不同武器和铭文组合。':'你获得的星砂会保留下来。留意敌人的蓄力预警，使用药水和圣所恢复生命，再尝试新的成长路线。'}</p><div class="summary-stats">${[[score,'远征战绩'],[run.kills,'击败守卫'],[elapsed(run.time),'远征时间'],['+'+shards,'获得星砂']].map(([v,k])=>`<div class="summary-stat"><strong>${v}</strong><small>${k}</small></div>`).join('')}</div><div class="panel-buttons">${button('再次远征','retry','primary')}${button('返回主界面','finish-home')}</div><div class="panel-footer"><span>最佳战绩 ${meta.best}</span><span>累计星砂 ${meta.shards}</span></div></div>`;}
  overlay.innerHTML=html;
  const focusable=overlay.querySelector('button:not(:disabled),select,input');focusable?.focus({preventScroll:true});
}
function finish(win){if(finishHandled)return;finishHandled=true;meta.runs++;if(win)meta.wins++;const score=Math.round(run.kills*35+run.roomsCleared*120+run.gold+(win?1500:0));meta.best=Math.max(meta.best,score);meta.shards+=Math.max(3,run.roomsCleared*5+(win?30:0));write('rift-meta',meta);write('rift-run',null);saved=null;overlayKey='';syncOverlay();}
function openScreen(mode){previousScreen=screen;screen=mode;if(started)save();syncOverlay();}
function close(){screen=previousScreen;previousScreen='';syncOverlay();}
function goHome(){save();started=false;screen='';previousScreen='';overlayKey='';run=createRun(selected);world.serial=-1;syncOverlay();menu();}
document.addEventListener('click',e=>{
  const target=e.target.closest('button');if(!target)return;audio?.unlock();
  if(target.dataset.weapon){selected=target.dataset.weapon;run=createRun(selected);world.serial=-1;menu();return;}
  if(target.dataset.perk){if(choosePerk(run,target.dataset.perk)){save();syncOverlay();}return;}
  if(target.dataset.route){chooseRoute(run,+target.dataset.route);banner(ROOM_LAYOUTS[run.room.layout].name,`第 ${run.stage+1} 段 · ${ROOM_TYPES[run.room.type].name}`);save();syncOverlay();return;}
  if(target.dataset.risk){eventChoice(run,target.dataset.risk==='yes');syncOverlay();return;}
  if(target.dataset.buy){if(buy(run,target.dataset.buy)){save();toast('交易完成');syncOverlay(true);}return;}
  if(target.dataset.game==='interact'){interact(run);syncOverlay();return;}
  const ui=target.dataset.ui;
  if(ui==='start')start();if(ui==='continue')start(true);if(ui==='retry')start();
  if(ui==='help'||ui==='settings'||ui==='map')openScreen(ui);
  if(ui==='pause'){openScreen('pause');}if(ui==='close')close();if(ui==='resume'){screen='';previousScreen='';syncOverlay();}
  if(ui==='home'||ui==='finish-home')goHome();
  if(ui==='close-shop'){run.status='playing';syncOverlay();}
  if(ui==='difficulty'){if(meta.wins>0){difficulty=difficulty?0:1;menu();}else toast('完成一次远征后解锁试炼难度');}
  if(ui==='inventory')openScreen('pause');
});
document.addEventListener('change',e=>{
  const id=e.target.id;if(!['quality','volume','music','autoAim','reducedMotion','showFps'].includes(id))return;
  settings[id]=e.target.type==='checkbox'?e.target.checked:e.target.type==='range'?+e.target.value:e.target.value;write('rift-settings',settings);if(id==='quality')world.quality(settings.quality);if(id==='volume')audio.volume(settings.volume);if(id==='reducedMotion')document.documentElement.dataset.reduced=String(settings.reducedMotion);$('.fps').classList.toggle('hidden',!settings.showFps);worldNeedsDraw=true;
});
document.addEventListener('input',e=>{if(e.target.id==='volume')audio.volume(+e.target.value);});
function gameplay(){return started&&!screen&&run.status==='playing'&&!document.hidden;}
const isTouch=()=>matchMedia('(pointer:coarse)').matches||navigator.maxTouchPoints>0;
function aim(){
  const p=run.player;if(!isTouch()&&performance.now()-pointer.last<2200)return world.aim(pointer.x,pointer.y);
  if(settings.autoAim||isTouch()){const candidates=run.enemies.filter(e=>e.hp>0).sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z));if(candidates[0]&&Math.hypot(candidates[0].x-p.x,candidates[0].z-p.z)<24)return {x:candidates[0].x,z:candidates[0].z};}
  return null;
}
document.addEventListener('keydown',e=>{
  if(e.code==='Tab'&&$('#overlay').classList.contains('visible')&&screen!=='map'){
    const items=[...$('#overlay').querySelectorAll('button:not(:disabled),input,select')];if(!items.length)return;
    e.preventDefault();const index=items.indexOf(document.activeElement);items[(index+(e.shiftKey?-1:1)+items.length)%items.length].focus();return;
  }
  if(['Space','Tab','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();
  if(e.code==='Tab'&&started){if(screen==='map'){screen='';previousScreen='';syncOverlay();}else openScreen('map');return;}
  if(e.code==='Escape'){if(screen){screen=previousScreen;previousScreen='';syncOverlay();}else if(started)openScreen('pause');return;}
  if(e.code==='Tab'&&$('#overlay').classList.contains('visible'))return;
  if(['Digit1','Digit2','Digit3'].includes(e.code)&&!screen){const i=+e.code.slice(-1)-1;if(run.status==='upgrade'&&run.offers[i]){choosePerk(run,run.offers[i]);save();syncOverlay();}else if(run.status==='route'&&run.choices[i]){chooseRoute(run,i);save();syncOverlay();}return;}
  if(!gameplay()||['INPUT','SELECT'].includes(e.target.tagName))return;keys.add(e.code);audio.unlock();if(e.repeat)return;
  const a={Space:'dash',KeyK:'heavy',KeyE:'skill',KeyQ:'potion'}[e.code];if(a)buffers.set(a,performance.now()+(a==='dash'?220:600));if(e.code==='KeyF'){if(!interact(run))toast('靠近发光星门、宝箱或祭坛后按 F');syncOverlay();}
});
document.addEventListener('keyup',e=>keys.delete(e.code));
window.addEventListener('blur',()=>{keys.clear();held.attack=false;held.heavy=false;touch.x=touch.z=0;if(gameplay())openScreen('pause');});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&started){save();keys.clear();held.attack=false;held.heavy=false;hiddenPause=true;}else if(hiddenPause){hiddenPause=false;if(started&&!screen)openScreen('pause');last=performance.now();accumulator=0;requestAnimationFrame(frame);}});
window.addEventListener('beforeunload',save);
let rotating=false;
$('#world').addEventListener('pointermove',e=>{if(rotating){world.yaw-=e.movementX*.006;return;}if(e.pointerType!=='touch'){pointer.x=e.clientX;pointer.y=e.clientY;pointer.last=performance.now();}});
$('#world').addEventListener('pointerdown',e=>{if(!gameplay())return;audio.unlock();if(e.button===1){rotating=true;$('#world').setPointerCapture(e.pointerId);e.preventDefault();return;}if(e.button===0)held.attack=true;if(e.button===2)held.heavy=true;});
window.addEventListener('pointerup',e=>{if(e.pointerType!=='touch'){held.attack=false;held.heavy=false;}rotating=false;});
$('#world').addEventListener('contextmenu',e=>e.preventDefault());
$('#world').addEventListener('wheel',e=>{if(!gameplay())return;e.preventDefault();world.zoom=Math.max(.72,Math.min(1.3,world.zoom+e.deltaY*.0005));},{passive:false});
let joyRect=null,joyPointer=-1;
$('.joystick').addEventListener('pointerdown',e=>{if(!gameplay())return;joyRect=e.currentTarget.getBoundingClientRect();joyPointer=e.pointerId;touch.active=true;e.currentTarget.setPointerCapture(e.pointerId);updateJoy(e);audio.unlock();});
function updateJoy(e){if(e.pointerId!==joyPointer||!touch.active)return;const dx=e.clientX-joyRect.left-joyRect.width/2,dz=e.clientY-joyRect.top-joyRect.height/2,length=Math.hypot(dx,dz),max=joyRect.width*.32,f=length>max?max/length:1;touch.x=dx*f/max;touch.z=dz*f/max;$('.joystick-knob').style.transform=`translate(${dx*f}px,${dz*f}px)`;}
$('.joystick').addEventListener('pointermove',updateJoy);
for(const type of ['pointerup','pointercancel'])$('.joystick').addEventListener(type,()=>{touch.x=touch.z=0;touch.active=false;joyPointer=-1;$('.joystick-knob').style.transform='';});
for(const b of document.querySelectorAll('[data-touch]')){b.addEventListener('pointerdown',e=>{e.preventDefault();if(!gameplay())return;const a=b.dataset.touch;if(a==='attack')held.attack=true;else buffers.set(a,performance.now()+(a==='dash'?220:600));b.setPointerCapture(e.pointerId);audio.unlock();});b.addEventListener('pointerup',()=>held.attack=false);b.addEventListener('pointercancel',()=>held.attack=false);}
window.addEventListener('resize',()=>{world?.resize();worldNeedsDraw=true;});

const hudEls=Object.fromEntries(['hp-fill','hp-text','shield-text','stamina-fill','stamina-text','gold-text','kills-text','stage-text','room-name','objective','boss-name','boss-fill','perk-count','weapon-label','potion-text','skill-text','skill-slot'].map(id=>[id,$('#'+id)]));
let hudPerks='';
function prompt(){const p=run.player;let text='';if(run.cleared&&p.z<-9&&Math.abs(p.x)<3.5)text='穿过星门 · 选择下一段路线';else if(['shop','rest','event'].includes(run.room.type)&&Math.hypot(p.x,p.z)<3.2&&(run.room.type==='shop'||!run.eventDone))text=run.room.type==='shop'?'与流浪商人交易':run.room.type==='rest'?'激活圣所 · 恢复生命':'触碰命运祭坛';else if(!run.chestUsed&&['battle','elite'].includes(run.room.type)&&Math.hypot(p.x-10,p.z-8)<2.4)text='打开宝箱 · 选择是否接受诅咒';return text;}
function updateHud(){
  if(!started)return;const p=run.player;hudEls['hp-fill'].style.transform=`scaleX(${Math.max(0,p.hp/p.maxHp)})`;hudEls['hp-text'].textContent=`${Math.ceil(p.hp)} / ${p.maxHp}`;hudEls['shield-text'].textContent=p.shield>0?`护盾 ${Math.ceil(p.shield)}`:'';hudEls['stamina-fill'].style.transform=`scaleX(${p.stamina/p.maxStamina})`;hudEls['stamina-text'].textContent=Math.floor(p.stamina)+' / '+p.maxStamina;
  hudEls['gold-text'].textContent=run.gold;hudEls['kills-text'].textContent=run.kills;hudEls['stage-text'].textContent=`遗迹 ${run.stage+1} / 10 · ${ROOM_TYPES[run.room.type].name}`;hudEls['room-name'].textContent=ROOM_LAYOUTS[run.room.layout].name;
  const alive=run.enemies.filter(e=>e.hp>0);hudEls['objective'].textContent=!run.cleared?(run.waveDelay>0?'增援即将抵达 · 调整位置':`击败剩余 ${alive.length} 名守卫${run.room.type==='boss'?'':` · 第 ${run.wave} / ${run.waves} 波`}`):run.room.type==='shop'?'靠近中央商人按 F 交易，或前往北侧星门':run.room.type==='rest'&&!run.eventDone?'靠近中央圣所按 F 恢复生命':run.room.type==='event'&&!run.eventDone?'靠近中央祭坛按 F 作出选择':'遗迹已肃清 · 前往北侧发光星门按 F';
  const boss=alive.find(e=>ENEMY_TYPES[e.type].boss);$('.boss-panel').classList.toggle('visible',!!boss);if(boss){hudEls['boss-name'].textContent=ENEMY_TYPES[boss.type].name+(boss.phase===2?' · 第二阶段':'');hudEls['boss-fill'].style.transform=`scaleX(${Math.max(0,boss.hp/boss.maxHp)})`;}
  hudEls['weapon-label'].textContent=WEAPONS[run.weapon].name;hudEls['potion-text'].textContent=`药水 ×${p.potions}`;hudEls['skill-text'].textContent=p.skillCd>0?`${p.skillCd.toFixed(1)} 秒`:WEAPONS[run.weapon].skill;hudEls['skill-slot'].classList.toggle('cooldown',p.skillCd>0);
  const perkKey=run.perks.join(',');if(perkKey!==hudPerks){hudPerks=perkKey;$('#perks').innerHTML=[...new Set(run.perks)].map(id=>{const perk=perkBy(id),n=run.perks.filter(k=>k===id).length;return `<button class="perk-chip" title="${escapeText(perk.name+'：'+perk.desc)}" data-ui="inventory">${perk.name.slice(0,1)}${n>1?n:''}</button>`;}).join('');}hudEls['perk-count'].textContent=run.perks.length?`· ${run.perks.length}`:'';
  const text=prompt();$('#interact').classList.toggle('visible',!!text&&gameplay());$('#interact span').textContent=text;$('#touch').classList.toggle('visible',isTouch()&&gameplay());
}
function floating(e){if(settings.reducedMotion)return;const layer=$('.float-layer');if(layer.childElementCount>24)return;const p=world.project(e.x,e.z,2.4);if(!p.visible)return;const n=document.createElement('div');n.className='damage-number'+(e.critical?' crit':'');n.textContent=e.amount;n.style.transform=`translate(${p.x+(Math.random()-.5)*20}px,${p.y}px)`;layer.append(n);setTimeout(()=>n.remove(),720);}
function consumeEvents(){const events=run.events.splice(0);for(const e of events){world.event(e);audio.event(e);if(e.type==='hit')floating(e);if(e.type==='hurt'){$('.damage-vignette').classList.add('active');setTimeout(()=>$('.damage-vignette').classList.remove('active'),160);}if(e.type==='warn')toast(e.message);if(e.type==='perk')toast(`获得铭文：${e.name}`);if(e.type==='room'&&started)banner(e.name,`第 ${run.stage+1} 段 · ${ROOM_TYPES[run.room.type].name}`);if(e.type==='save')save();if(e.type==='finish')finish(e.win);}}
let fpsFrames=0,fpsTime=0,frameSamples=[];
function frame(now){
  if(document.hidden){last=now;return;}const dt=Math.min(.08,Math.max(.001,(now-last)/1000));last=now;fpsFrames++;fpsTime+=dt;frameSamples.push(dt);if(frameSamples.length>300)frameSamples.shift();
  if(gameplay()){
    accumulator+=dt;const a=aim();const ix=touch.x+(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0),iz=touch.z+(keys.has('KeyS')||keys.has('ArrowDown')?1:0)-(keys.has('KeyW')||keys.has('ArrowUp')?1:0);const yaw=world.yaw;const input={x:ix*Math.cos(yaw)+iz*Math.sin(yaw),z:-ix*Math.sin(yaw)+iz*Math.cos(yaw),aim:a};
    let steps=0;while(accumulator>=STEP&&steps++<10&&run.status==='playing'){
      for(const [name,expiry] of buffers){if(expiry<now)buffers.delete(name);else if(action(run,name,a))buffers.delete(name);}
      if(held.heavy)action(run,'heavy',a);else if(held.attack||keys.has('KeyJ'))action(run,'attack',a);
      tick(run,input);accumulator-=STEP;
    }
    if(steps>=10)accumulator=0;
    if(world.cursor){world.cursor.visible=!!a;if(a)world.cursor.position.set(a.x,.04,a.z);}
    audio.update(true);saveTime+=dt;if(saveTime>8){saveTime=0;save();}
  }else accumulator=0;
  consumeEvents();syncOverlay();hudTime+=dt;if(hudTime>.09){hudTime=0;updateHud();}
  // Freeze scene motion behind modal screens. Menus render at a capped rate.
  const canAnimate=!started||gameplay();if(canAnimate||world.serial!==run.roomSerial||worldNeedsDraw){world.render(run,canAnimate?dt:0,!started,gameplay()?accumulator/STEP:1);worldNeedsDraw=false;}
  if(fpsTime>1){$('.fps').textContent=`${Math.round(fpsFrames/fpsTime)} FPS · ${world.renderer.info.render.calls} draw · ${run.enemies.filter(e=>e.hp>0).length} 敌人`;fpsFrames=0;fpsTime=0;}
  requestAnimationFrame(frame);
}
let worldNeedsDraw=true;
try{
  world=new World($('#world'),settings);audio=new Audio(settings);menu();$('.fps').classList.toggle('hidden',!settings.showFps);$('.loading').remove();requestAnimationFrame(frame);
  // Read-only inspection surface for performance and interaction verification.
  window.__rift={snapshot:()=>({started,mode:activeMode()||'menu',stage:run.stage,room:run.room,weapon:run.weapon,player:{...run.player},alive:run.enemies.filter(e=>e.hp>0).length,enemies:run.enemies.map(e=>({id:e.id,type:e.type,x:e.x,z:e.z,hp:e.hp,state:e.state,phase:e.phase})),gold:run.gold,kills:run.kills,perks:[...run.perks],time:run.time,cleared:run.cleared,quality:settings.quality,drawCalls:world.renderer.info.render.calls,triangles:world.renderer.info.render.triangles,frameMs:frameSamples.map(t=>t*1000)}),project:(x,z)=>world.project(x,z,0)};
  if(new URLSearchParams(location.search).has('test'))window.__riftTest={get state(){return run;},action:(name,a)=>action(run,name,a),tick:(input,dt)=>tick(run,input,dt),choosePerk:id=>{choosePerk(run,id);syncOverlay();},chooseRoute:i=>{chooseRoute(run,i);worldNeedsDraw=true;syncOverlay();},interact:()=>{interact(run);syncOverlay();},draw:()=>worldNeedsDraw=true,visual:()=>{const u=world.player.userData;return {shoulder:u.arms[1].rotation.toArray(),elbow:u.elbows[1].rotation.toArray(),wrist:u.held.rotation.toArray(),body:u.body.rotation.toArray(),trail:world.bladeTrail.mesh.visible};}};
}catch(e){$('.loading').innerHTML=`<div class="error"><strong>遗迹暂时无法开启</strong><p>${escapeText(e.message)}</p><p>请使用支持 WebGL 的浏览器，并开启硬件加速后刷新。</p></div>`;console.error(e);}
