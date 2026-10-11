import {WEAPONS,ENEMY_TYPES,PERKS,ROOM_LAYOUTS} from './data.js';
export const STEP=1/120;
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function rng(seed){let a=seed>>>0;return()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const angle=(x,z)=>Math.atan2(x,z);
const diff=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
const navigation=new WeakMap();
function flowField(s,radius=.75){
  let cache=navigation.get(s);const band=radius>1?1:0,px=Math.round(s.player.x),pz=Math.round(s.player.z),key=[s.roomSerial,px,pz,Math.floor(s.time*2)].join(':');
  if(!cache){cache={};navigation.set(s,cache);}if(cache[band]?.key===key)return cache[band];
  const width=29,height=27,cells=width*height,blocked=new Uint8Array(cells),distance=new Int16Array(cells).fill(32767),queue=new Int16Array(cells);
  const idx=(x,z)=>(z+13)*width+x+14;
  for(let z=-13;z<=13;z++)for(let x=-14;x<=14;x++)for(const [ox,oz,r] of ROOM_LAYOUTS[s.room.layout].props)if(Math.hypot(x-ox,z-oz)<r+radius)blocked[idx(x,z)]=1;
  let gx=clamp(px,-14,14),gz=clamp(pz,-13,13),goal=idx(gx,gz);
  if(blocked[goal]){let best=Infinity;for(let z=-13;z<=13;z++)for(let x=-14;x<=14;x++)if(!blocked[idx(x,z)]&&Math.hypot(x-px,z-pz)<best){best=Math.hypot(x-px,z-pz);goal=idx(x,z);}}
  let head=0,tail=0;queue[tail++]=goal;distance[goal]=0;
  while(head<tail){const n=queue[head++],x=n%width,z=Math.floor(n/width);for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,nz=z+dz;if(nx<0||nx>=width||nz<0||nz>=height)continue;const next=nz*width+nx;if(!blocked[next]&&distance[next]===32767){distance[next]=distance[n]+1;queue[tail++]=next;}}}
  return cache[band]={key,width,height,blocked,distance,idx};
}
function chaseDirection(s,e){
  const p=s.player,dx=p.x-e.x,dz=p.z-e.z,length=Math.hypot(dx,dz);let clear=true;
  for(const [x,z,r] of ROOM_LAYOUTS[s.room.layout].props)if(closestPointDistance({x,z},e,p)<r+e.radius+.12){clear=false;break;}
  if(clear)return {x:dx/(length||1),z:dz/(length||1)};
  const f=flowField(s,e.radius>.9?1.5:.8),cx=clamp(Math.round(e.x),-14,14),cz=clamp(Math.round(e.z),-13,13);let best=Infinity,tx=cx,tz=cz;
  for(let z=cz-1;z<=cz+1;z++)for(let x=cx-1;x<=cx+1;x++){
    if(x< -14||x>14||z< -13||z>13||f.blocked[f.idx(x,z)])continue;
    if(x!==cx&&z!==cz&&(f.blocked[f.idx(x,cz)]||f.blocked[f.idx(cx,z)]))continue;
    const score=f.distance[f.idx(x,z)]+Math.hypot(x-e.x,z-e.z)*.15;
    if(score<best){best=score;tx=x;tz=z;}
  }
  const nx=tx-e.x,nz=tz-e.z,d=Math.hypot(nx,nz);return {x:nx/(d||1),z:nz/(d||1)};
}
const mods=()=>Object.fromEntries(['power','haste','speed','regen','crit','leech','poison','chain','explode','dashwave','frost','pierce','blood','orbit','multishot','reach','heavy','skill','cooldown','armor','thorn','execute','gold','potion','renew','dodge','focus','barrier','elite'].map(k=>[k,0]));
export function createRun(weapon='sword',seed=Date.now()>>>0,difficulty=0){
  const s={version:1,seed,randomState:seed,weapon,difficulty,stage:0,roomSerial:0,nextId:1,time:0,status:'playing',player:{x:0,z:10,prevX:0,prevZ:10,vx:0,vz:0,angle:Math.PI,hp:120,maxHp:120,stamina:100,maxStamina:100,shield:0,potions:3,invuln:0,dash:0,dashX:0,dashZ:0,attackTimer:0,attackPose:0,heavyPose:false,skillCd:0,combo:0,comboTimer:0,orbitTimer:2},mods:mods(),perks:[],gold:0,kills:0,damageDealt:0,dodges:0,roomsCleared:0,enemies:[],projectiles:[],hazards:[],pickups:[],events:[],choices:[],offers:[],rewardLeft:0,cleared:false,eventDone:false,chestUsed:false};
  enterRoom(s,{type:'battle',layout:0});return s;
}
function random(s){s.randomState=(s.randomState+0x6D2B79F5)>>>0;let t=s.randomState;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;}
export function emit(s,type,data={}){s.events.push({type,...data});if(s.events.length>250)s.events.shift();}
export function spawnEnemy(s,type,x,z,elite=false){const d=ENEMY_TYPES[type],factor=1+s.stage*.075+s.difficulty*.2;const e={id:s.nextId++,type,x,z,prevX:x,prevZ:z,angle:Math.PI,vx:0,vz:0,hp:d.hp*factor*(elite?1.65:1),maxHp:d.hp*factor*(elite?1.65:1),elite,radius:d.boss?1.35:elite?.85:.65,speed:d.speed,damage:d.damage*(1+s.difficulty*.2),cooldown:1+random(s)*1.5,state:'move',timer:0,targetX:0,targetZ:0,attackKind:'',hitFlash:0,stun:0,poison:0,poisonTimer:0,frost:0,phase:1,attacks:0,death:0};s.enemies.push(e);return e;}
export function enterRoom(s,choice){
  s.roomSerial++;s.room={type:choice.type,layout:choice.layout??Math.floor(random(s)*12),name:choice.name};
  if(['rest','shop','event'].includes(choice.type))s.room.layout=10;
  if(choice.type==='boss')s.room.layout=s.stage===4?12:13;
  s.enemies=[];s.projectiles=[];s.hazards=[];s.pickups=[];s.cleared=false;s.eventDone=false;s.chestUsed=false;s.offers=[];s.rewardLeft=0;s.choices=[];s.purchased=[];s.status='playing';s.wave=1;s.waves=s.stage===0?2:s.room.type==='elite'?4:3;s.waveDelay=0;
  s.history??=[];s.history.push({stage:s.stage,type:s.room.type,layout:s.room.layout});
  const p=s.player;Object.assign(p,{x:0,z:10,prevX:0,prevZ:10,vx:0,vz:0,angle:Math.PI,stamina:p.maxStamina,shield:s.mods.barrier,invuln:1.2,dash:0,attackTimer:0,attackPose:0,skillCd:Math.min(2,p.skillCd)});
  if(choice.type==='boss')spawnEnemy(s,s.stage===4?'sentinel':'warden',0,-5);
  else if(['battle','elite'].includes(choice.type))spawnWave(s);
  else{
    s.cleared=true;
    if(choice.type==='shop')s.shopOffers=offerPerks(s,3);
  }
  s.barrels=makeBarrels(s);emit(s,'room',{name:ROOM_LAYOUTS[s.room.layout].name});
}
function spawnWave(s){
  const types=['stalker','archer','shield','charger','bomber','healer'];
  const count=Math.min(10,4+Math.floor(s.stage*.4)+(s.room.type==='elite'?1:0));
  s.enemies=s.enemies.filter(e=>e.hp>0);const offset=random(s)*Math.PI*2;
  for(let i=0;i<count;i++){
    const type=i===0?'stalker':types[Math.floor(random(s)*Math.min(6,2+s.stage))],a=i/count*Math.PI*2+offset;
    let x=Math.sin(a)*10,z=Math.cos(a)*8-2;if(Math.hypot(x-s.player.x,z-s.player.z)<4){x=-x;z=-z;}
    const e=spawnEnemy(s,type,x,z,s.room.type==='elite'&&(i===0||i===count-1));resolvePosition(s,e);
    emit(s,'spawn',{x:e.x,z:e.z});
  }
}
export function obstacles(s){return ROOM_LAYOUTS[s.room.layout].props.map(([x,z,r])=>({x,z,r}));}
export function resolvePosition(s,obj){
  const r=obj.radius??.48;obj.x=clamp(obj.x,-15+r,15-r);obj.z=clamp(obj.z,-14+r,14-r);
  for(let n=0;n<2;n++)for(const [x,z,rad] of ROOM_LAYOUTS[s.room.layout].props){const dx=obj.x-x,dz=obj.z-z,d=Math.hypot(dx,dz);if(d<rad+r){const a=d>.0001?dx/d:1,b=d>.0001?dz/d:0;obj.x=x+a*(rad+r);obj.z=z+b*(rad+r);}}
}
function move(s,obj,dx,dz){const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.22));for(let i=0;i<steps;i++){obj.x+=dx/steps;obj.z+=dz/steps;resolvePosition(s,obj);}}
export function offerPerks(s,count=3){const pool=PERKS.filter(p=>s.perks.filter(k=>k===p.id).length<3);const result=[];while(result.length<count&&pool.length){result.push(pool.splice(Math.floor(random(s)*pool.length),1)[0].id);}return result;}
export function choosePerk(s,id){if(s.status!=='upgrade'||!s.offers.includes(id))return false;applyPerk(s,id);s.rewardLeft--;if(s.rewardLeft>0){s.offers=offerPerks(s);emit(s,'upgrade');}else{s.status='playing';s.offers=[];emit(s,'save');}return true;}
export function applyPerk(s,id){const perk=PERKS.find(p=>p.id===id);if(!perk)return false;s.perks.push(id);for(const [k,v] of Object.entries(perk.effect)){if(k==='maxHp'){s.player.maxHp+=v;s.player.hp=Math.min(s.player.maxHp,s.player.hp+v);}else if(k==='maxStamina'){s.player.maxStamina+=v;s.player.stamina+=v;}else s.mods[k]+=v;}if(id==='gold')s.gold+=35;if(id==='potion')s.player.potions++;emit(s,'perk',{name:perk.name});return true;}
function damageScale(s,e,kind){let v=1+s.mods.power;if(s.mods.blood&&s.player.hp/s.player.maxHp<.4)v+=.6;if(kind==='heavy')v*=1+s.mods.heavy;if(kind==='skill')v*=1+s.mods.skill;if(e.hp/e.maxHp<.3)v*=1+s.mods.execute;if(e.elite||ENEMY_TYPES[e.type].boss)v*=1+s.mods.elite;return v;}
export function hurtEnemy(s,e,amount,kind='basic',proc=true){
  if(e.hp<=0)return;let value=amount*damageScale(s,e,kind);let critical=false;
  if(proc&&random(s)<s.mods.crit){value*=2;critical=true;}
  if(e.type==='shield'&&['basic','finisher'].includes(kind)&&!s.mods.pierce){const facing=angle(s.player.x-e.x,s.player.z-e.z);if(Math.abs(diff(facing,e.angle))<1.25){value*=.25;emit(s,'block',{x:e.x,z:e.z});}}
  e.hp-=value;s.damageDealt+=value;e.hitFlash=.13;if(['heavy','skill','finisher'].includes(kind)){e.stun=ENEMY_TYPES[e.type].boss?.12:kind==='finisher'?.3:.65;const d=Math.max(.1,dist(e,s.player));move(s,e,(e.x-s.player.x)/d*.7,(e.z-s.player.z)/d*.7);}
  if(proc){s.player.hp=Math.min(s.player.maxHp,s.player.hp+value*s.mods.leech);if(s.mods.poison){e.poison=s.mods.poison;e.poisonTimer=4;}if(s.mods.frost)e.frost=2;}
  emit(s,'hit',{x:e.x,z:e.z,amount:Math.round(value),critical,kind});
  if(proc&&s.mods.chain){let targets=s.enemies.filter(o=>o.id!==e.id&&o.hp>0&&dist(o,e)<6).sort((a,b)=>dist(a,e)-dist(b,e)).slice(0,2);for(const t of targets){hurtEnemy(s,t,8+6*s.mods.chain,'chain',false);emit(s,'chain',{x:e.x,z:e.z,tx:t.x,tz:t.z});}}
  if(e.hp<=0)kill(s,e);
}
function kill(s,e){if(e.death)return;e.death=.5;s.kills++;s.gold+=Math.round(ENEMY_TYPES[e.type].reward*(1+s.mods.gold)*(e.elite?1.5:1));s.player.hp=Math.min(s.player.maxHp,s.player.hp+s.mods.renew);emit(s,'kill',{x:e.x,z:e.z,boss:ENEMY_TYPES[e.type].boss});if(random(s)<.13)s.pickups.push({id:s.nextId++,x:e.x,z:e.z,type:'health',amount:14});if(s.mods.explode){emit(s,'blast',{x:e.x,z:e.z,radius:3,color:'gold'});for(const t of s.enemies)if(t.id!==e.id&&t.hp>0&&dist(t,e)<3)hurtEnemy(s,t,22*s.mods.explode,'blast',false);}}
export function hurtPlayer(s,amount,source){const p=s.player;if(p.invuln>0||s.status!=='playing')return false;let value=amount*(1-Math.min(.65,s.mods.armor));const shield=Math.min(p.shield,value);p.shield-=shield;value-=shield;p.hp=Math.max(0,p.hp-value);p.invuln=.5;emit(s,'hurt',{amount:Math.round(value),x:p.x,z:p.z});if(source&&s.mods.thorn){for(const e of s.enemies)if(e.hp>0&&dist(p,e)<4)hurtEnemy(s,e,s.mods.thorn,'thorn',false);}if(p.hp<=0){s.status='defeat';emit(s,'finish',{win:false});}return true;}
function attackCone(s,amount,range,width,kind){const p=s.player;for(const e of s.enemies){const d=dist(e,p),blocked=ROOM_LAYOUTS[s.room.layout].props.some(([x,z,r])=>closestPointDistance({x,z},p,e)<r);if(e.hp>0&&!blocked&&d<range+e.radius&&(d<1.2||Math.abs(diff(angle(e.x-p.x,e.z-p.z),p.angle))<width))hurtEnemy(s,e,amount,kind);}for(const b of s.barrels??[])if(!b.broken&&dist(b,p)<range&&Math.abs(diff(angle(b.x-p.x,b.z-p.z),p.angle))<width)breakBarrel(s,b);}
function breakBarrel(s,b){if(b.broken)return;b.broken=true;emit(s,'blast',{x:b.x,z:b.z,radius:3,color:'gold'});for(const e of s.enemies)if(e.hp>0&&dist(e,b)<3.5)hurtEnemy(s,e,65,'barrel',false);}
function shoot(s,owner,x,z,a,damage,{speed=18,pierce=false,life=1.8,radius=.22,color='cyan',kind='basic'}={}){s.projectiles.push({id:s.nextId++,owner,x,z,prevX:x,prevZ:z,vx:Math.sin(a)*speed,vz:Math.cos(a)*speed,damage,life,radius,pierce,hits:[],color,kind});}
export function action(s,name,aim){
  if(s.status!=='playing')return false;const p=s.player,w=WEAPONS[s.weapon];if(aim&&Math.hypot(aim.x-p.x,aim.z-p.z)>.2)p.angle=angle(aim.x-p.x,aim.z-p.z);
  if(name==='potion'){if(p.potions<=0||p.hp>=p.maxHp)return false;p.potions--;p.hp=Math.min(p.maxHp,p.hp+50+s.mods.potion);emit(s,'heal',{x:p.x,z:p.z});return true;}
  if(name==='dash'){
    const cost=28*(1-Math.min(.6,s.mods.dodge));if(p.stamina<cost||p.dash>0)return false;p.stamina-=cost;p.dash=.24;p.invuln=.3+Math.min(.18,s.mods.dodge*.15);const d=Math.hypot(p.vx,p.vz);p.dashX=d>.2?p.vx/d:Math.sin(p.angle);p.dashZ=d>.2?p.vz/d:Math.cos(p.angle);s.dodges++;emit(s,'dash',{x:p.x,z:p.z});return true;
  }
  if(p.dash>0||p.attackTimer>0)return false;
  if(name==='attack'||name==='heavy'){
    const heavy=name==='heavy';if(heavy&&p.stamina<23)return false;if(heavy)p.stamina-=23;p.combo=p.comboTimer>0?(p.combo+1)%3:0;p.comboTimer=1.3;p.attackTimer=(heavy?w.interval*1.7:w.interval)/(1+s.mods.haste);p.attackPose=heavy?.5:.3;p.heavyPose=heavy;
    const damage=heavy?w.heavy:w.damage*(p.combo===2?1.35:1),range=w.range*(1+s.mods.reach);const kind=heavy?'heavy':'basic';
    if(s.weapon==='bow'){shoot(s,'player',p.x,p.z,p.angle,damage,{speed:25*(1+s.mods.reach*.8),pierce:heavy||!!s.mods.pierce,life:1.2,kind});if(s.mods.multishot)for(const a of [-.16,.16])shoot(s,'player',p.x,p.z,p.angle+a,damage*.65,{speed:25,life:1.2,kind});}
    else{attackCone(s,damage,heavy?range*1.18:range,heavy?1.5:1.08,heavy?kind:p.combo===2?'finisher':kind);emit(s,'slash',{x:p.x,z:p.z,angle:p.angle,radius:range,heavy,combo:p.combo});}
    emit(s,'attack',{weapon:s.weapon,heavy});return true;
  }
  if(name==='skill'){
    const cost=30*(1-Math.min(.6,s.mods.focus));if(p.skillCd>0||p.stamina<cost)return false;p.stamina-=cost;p.skillCd=8*(1-Math.min(.6,s.mods.cooldown));p.attackTimer=.3;p.attackPose=.6;p.heavyPose=true;
    if(s.weapon==='bow'){for(let i=-3;i<=3;i++)shoot(s,'player',p.x,p.z,p.angle+i*.17,48,{speed:23,pierce:true,life:1.3,color:'gold',kind:'skill'});}
    else{const point=s.weapon==='hammer'?{x:p.x+Math.sin(p.angle)*3,z:p.z+Math.cos(p.angle)*3}:p;const radius=s.weapon==='hammer'?5:5.5;for(const e of s.enemies)if(e.hp>0&&dist(point,e)<radius+e.radius)hurtEnemy(s,e,s.weapon==='hammer'?115:80,'skill');emit(s,'blast',{x:point.x,z:point.z,radius,color:'cyan'});}
    emit(s,'skill');return true;
  }return false;
}
function closestPointDistance(p,a,b){const dx=b.x-a.x,dz=b.z-a.z,t=clamp(((p.x-a.x)*dx+(p.z-a.z)*dz)/(dx*dx+dz*dz||1),0,1);return Math.hypot(p.x-a.x-dx*t,p.z-a.z-dz*t);}
function addHazard(s,x,z,r,damage,delay=1,kind='circle',extra={}){const h={id:s.nextId++,x,z,r,damage,delay,totalDelay:delay,life:.35,active:false,kind,...extra};s.hazards.push(h);return h;}
function planEnemyAttack(s,e){const p=s.player,d=ENEMY_TYPES[e.type];e.state='windup';e.timer=d.windup/(e.phase===2?1.12:1);e.targetX=p.x;e.targetZ=p.z;e.angle=angle(p.x-e.x,p.z-e.z);e.attacks++;
  if(d.boss){e.attackKind=e.type==='sentinel'?['slam','fan','charge','ring'][e.attacks%4]:['meteor','fan','ring','summon','charge'][e.attacks%5];}
  else e.attackKind=e.type;
  if(e.attackKind==='bomber'||e.attackKind==='meteor'){const n=e.attackKind==='meteor'?e.phase===2?5:3:1;for(let i=0;i<n;i++)addHazard(s,p.x+(i?Math.sin(i*2.4)*4:0),p.z+(i?Math.cos(i*2.4)*4:0),2.4,e.damage,e.timer+.1);}
  if(e.attackKind==='slam')addHazard(s,e.x+Math.sin(e.angle)*3,e.z+Math.cos(e.angle)*3,4.5,e.damage,e.timer);
}
function executeEnemyAttack(s,e){const p=s.player,d=ENEMY_TYPES[e.type];
  if(['stalker','shield'].includes(e.attackKind)){if(dist(p,e)<d.range+.7&&Math.abs(diff(angle(p.x-e.x,p.z-e.z),e.angle))<1.3)hurtPlayer(s,e.damage,e);emit(s,'enemySlash',{x:e.x,z:e.z,angle:e.angle,radius:d.range+1});}
  else if(e.attackKind==='archer')shoot(s,'enemy',e.x,e.z,e.angle,e.damage,{speed:12,life:2.6,color:'red'});
  else if(e.attackKind==='fan'){for(let i=-3;i<=3;i++)shoot(s,'enemy',e.x,e.z,e.angle+i*.23,e.damage,{speed:10+(e.phase-1)*2,life:3,color:'red',radius:.32});}
  else if(e.attackKind==='charger'||e.attackKind==='charge'){e.state='charge';e.timer=.65;return;}
  else if(e.attackKind==='ring'){addHazard(s,e.x,e.z,12,e.damage,.65,'ring',{inner:3.5});emit(s,'warn',{message:'远离外环，进入内圈或闪避穿过！'});}
  else if(e.attackKind==='healer'){for(const o of s.enemies)if(o.hp>0&&o.id!==e.id&&dist(e,o)<8)o.hp=Math.min(o.maxHp,o.hp+22);emit(s,'heal',{x:e.x,z:e.z,enemy:true});shoot(s,'enemy',e.x,e.z,e.angle,8,{speed:9});}
  else if(e.attackKind==='summon'&&s.enemies.filter(o=>o.hp>0).length<9){for(let i=0;i<3;i++)spawnEnemy(s,i===2?'archer':'stalker',Math.sin(i*2.1)*8,Math.cos(i*2.1)*7);emit(s,'warn',{message:'裂隙之主正在召唤守卫！'});}
  e.state='recover';e.timer=.45;e.cooldown=d.cooldown/(e.phase===2?1.2:1);
}
function updateEnemy(s,e,dt){const p=s.player,d=ENEMY_TYPES[e.type];e.prevX=e.x;e.prevZ=e.z;e.hitFlash=Math.max(0,e.hitFlash-dt);e.frost=Math.max(0,e.frost-dt);e.stun=Math.max(0,e.stun-dt);if(e.hp<=0){e.death=Math.max(.001,e.death-dt);return;}
  if(e.poisonTimer>0){e.poisonTimer-=dt;e.hp-=e.poison*dt;if(e.hp<=0){kill(s,e);return;}}
  if(d.boss&&e.hp/e.maxHp<.5&&e.phase===1){e.phase=2;emit(s,'warn',{message:`${d.name} 进入第二阶段`});emit(s,'blast',{x:e.x,z:e.z,radius:4,color:'red'});}
  if(e.stun>0)return;e.cooldown-=dt;
  if(e.state==='windup'){e.timer-=dt;if(e.timer<=0)executeEnemyAttack(s,e);return;}
  if(e.state==='recover'){e.timer-=dt;if(e.timer<=0)e.state='move';return;}
  if(e.state==='charge'){e.timer-=dt;move(s,e,Math.sin(e.angle)*17*dt,Math.cos(e.angle)*17*dt);if(dist(e,p)<e.radius+.6)hurtPlayer(s,e.damage,e);if(e.timer<=0){e.state='recover';e.timer=.6;e.cooldown=d.cooldown;}return;}
  const distance=dist(e,p);e.angle=angle(p.x-e.x,p.z-e.z);
  if(e.cooldown<=0&&distance<d.range){planEnemyAttack(s,e);return;}
  let vx=0,vz=0;
  const ranged=['archer','bomber','healer','warden'].includes(e.type),desired=ranged?8:d.boss?3.8:1.55;
  if(distance>desired+.5){const direction=chaseDirection(s,e);vx=direction.x;vz=direction.z;}else if(ranged&&distance<5){vx=-Math.sin(e.angle);vz=-Math.cos(e.angle);}else if(ranged){vx=Math.cos(e.angle)*.65;vz=-Math.sin(e.angle)*.65;}
  for(const o of s.enemies){if(o.id===e.id||o.hp<=0)continue;const distance=dist(e,o);if(distance<e.radius+o.radius+.3&&distance>.01){vx+=(e.x-o.x)/distance*.8;vz+=(e.z-o.z)/distance*.8;}}
  const norm=Math.hypot(vx,vz);if(norm>1){vx/=norm;vz/=norm;}const speed=e.speed*(e.frost>0?.65:1)*(e.phase===2?1.15:1);e.vx=vx*speed;e.vz=vz*speed;move(s,e,e.vx*dt,e.vz*dt);
}
export function tick(s,input={},dt=STEP){
  if(s.status!=='playing')return;s.time+=dt;const p=s.player;p.prevX=p.x;p.prevZ=p.z;const oldDash=p.dash;
  for(const k of ['invuln','dash','attackTimer','attackPose','skillCd','comboTimer'])p[k]=Math.max(0,p[k]-dt);p.stamina=Math.min(p.maxStamina,p.stamina+23*(1+s.mods.regen)*dt);
  let mx=input.x??0,mz=input.z??0;const m=Math.hypot(mx,mz);if(m>1){mx/=m;mz/=m;}const speed=6.4*(1+s.mods.speed)*(p.attackTimer>0&&s.weapon!=='bow'?.7:1);
  const f=1-Math.exp(-20*dt);p.vx+=(mx*speed-p.vx)*f;p.vz+=(mz*speed-p.vz)*f;
  if(p.dash>0)move(s,p,p.dashX*20*dt,p.dashZ*20*dt);else move(s,p,p.vx*dt,p.vz*dt);
  if(input.aim)p.angle=angle(input.aim.x-p.x,input.aim.z-p.z);else if(m>.1&&p.attackPose<=0)p.angle=angle(mx,mz);
  if(oldDash>0&&p.dash===0&&s.mods.dashwave){for(const e of s.enemies)if(e.hp>0&&dist(e,p)<3.5)hurtEnemy(s,e,35*s.mods.dashwave,'skill');emit(s,'blast',{x:p.x,z:p.z,radius:3.5,color:'cyan'});}
  if(s.mods.orbit){p.orbitTimer-=dt;if(p.orbitTimer<=0){p.orbitTimer=2;for(const e of s.enemies)if(e.hp>0&&dist(e,p)<3)hurtEnemy(s,e,16*s.mods.orbit,'orbit',false);emit(s,'blast',{x:p.x,z:p.z,radius:3,color:'cyan'});}}
  for(const e of [...s.enemies])updateEnemy(s,e,dt);
  for(const pr of s.projectiles){if(pr.life<=0)continue;pr.life-=dt;pr.prevX=pr.x;pr.prevZ=pr.z;pr.x+=pr.vx*dt;pr.z+=pr.vz*dt;
    const a={x:pr.prevX,z:pr.prevZ};let blocked=false;
    for(const [x,z,r] of ROOM_LAYOUTS[s.room.layout].props)if(closestPointDistance({x,z},a,pr)<r){blocked=true;break;}
    if(Math.abs(pr.x)>15||Math.abs(pr.z)>14||blocked){pr.life=0;continue;}
    if(pr.owner==='player'){
      for(const e of s.enemies)if(e.hp>0&&!pr.hits.includes(e.id)&&closestPointDistance(e,a,pr)<e.radius+pr.radius){hurtEnemy(s,e,pr.damage,pr.kind??'basic');pr.hits.push(e.id);if(!pr.pierce){pr.life=0;break;}}
      for(const b of s.barrels??[])if(!b.broken&&closestPointDistance(b,a,pr)<.6){breakBarrel(s,b);pr.life=0;}
    }else if(closestPointDistance(p,a,pr)<.48+pr.radius){hurtPlayer(s,pr.damage);pr.life=0;}
  }s.projectiles=s.projectiles.filter(pr=>pr.life>0);
  for(const h of s.hazards){if(h.delay>0){h.delay-=dt;if(h.delay<=0){h.active=true;emit(s,'blast',{x:h.x,z:h.z,radius:h.r,color:'red'});}}else{h.life-=dt;const d=dist(p,h);if(d<h.r&&(h.kind!=='ring'||d>h.inner))hurtPlayer(s,h.damage);}}
  s.hazards=s.hazards.filter(h=>h.delay>0||h.life>0);
  for(const pickup of s.pickups)if(!pickup.used&&dist(p,pickup)<1.3){pickup.used=true;p.hp=Math.min(p.maxHp,p.hp+pickup.amount);emit(s,'heal',{x:p.x,z:p.z});}
  if(s.waveDelay>0){s.waveDelay-=dt;if(s.waveDelay<=0){s.wave++;spawnWave(s);emit(s,'warn',{message:`第 ${s.wave} / ${s.waves} 波守卫已抵达`});}}
  if(!s.cleared&&s.enemies.every(e=>e.hp<=0)&&s.status==='playing'&&s.waveDelay<=0){
    if(['battle','elite'].includes(s.room.type)&&s.wave<s.waves){s.waveDelay=2.2;s.projectiles=[];s.hazards=[];p.stamina=Math.min(p.maxStamina,p.stamina+25);p.hp=Math.min(p.maxHp,p.hp+4);emit(s,'warn',{message:'守卫增援即将抵达 · 趁现在调整位置'});return;}
    s.cleared=true;s.roomsCleared++;s.gold+=15;s.player.hp=Math.min(p.maxHp,p.hp+10);s.projectiles=s.projectiles.filter(pr=>pr.owner==='player');s.hazards=[];
    if(s.stage===9){s.status='victory';emit(s,'finish',{win:true});}
    else{s.rewardLeft=s.room.type==='elite'||s.room.type==='boss'?2:1;s.offers=offerPerks(s);s.status='upgrade';emit(s,'clear');emit(s,'save');}
  }
}
export function nextChoices(s){
  if(s.stage===3||s.stage===8)return[{type:'boss',layout:s.stage===3?12:13}];
  const next=s.stage+1,specialTypes=['shop','event','rest'],specialCount=s.history.filter(r=>specialTypes.includes(r.type)).length;
  const special=specialTypes.includes(s.room.type)||specialCount>=2?(random(s)<.5?'elite':'battle'):next===1?'rest':specialTypes[Math.floor(random(s)*3)];
  const used=new Set(s.history.map(r=>r.layout)),pool=Array.from({length:12},(_,i)=>i).filter(i=>!used.has(i));const layout=()=>pool.length?pool.splice(Math.floor(random(s)*pool.length),1)[0]:Math.floor(random(s)*12);
  return [{type:random(s)<.3?'elite':'battle',layout:layout()},{type:special,layout:specialTypes.includes(special)?10:layout()}];
}
export function interact(s){
  if(s.status!=='playing')return false;const p=s.player;
  if(s.cleared&&p.z<-9&&Math.abs(p.x)<3.5){s.choices=nextChoices(s);s.status='route';emit(s,'route');return true;}
  if(s.room.type==='shop'&&dist(p,{x:0,z:0})<3.2){s.status='shop';emit(s,'shop');return true;}
  if(s.room.type==='rest'&&!s.eventDone&&dist(p,{x:0,z:0})<3.2){s.eventDone=true;p.hp=Math.min(p.maxHp,p.hp+55);p.potions=Math.min(5,p.potions+1);emit(s,'heal',{x:0,z:0});emit(s,'warn',{message:'圣所恢复了 55 生命，并补充一瓶药水'});emit(s,'save');return true;}
  if(s.room.type==='event'&&!s.eventDone&&dist(p,{x:0,z:0})<3.2){s.status='event';emit(s,'event');return true;}
  if(!s.chestUsed&&['battle','elite'].includes(s.room.type)&&dist(p,{x:10,z:8})<2.4){s.status='chest';emit(s,'chest');return true;}
  return false;
}
export function chooseRoute(s,index){if(s.status!=='route'||!s.choices[index])return false;const c=s.choices[index];s.stage++;enterRoom(s,c);s.barrels=makeBarrels(s);emit(s,'save');return true;}
export function makeBarrels(s){return ['battle','elite'].includes(s.room.type)?[{id:1,x:-10,z:3,broken:false},{id:2,x:9,z:-7,broken:false}]:[];}
export function eventChoice(s,risk){if(!['event','chest'].includes(s.status))return false;const chest=s.status==='chest';if(risk&&s.player.hp<=(chest?15:25))return false;if(chest)s.chestUsed=true;else s.eventDone=true;if(risk){s.player.hp-=chest?15:25;if(chest){spawnEnemy(s,'charger',8,6,true);s.cleared=false;s.status='playing';s.gold+=30;emit(s,'warn',{message:'诅咒已唤醒精英守卫，击败它获得额外铭文'});}else{s.rewardLeft=1;s.offers=offerPerks(s);s.status='upgrade';}}else{s.gold+=chest?25:40;s.status='playing';emit(s,'warn',{message:chest?'获得 25 金币':'获得 40 金币'});}emit(s,'save');return true;}
export function buy(s,item){if(s.status!=='shop')return false;const cost=item==='heal'?45:item==='potion'?55:90;if(s.gold<cost)return false;if(item==='heal'&&s.player.hp>=s.player.maxHp)return false;if(!['heal','potion'].includes(item)&&(!s.shopOffers.includes(item)||s.purchased?.includes(item)))return false;s.gold-=cost;if(item==='heal')s.player.hp=Math.min(s.player.maxHp,s.player.hp+60);else if(item==='potion')s.player.potions++;else{applyPerk(s,item);s.purchased??=[];s.purchased.push(item);}emit(s,'save');return true;}
export function serialize(s){return JSON.stringify({...s,events:[],status:['defeat','victory'].includes(s.status)?s.status:s.status});}
export function restore(json){try{const s=JSON.parse(json);if(s.version!==1||!WEAPONS[s.weapon]||!s.player||!Array.isArray(s.enemies)||s.stage<0||s.stage>9||!Number.isFinite(s.player.hp)||!ROOM_LAYOUTS[s.room?.layout])return null;s.events=[];return s;}catch{return null;}}
