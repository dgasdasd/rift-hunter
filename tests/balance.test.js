import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {BALANCE} from '../src/data.js';
import {createRun,spawnEnemy,hurtEnemy,hurtPlayer,action,tick,STEP,applyPerk,offerPerks,buy,serialize,restore,enemyStats} from '../src/simulation.js';
function arena(weapon='sword'){const s=createRun(weapon,42);s.enemies=[];s.barrels=[];s.cleared=true;s.events=[];s.player.x=0;s.player.z=4;return s;}
function step(s,time){for(let n=0;n<Math.ceil(time/STEP);n++)tick(s,{},STEP);}

test('opening enemies take a readable sword combo and bosses use authored health without double scaling',()=>{
  const s=arena(),e=spawnEnemy(s,'stalker',0,2);e.speed=0;e.cooldown=100;
  for(let i=0;i<3;i++){s.player.attackTimer=0;assert(action(s,'attack',{x:0,z:2}));if(i<2)assert(e.hp>0);}assert.equal(e.hp,0);
  s.stage=4;assert.equal(enemyStats(s,'sentinel').hp,950);s.stage=9;assert.equal(enemyStats(s,'warden').hp,1450);assert.equal(enemyStats(s,'warden').damage,24);
  s.player.invuln=0;hurtPlayer(s,24);assert.equal(s.player.hp,76);
});
test('overkill cannot turn one remaining enemy health into a large heal or inflated damage number',()=>{
  const s=arena();s.player.hp=40;applyPerk(s,'leech');const e=spawnEnemy(s,'stalker',0,2);e.hp=1;
  hurtEnemy(s,e,10000);assert(Math.abs(s.player.hp-40.02)<1e-8);assert.equal(s.damageDealt,1);assert.equal(s.events.find(e=>e.type==='hit').amount,1);
});
test('damage bonuses add together instead of multiplying into an explosive stack',()=>{
  const s=arena();for(const id of ['power','heavy','elite','execute'])for(let i=0;i<3;i++)applyPerk(s,id);applyPerk(s,'blood');s.player.hp=30;
  const e=spawnEnemy(s,'warden',0,2);e.hp=1000;e.maxHp=5000;hurtEnemy(s,e,50,'heavy',false);assert(Math.abs(e.hp-817)<1e-8);
});
test('bow fan cannot hit the same boss more than twice even at point blank',()=>{
  const s=arena('bow'),e=spawnEnemy(s,'warden',0,3);e.speed=0;e.cooldown=100;
  assert(action(s,'skill',{x:0,z:3}));step(s,.5);assert.equal(e.maxHp-e.hp,60);assert.equal(s.events.filter(e=>e.type==='hit').length,2);
  step(s,1);assert.equal(Object.keys(s.projectileGroups).length,0);
});
test('saving a volley retains its per-target hit limit',()=>{
  const s=arena('bow'),e=spawnEnemy(s,'warden',0,3);e.speed=0;e.cooldown=100;action(s,'skill',{x:0,z:3});const group=s.projectiles[0].groupId;s.projectileGroups[group].hits[e.id]=1;
  const resumed=restore(serialize(s));step(resumed,.5);assert.equal(resumed.enemies[0].maxHp-resumed.enemies[0].hp,30);
});
test('unique and max-level runes stop being offered and cannot charge a shop customer',()=>{
  const s=arena();assert(applyPerk(s,'frost'));assert.equal(applyPerk(s,'frost'),false);assert(!offerPerks(s,30).includes('frost'));
  for(let i=0;i<3;i++)assert(applyPerk(s,'power'));assert.equal(applyPerk(s,'power'),false);
  s.status='shop';s.shopOffers=['frost','power'];s.gold=200;assert.equal(buy(s,'power'),false);assert.equal(buy(s,'frost'),false);assert.equal(s.gold,200);
});
test('shop prices, stock, potion cap and healing follow the same rules',()=>{
  const s=arena();s.status='shop';s.shopOffers=[];s.gold=100;s.player.hp=25;
  assert(buy(s,'heal'));assert.equal(s.player.hp,60);assert.equal(s.gold,75);assert.equal(buy(s,'heal'),false);
  assert(buy(s,'potion'));assert.equal(s.player.potions,3);assert.equal(s.gold,40);assert.equal(buy(s,'potion'),false);
  s.purchased=[];s.player.potions=4;assert.equal(buy(s,'potion'),false);assert.equal(s.gold,40);
  s.player.potions=1;action(s,'potion');assert.equal(s.player.hp,60);s.status='playing';assert(action(s,'potion'));assert.equal(s.player.hp,95);
});
test('attacking and dashing do not allow full-speed passive stamina recovery',()=>{
  const s=arena();s.player.stamina=0;step(s,1);assert(Math.abs(s.player.stamina-18)<.001);
  s.player.stamina=0;s.player.attackTimer=2;step(s,1);assert(Math.abs(s.player.stamina-10.8)<.001);
  s.player.stamina=100;action(s,'dash');step(s,.15);assert.equal(s.player.stamina,76);
});
test('an actual pre-balance save migrates once, keeping progress, gold and health percentage',()=>{
  const old=readFileSync(new URL('./fixtures/pre-balance-save.json',import.meta.url),'utf8');const s=restore(old);assert(s);
  assert.equal(s.balanceVersion,BALANCE.version);assert.equal(s.stage,9);assert.equal(s.gold,500);assert.equal(s.player.maxHp,130);assert.equal(s.player.hp,65);assert.equal(s.enemies[0].maxHp,1450);assert.equal(s.enemies[0].hp,580);
  assert.equal(s.perks.filter(id=>id==='frost').length,1);assert.equal(s.mods.leech,.02);assert.equal(serialize(restore(serialize(s))),serialize(s));
});
test('migration preserves a nearly defeated player and already scheduled reinforcements',()=>{
  const old=JSON.parse(readFileSync(new URL('./fixtures/pre-balance-save.json',import.meta.url),'utf8'));old.player.hp=.1;old.stage=1;old.room={type:'battle',layout:0};old.wave=2;old.waves=3;old.waveDelay=.2;old.enemies=[];
  const s=restore(JSON.stringify(old));assert.equal(s.player.hp,1);assert.equal(s.waves,3);step(s,.3);assert.equal(s.wave,3);assert(s.wave<=s.waves);
});
test('legacy fan projectiles migrate into one volley with a per-target hit cap',()=>{
  const old=JSON.parse(readFileSync(new URL('./fixtures/pre-balance-save.json',import.meta.url),'utf8'));old.weapon='bow';old.player.x=0;old.player.z=4;old.stage=0;old.room={type:'boss',layout:13};old.perks=[];old.enemies=[];
  old.projectiles=Array.from({length:7},(_,i)=>({id:old.nextId++,owner:'player',x:0,z:4,prevX:0,prevZ:4,vx:Math.sin((i-3)*.17)*23,vz:-Math.cos((i-3)*.17)*23,damage:48,life:1.3,radius:.22,pierce:true,hits:[],color:'gold',kind:'skill'}));
  const s=restore(JSON.stringify(old));s.cleared=true;const e=spawnEnemy(s,'warden',0,3);e.speed=0;e.cooldown=100;step(s,.5);assert.equal(e.maxHp-e.hp,60);
});
