import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {makeActor,World} from '../src/world.js';
import {createRun,action,tick,STEP,restore,serialize} from '../src/simulation.js';

function renderPose(actor,player){actor.rotation.y=player.angle;World.prototype.updateActor.call({time:0},actor,player,1/60,true,1);actor.updateMatrixWorld(true);return actor.userData.held.localToWorld(new THREE.Vector3(0,-1.1,0));}
test('three sword combos move the actual blade through different sweeps and recover their joints',()=>{
  const tips=[];
  for(let combo=0;combo<3;combo++){
    const s=createRun(),p=s.player,actor=makeActor('player','sword');p.combo=combo===0?0:combo-1;p.comboTimer=combo===0?0:1;
    const guard=renderPose(actor,p);assert(action(s,'attack'));const samples=[];
    for(const progress of [.18,.44,.64,.99]){p.attackPose=p.attackPoseDuration*(1-progress);samples.push(renderPose(actor,p).clone());}
    assert(samples[0].distanceTo(samples[1])>.8,'weapon must travel through a visible strike');assert(samples[1].distanceTo(samples[2])>.2,'follow-through must move');
    p.attackPose=0;const recovered=renderPose(actor,p);assert(guard.distanceTo(recovered)<1e-6);assert.equal(actor.userData.body.rotation.x,0);assert.equal(actor.userData.arms[1].rotation.y,0);assert.equal(actor.userData.elbows[1].rotation.x,-.25);
    tips.push(samples[0]);
  }
  assert(tips[0].distanceTo(tips[1])>1);assert(tips[1].distanceTo(tips[2])>1);
});
test('attack animation uses its real duration under haste and survives saving mid-swing',()=>{
  for(const weapon of ['sword','hammer','bow'])for(const name of ['attack','heavy','skill']){
    const s=createRun(weapon),actor=makeActor('player',weapon);s.mods.haste=2;assert(action(s,name));assert(s.player.attackPoseDuration<=s.player.attackTimer);assert(s.player.attackPoseDuration>0);
    tick(s,{},STEP);const restored=restore(serialize(s));assert.equal(restored.player.attackPoseDuration,s.player.attackPoseDuration);
    const a=renderPose(actor,s.player),b=renderPose(makeActor('player',weapon),restored.player);assert(a.distanceTo(b)<1e-6);
    const remaining=s.player.attackTimer;for(let i=0;i<Math.ceil(remaining/STEP)+1;i++)tick(s,{},STEP);assert.equal(s.player.attackPose,0);
  }
});
test('old saves without animation metadata still render and a full sword spin returns to guard',()=>{
  const actor=makeActor('player'),s=createRun();action(s,'heavy');delete s.player.attackPoseDuration;delete s.player.attackVariant;const p=restore(serialize(s)).player;assert(Number.isFinite(renderPose(actor,p).x));
  const skill=createRun();action(skill,'skill');skill.player.attackPose=skill.player.attackPoseDuration*.01;renderPose(actor,skill.player);assert(Math.abs(actor.userData.head.rotation.y)<1e-5);
  const nearly=actor.userData.body.quaternion.clone();skill.player.attackPose=0;renderPose(actor,skill.player);assert(nearly.angleTo(actor.userData.body.quaternion)<.005);
});
