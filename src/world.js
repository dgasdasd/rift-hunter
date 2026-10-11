import * as THREE from 'three';
import {WEAPONS,ENEMY_TYPES,ROOM_LAYOUTS} from './data.js';
const C={stone:0x667776,dark:0x263f43,trim:0xadb5a5,gold:0xcba671,jade:0x8de0c2,red:0xf17a60};
const geometry=new Map(),materials=new Map();
function geo(kind,...v){const k=kind+v.join(',');if(!geometry.has(k)){const types={box:THREE.BoxGeometry,cylinder:THREE.CylinderGeometry,sphere:THREE.SphereGeometry,cone:THREE.ConeGeometry,torus:THREE.TorusGeometry,ico:THREE.IcosahedronGeometry};geometry.set(k,new types[kind](...v));}return geometry.get(k);}
function mat(color,metal=.1,rough=.75,emissive=0){const k=[color,metal,rough,emissive].join(',');if(!materials.has(k))materials.set(k,new THREE.MeshStandardMaterial({color,metalness:metal,roughness:rough,emissive,emissiveIntensity:emissive?1.4:0,flatShading:true}));return materials.get(k);}
function mesh(parent,g,m,x=0,y=0,z=0,cast=true){const o=new THREE.Mesh(g,m);o.position.set(x,y,z);o.castShadow=cast;o.receiveShadow=true;parent.add(o);return o;}
function box(parent,x,y,z,w,h,d,m){return mesh(parent,geo('box',w,h,d),m,x,y,z);}
function cylinder(parent,x,y,z,r,h,m,r2=r){return mesh(parent,geo('cylinder',r2,r,h,8),m,x,y,z);}
function ring(parent,r,width,m,y=.06){const o=mesh(parent,geo('torus',r,width,5,64),m,0,y,0,false);o.rotation.x=Math.PI/2;return o;}
function releaseTree(group){const sharedGeometry=new Set(geometry.values()),sharedMaterials=new Set(materials.values()),done=new Set();group.traverse(o=>{if(o.geometry&&!sharedGeometry.has(o.geometry)&&!done.has(o.geometry)){o.geometry.dispose();done.add(o.geometry);}for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[])if(!sharedMaterials.has(m)&&!done.has(m)){m.dispose();done.add(m);}});group.clear();}
function blade(parent){const shape=new THREE.Shape();shape.moveTo(-.12,0);shape.lineTo(-.15,.75);shape.lineTo(0,1.08);shape.lineTo(.15,.75);shape.lineTo(.12,0);const g=new THREE.ExtrudeGeometry(shape,{depth:.06,bevelEnabled:false});const o=mesh(parent,g,mat(0xc8ded7,.7,.28),0,-.02,0);o.rotation.z=Math.PI;box(parent,0,-.06,0,.65,.1,.15,mat(C.gold,.6,.3));cylinder(parent,0,.17,0,.055,.35,mat(C.dark));}
export function makeActor(type,weapon='sword',elite=false,cosmetic=false){
  const root=new THREE.Group(),body=new THREE.Group();root.add(body);
  const player=type==='player',boss=ENEMY_TYPES[type]?.boss,robe=['bomber','healer','warden'].includes(type);const base=player?0x405c67:ENEMY_TYPES[type].color;
  const armor=mat(base,.38,.53),metal=mat(player?0xe1ded0:0xbcb4a2,.58,.36),dark=mat(0x1b3035),gold=mat(C.gold,.6,.38),glow=mat(player?C.jade:C.red,.1,.35,player?C.jade:C.red);
  const torso=mesh(body,geo('cylinder',.33,.43,.68,6),armor,0,1.32,0);box(body,0,1.4,.34,.32,.2,.08,gold);cylinder(body,0,1,0,.32,.18,dark);box(body,0,1.03,.3,.12,.15,.08,gold);
  if(robe){mesh(body,geo('cone',.6,1.05,8),armor,0,.75,0);ring(body,.43,.03,gold,.36);}
  const head=new THREE.Group();head.position.y=1.99;body.add(head);mesh(head,geo('ico',.31,0),metal);box(head,0,0,.26,.38,.1,.1,dark);box(head,0,0,.32,.28,.025,.02,glow);
  if(player){box(head,0,.25,-.06,.1,.3,.35,mat(0x67ba9c));const cape=mesh(body,geo('cone',.46,1.1,4,1,true),mat(cosmetic?0x467964:0x354d55),0,1.11,-.32);cape.rotation.x=-.13;cape.rotation.y=Math.PI/4;root.userData.cape=cape;if(cosmetic){mesh(body,geo('ico',.14,0),glow,0,1.4,.41);ring(head,.34,.025,gold,.3);}}
  if(type==='stalker'){for(const side of [-1,1]){const fin=mesh(head,geo('cone',.09,.35,4),armor,side*.22,.2,-.06);fin.rotation.z=-side*.8;}head.rotation.x=.1;}
  if(type==='archer'){mesh(head,geo('cone',.39,.6,6),mat(0x8e8267),0,.1,-.1).rotation.x=-.15;box(head,0,-.04,.3,.3,.08,.04,glow);}
  if(type==='charger'||boss){for(const side of [-1,1]){const horn=mesh(head,geo('cone',.1,.63,5),gold,side*.28,.24,0);horn.rotation.z=-side*.7;}root.scale.setScalar(boss?2.1:1.2);}
  if(elite&&!boss)root.scale.setScalar(1.25);
  const arms=[],legs=[];
  for(const side of [-1,1]){
    const arm=new THREE.Group();arm.position.set(side*.51,1.57,0);body.add(arm);mesh(arm,geo('ico',.24,0),armor,0,0,0);box(arm,0,-.36,0,.19,.57,.23,dark);box(arm,0,-.32,.035,.25,.23,.27,metal);mesh(arm,geo('ico',.12,0),metal,0,-.64,0);arms.push(arm);
    const leg=new THREE.Group();leg.position.set(side*.19,.94,0);body.add(leg);box(leg,0,-.29,0,.22,.57,.24,dark);box(leg,0,-.42,.08,.26,.25,.2,armor);box(leg,0,-.8,.09,.28,.2,.42,metal);legs.push(leg);
  }
  const held=new THREE.Group();held.position.set(0,-.58,.03);arms[1].add(held);
  if((player&&weapon==='hammer')||type==='sentinel'){cylinder(held,0,-.25,0,.065,.95,dark);box(held,0,-.65,0,.86,.45,.48,metal);box(held,0,-.65,.25,.4,.22,.03,gold);box(held,-.44,-.65,0,.08,.42,.45,gold);box(held,.44,-.65,0,.08,.42,.45,gold);}
  else if((player&&weapon==='bow')||type==='archer'){cylinder(held,0,-.3,0,.045,.85,dark);const bow=mesh(held,geo('torus',.45,.055,4,12,Math.PI),gold,0,-.32,0);bow.rotation.z=Math.PI/2;box(held,0,-.3,.12,.03,.88,.025,glow);}
  else if(robe){cylinder(held,0,.1,0,.05,1.9,gold);mesh(held,geo('ico',.19,0),glow,0,1.1,0);}
  else blade(held);
  if(type==='shield'){const shield=new THREE.Group();shield.position.set(0,-.4,.35);arms[0].add(shield);box(shield,0,0,0,.73,.95,.16,armor);box(shield,0,0,.1,.09,.84,.03,gold);box(shield,0,.2,.1,.62,.08,.03,gold);mesh(shield,geo('ico',.16,0),metal,0,0,.15);}
  if(boss){const halo=mesh(body,geo('torus',.68,.045,4,32),gold,0,2.48,-.22);root.userData.halo=halo;for(const side of [-1,1]){mesh(body,geo('ico',.43,0),armor,side*.53,1.7,0);const spike=mesh(body,geo('cone',.13,.5,4),gold,side*.65,2.03,0);spike.rotation.z=-side*.5;}}
  const shadow=mesh(root,geo('cylinder',.48,.48,.015,24),new THREE.MeshBasicMaterial({color:0x122629,transparent:true,opacity:.2}),0,.013,0,false);
  const hp=new THREE.Group();hp.position.y=boss?2.8:2.5;root.add(hp);const back=box(hp,0,0,0,.86,.07,.03,mat(0x1a282a));const fill=box(hp,0,0,.025,.83,.045,.03,mat(elite?0xefb777:0xe47d6a,0,1,elite?0xc38a52:0x863c2f));hp.visible=!player;
  const debuff=ring(root,.65,.045,new THREE.MeshBasicMaterial({color:C.jade,transparent:true,opacity:.75}),.06);debuff.visible=false;
  root.userData={...root.userData,body,head,arms,legs,held,hp,fill,shadow,debuff,flash:[],baseScale:root.scale.x,type};root.traverse(o=>{if(o.isMesh&&o!==fill&&o!==back)root.userData.flash.push(o);});return root;
}
export class World{
  constructor(canvas,settings){
    this.canvas=canvas;this.settings=settings;this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});this.renderer.setPixelRatio(Math.min(devicePixelRatio,settings.quality==='low'?1:1.6));this.renderer.shadowMap.enabled=settings.quality!=='low';this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.18;
    this.scene=new THREE.Scene();this.scene.background=new THREE.Color(0x19333b);this.scene.fog=new THREE.FogExp2(0x19333b,.014);this.camera=new THREE.PerspectiveCamera(46,1,.1,180);this.camera.position.set(25,24,31);this.camera.lookAt(0,1,-2);
    this.scene.add(new THREE.HemisphereLight(0xbfdedb,0x293d46,2.15));const sun=new THREE.DirectionalLight(0xffd5a1,3.4);sun.position.set(-14,26,9);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-22,right:22,top:22,bottom:-22,near:1,far:70});sun.shadow.normalBias=.04;sun.shadow.bias=-.0002;this.scene.add(sun);this.sun=sun;
    const rim=new THREE.DirectionalLight(0x79b8c7,1.2);rim.position.set(12,10,-20);this.scene.add(rim);
    this.environment=new THREE.Group();this.scene.add(this.environment);this.roomGroup=new THREE.Group();this.scene.add(this.roomGroup);this.actorGroup=new THREE.Group();this.scene.add(this.actorGroup);this.fxGroup=new THREE.Group();this.scene.add(this.fxGroup);this.actors=new Map();this.projectileMeshes=new Map();this.hazardMeshes=new Map();this.warningMeshes=new Map();this.effects=[];this.labels=[];
    this.ray=new THREE.Raycaster();this.ground=new THREE.Plane(new THREE.Vector3(0,1,0),0);this.target=new THREE.Vector3();this.camTarget=new THREE.Vector3();this.yaw=0;this.zoom=1;this.menu=true;this.serial=-1;this.time=0;this.particleCursor=0;
    const particles=geo('ico',.055,0);this.sparks=new THREE.InstancedMesh(particles,new THREE.MeshBasicMaterial({color:C.gold}),128);this.sparks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.scene.add(this.sparks);this.particles=Array.from({length:128},()=>({life:0,x:0,y:0,z:0,vx:0,vy:0,vz:0}));this.dummy=new THREE.Object3D();
    this.makeEnvironment();this.resize();
  }
  makeEnvironment(){
    const stone=mat(C.dark),trim=mat(C.trim),gold=mat(C.gold,.5,.45);
    const base=mesh(this.environment,geo('cylinder',23,19,5,12),stone,0,-3,0);base.rotation.y=.12;
    for(let i=0;i<16;i++){const a=i/16*Math.PI*2,r=31+(i%3)*5;const island=new THREE.Group();island.position.set(Math.sin(a)*r,-5-(i%4)*3,Math.cos(a)*r);island.rotation.y=a;mesh(island,geo('cone',3+(i%3),9,5),stone,0,-5,0).rotation.z=Math.PI;box(island,0,0,0,5,1,5,mat(0x49666a));for(let j=0;j<3;j++)cylinder(island,j*1.6-1.6,1.5,0,.28,3,trim);this.environment.add(island);}
    const arch=new THREE.Group();arch.position.set(0,0,-16);this.environment.add(arch);
    for(const side of [-1,1]){box(arch,side*5,3.8,0,1.8,7.6,1.8,stone);box(arch,side*5,7.3,0,2.5,.4,2.4,trim);box(arch,side*5,.3,0,2.5,.6,2.6,trim);for(let k=0;k<3;k++)box(arch,side*5,2+k*1.7,.94,1.35,.1,.04,gold);}
    const curve=new THREE.EllipseCurve(0,0,5,5,0,Math.PI,false,0);const points=curve.getPoints(24).map(p=>new THREE.Vector3(p.x,p.y+7.3,0));const tube=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),32,.62,6,false);mesh(arch,tube,stone);mesh(arch,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>p.clone().add(new THREE.Vector3(0,0,.62)))),32,.035,4,false),gold);
    const sigil=mesh(arch,geo('torus',2,.075,6,64),mat(C.jade,.3,.4,C.jade),0,7.1,0);const gem=mesh(arch,geo('ico',.7,0),mat(C.jade,.5,.2,C.jade),0,7.1,0);this.envGem=gem;
    for(const x of [-13,13])for(const z of [-11,11]){const lantern=new THREE.Group();lantern.position.set(x,0,z);this.environment.add(lantern);cylinder(lantern,0,.35,0,.5,.7,stone);cylinder(lantern,0,1.4,0,.14,2,gold);cylinder(lantern,0,2.4,0,.5,.13,gold);mesh(lantern,geo('ico',.21,1),mat(0xffba66,.1,.5,0xff9d44),0,2.65,0);const light=new THREE.PointLight(0xffbd7b,65,9,2);light.position.y=2.8;lantern.add(light);}
    const dustGeo=new THREE.BufferGeometry();const positions=[];for(let i=0;i<110;i++)positions.push(Math.sin(i*19.4)*25,2+(i%11),Math.cos(i*14.3)*25);dustGeo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));this.dust=new THREE.Points(dustGeo,new THREE.PointsMaterial({color:0xb7d0bb,size:.05,transparent:true,opacity:.45}));this.scene.add(this.dust);
  }
  rebuild(s){
    this.serial=s.roomSerial;releaseTree(this.roomGroup);releaseTree(this.actorGroup);releaseTree(this.fxGroup);this.actors.clear();this.projectileMeshes.clear();this.hazardMeshes.clear();this.warningMeshes.clear();this.pickupMeshes=new Map();this.effects=[];
    const style=ROOM_LAYOUTS[s.room.layout].style,stone=mat(style%3===0?0x657b77:style%3===1?0x70837e:0x5e7477),dark=mat(C.dark),gold=mat(C.gold,.4,.5);
    const floorG=geo('box',1.96,.26,1.96);const floor=new THREE.InstancedMesh(floorG,stone,210);floor.receiveShadow=true;const dummy=new THREE.Object3D();let i=0;
    for(let z=-13;z<=13;z+=2)for(let x=-14;x<=14;x+=2){dummy.position.set(x,-.18+Math.sin(x*7+z*9)*.012,z);dummy.rotation.set(0,0,0);dummy.updateMatrix();floor.setMatrixAt(i,dummy.matrix);const tone=.82+(Math.sin(x*72+z*84)+1)*.09;floor.setColorAt(i,new THREE.Color(tone,tone,tone));i++;}this.roomGroup.add(floor);
    const lineM=mat(0x7fa597,.3,.7);for(const r of [3.4,6.8,11.5])ring(this.roomGroup,r,.025,lineM,.006);
    const inlays=new THREE.InstancedMesh(geo('box',.16,.016,.72),gold,24);for(let n=0;n<24;n++){const a=n*Math.PI/12;dummy.position.set(Math.sin(a)*6.8,.008,Math.cos(a)*6.8);dummy.rotation.set(0,a,0);dummy.updateMatrix();inlays.setMatrixAt(n,dummy.matrix);}this.roomGroup.add(inlays);
    // Rubble is outside the boundary, so visible walkable space agrees with collision.
    const rubble=new THREE.InstancedMesh(geo('ico',.35,0),dark,36);rubble.castShadow=true;for(let n=0;n<36;n++){const side=n%2?1:-1;dummy.position.set(side*(16.2+(n%3)*.35),.1,-13+(n%18)*1.5);dummy.rotation.set(n,0,n*.6);dummy.scale.setScalar(.5+(n%4)*.2);dummy.updateMatrix();rubble.setMatrixAt(n,dummy.matrix);}this.roomGroup.add(rubble);dummy.scale.setScalar(1);
    if(style%3===1){for(const side of [-1,1]){const banner=new THREE.Group();banner.position.set(side*16.5,0,-6);cylinder(banner,0,3.1,0,.08,6.2,gold);box(banner,side*.8,4.8,0,1.4,2.2,.045,mat(0x3b5f58));box(banner,side*.8,4.8,.035,.1,1.7,.015,gold);this.roomGroup.add(banner);}}
    const border=new THREE.InstancedMesh(geo('box',1.9,.65,1.1),dark,58);border.castShadow=true;border.receiveShadow=true;i=0;
    for(const side of [-1,1])for(let z=-13;z<=13;z+=2){dummy.position.set(side*15.6,.23,z);dummy.rotation.set(0,Math.PI/2,0);dummy.updateMatrix();border.setMatrixAt(i++,dummy.matrix);}
    for(const side of [-1,1])for(let x=-14;x<=14;x+=2){dummy.position.set(x,.23,side*14.8);dummy.rotation.set(0,0,0);dummy.updateMatrix();border.setMatrixAt(i++,dummy.matrix);}this.roomGroup.add(border);
    for(const [x,z,r] of ROOM_LAYOUTS[s.room.layout].props){const g=new THREE.Group();g.position.set(x,0,z);this.roomGroup.add(g);cylinder(g,0,.2,0,r,.4,dark);cylinder(g,0,1.25,0,r*.76,2.1,stone);cylinder(g,0,2.36,0,r*.86,.18,mat(C.trim));for(let j=0;j<4;j++){const a=j*Math.PI/2;box(g,Math.sin(a)*r*.78,1.3,Math.cos(a)*r*.78,.09,1.8,.09,gold);}if(r>1.5){mesh(g,geo('ico',r*.4,0),mat(C.jade,.15,.55),0,2.9,0);}else{const slab=box(g,.1,2.62,0,r*1.5,.35,r*1.4,stone);slab.rotation.z=.12;} }
    // Corner botanical silhouettes have no collision and stay outside the walkable floor.
    for(let j=0;j<10;j++){const g=new THREE.Group();const x=(j%2?1:-1)*(14.8+(j%3)*.2),z=-12+j*2.7;g.position.set(x,0,z);for(let k=0;k<4;k++){const leaf=mesh(g,geo('cone',.18,.85,4),mat(0x496e65),Math.sin(k*2)*.25,.3,Math.cos(k*2)*.25);leaf.rotation.z=Math.sin(k*2)*.7;}this.roomGroup.add(g);}
    this.portal=new THREE.Group();this.portal.position.set(0,.1,-12);this.roomGroup.add(this.portal);ring(this.portal,1.3,.08,mat(C.jade,.1,.3,C.jade));const beam=mesh(this.portal,geo('cylinder',1.25,1.25,3.3,32,1,true),new THREE.MeshBasicMaterial({color:C.jade,transparent:true,opacity:.11,side:THREE.DoubleSide,depthWrite:false}),0,1.7,0,false);this.portal.userData.beam=beam;
    this.chest=new THREE.Group();this.chest.position.set(10,0,8);if(['battle','elite'].includes(s.room.type)){box(this.chest,0,.45,0,1.25,.8,.75,mat(0x725740));box(this.chest,0,.8,0,1.3,.15,.8,gold);for(const x of [-.42,.42])box(this.chest,x,.5,.4,.1,.65,.045,gold);box(this.chest,0,.57,.42,.22,.2,.08,mat(C.jade,.3,.4,C.jade));this.roomGroup.add(this.chest);}
    this.barrelMeshes=new Map();for(const b of s.barrels??[]){const g=new THREE.Group();g.position.set(b.x,0,b.z);cylinder(g,0,.55,0,.48,1.1,mat(0x89694e));for(const y of [.14,.9])cylinder(g,0,y,0,.51,.11,gold);mesh(g,geo('ico',.13,0),mat(C.red,.1,.5,C.red),0,1.13,0);this.roomGroup.add(g);this.barrelMeshes.set(b.id,g);}
    this.altar=null;
    if(['shop','rest','event'].includes(s.room.type)){
      const g=new THREE.Group();this.roomGroup.add(g);this.altar=g;cylinder(g,0,.2,0,1.6,.4,dark);cylinder(g,0,.6,0,.9,.6,stone);ring(g,1.35,.06,gold,.45);mesh(g,geo('ico',s.room.type==='shop'?.5:.7,0),mat(s.room.type==='event'?0xc9b6df:C.jade,.5,.3,s.room.type==='event'?0x927fa7:C.jade),0,1.7,0);if(s.room.type==='shop'){const merchant=makeActor('healer');merchant.position.set(2,0,-.5);g.add(merchant);}
    }
    this.player=makeActor('player',s.weapon,false,s.cosmetic);this.actorGroup.add(this.player);
    const cursor=mesh(this.roomGroup,geo('torus',.35,.035,4,24),new THREE.MeshBasicMaterial({color:0xb1e8d5,transparent:true,opacity:.7}),0,.04,0,false);cursor.rotation.x=Math.PI/2;this.cursor=cursor;
  }
  aim(clientX,clientY){this.ray.setFromCamera(new THREE.Vector2(clientX/innerWidth*2-1,-clientY/innerHeight*2+1),this.camera);const hit=this.ray.ray.intersectPlane(this.ground,this.target);return hit?{x:hit.x,z:hit.z}:null;}
  resize(){const w=innerWidth,h=innerHeight;this.renderer.setSize(w,h,false);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();}
  quality(q){this.settings.quality=q;this.renderer.setPixelRatio(Math.min(devicePixelRatio,q==='low'?1:q==='high'?1.8:1.4));this.renderer.shadowMap.enabled=q!=='low';this.sun.shadow.mapSize.set(q==='high'?2048:1024,q==='high'?2048:1024);this.sun.shadow.map?.dispose();this.sun.shadow.map=null;this.resize();}
  spark(x,z,color,count=12){for(let i=0;i<count;i++){const p=this.particles[this.particleCursor++%128];Object.assign(p,{x,y:.9,z,vx:(Math.random()-.5)*5,vy:2+Math.random()*3,vz:(Math.random()-.5)*5,life:.3+Math.random()*.3,color});}}
  event(e){
    if(['hit','kill','block'].includes(e.type))this.spark(e.x,e.z,e.type==='kill'?C.gold:C.jade,e.type==='kill'?18:7);
    if(['blast','heal','dash','slash','enemySlash','chain'].includes(e.type)){
      let g,m,o;const color=e.color==='red'||e.type==='enemySlash'?C.red:e.color==='gold'?C.gold:C.jade;
      m=new THREE.MeshBasicMaterial({color,transparent:true,opacity:.75,side:THREE.DoubleSide,depthWrite:false});
      if(e.type==='chain'){g=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(e.x,1,e.z),new THREE.Vector3((e.x+e.tx)/2,.8,(e.z+e.tz)/2),new THREE.Vector3(e.tx,1,e.tz)]);o=new THREE.Line(g,new THREE.LineBasicMaterial({color:C.jade,transparent:true,opacity:1}));}
      else if(e.type==='slash'||e.type==='enemySlash'){g=new THREE.RingGeometry((e.radius??3)*.72,e.radius??3,28,1,0,Math.PI*.8);o=new THREE.Mesh(g,m);o.rotation.x=-Math.PI/2;o.rotation.z=(e.angle??0)-Math.PI*.9;o.position.set(e.x,.35,e.z);}
      else {g=new THREE.RingGeometry(.8,1,40);o=new THREE.Mesh(g,m);o.rotation.x=-Math.PI/2;o.position.set(e.x,.08,e.z);}
      this.fxGroup.add(o);this.effects.push({mesh:o,time:0,life:e.type==='chain'?.2:e.type==='slash'?.2:.48,radius:e.radius??2,type:e.type});
    }
  }
  updateActor(actor,e,dt,isPlayer=false,alpha=1){
    const u=actor.userData;actor.position.set((e.prevX??e.x)+(e.x-(e.prevX??e.x))*alpha,0,(e.prevZ??e.z)+(e.z-(e.prevZ??e.z))*alpha);const d= Math.atan2(Math.sin(e.angle-actor.rotation.y),Math.cos(e.angle-actor.rotation.y));actor.rotation.y+=d*(1-Math.exp(-24*dt));
    const moving=Math.hypot(e.vx??0,e.vz??0)>.2&&e.state!=='windup';const stride=moving?Math.sin(this.time*12)*.5:0;u.legs[0].rotation.x=stride;u.legs[1].rotation.x=-stride;u.arms[0].rotation.x=-stride*.5;u.arms[1].rotation.x=stride*.5;
    u.body.position.y=moving?Math.abs(Math.sin(this.time*12))*.035:Math.sin(this.time*2)*.018;
    if(isPlayer&&e.attackPose>0){const progress=1-e.attackPose/(e.heavyPose?.5:.3);u.arms[1].rotation.x=-1.2-Math.sin(progress*Math.PI)*1.8;u.arms[1].rotation.z=-.4+Math.sin(progress*Math.PI)*1.1;u.body.rotation.y=Math.sin(progress*Math.PI)*-.35;}else if(e.state==='windup'){u.arms[1].rotation.x=-2.1;u.arms[0].rotation.x=-.8;u.body.rotation.x=-.12;}else{u.arms[1].rotation.z=0;u.body.rotation.set(0,0,0);}
    if(u.cape)u.cape.rotation.x=-.13+(moving?Math.sin(this.time*9)*.08:0);if(u.halo)u.halo.rotation.z=this.time*.3;
    const scale=u.baseScale*(e.hp<=0?Math.max(.001,e.death*2):1);actor.scale.setScalar(scale);actor.visible=e.hp>0||e.death>.02;
    if(!isPlayer){u.fill.scale.x=Math.max(.001,e.hp/e.maxHp);u.fill.position.x=-(1-u.fill.scale.x)*.415;u.hp.quaternion.copy(this.camera.quaternion).premultiply(actor.quaternion.clone().invert());u.hp.visible=e.hp>0;u.debuff.visible=e.hp>0&&(e.frost>0||e.poisonTimer>0);u.debuff.material.color.setHex(e.frost>0?0x9fc9ff:C.jade);}
    // Material emissive state is shared; flash is expressed as a short scale pulse instead.
    if(e.hitFlash>0)u.body.scale.setScalar(1+e.hitFlash*.35);else u.body.scale.setScalar(1);
  }
  render(s,dt,menu=false,alpha=1){
    this.time+=dt;this.menu=menu;if(s.roomSerial!==this.serial)this.rebuild(s);
    this.updateActor(this.player,s.player,dt,true,alpha);
    for(const e of s.enemies){let a=this.actors.get(e.id);if(!a){a=makeActor(e.type,s.weapon,e.elite);this.actorGroup.add(a);this.actors.set(e.id,a);}this.updateActor(a,e,dt,false,alpha);
      let warning=this.warningMeshes.get(e.id);if(!warning){warning=new THREE.Group();const m=new THREE.MeshBasicMaterial({color:C.red,transparent:true,opacity:.18,side:THREE.DoubleSide,depthWrite:false});const sector=new THREE.Mesh(new THREE.CircleGeometry(1,32,Math.PI*1.1,Math.PI*.8),m);sector.rotation.x=-Math.PI/2;warning.add(sector);const line=new THREE.Mesh(geo('box',1,.015,1),m);warning.add(line);const fan=new THREE.Mesh(new THREE.CircleGeometry(1,32,Math.PI*1.28,Math.PI*.44),m);fan.rotation.x=-Math.PI/2;warning.add(fan);warning.userData={sector,line,fan};this.roomGroup.add(warning);this.warningMeshes.set(e.id,warning);}
      const kind=e.attackKind;warning.visible=e.hp>0&&e.state==='windup'&&!['meteor','bomber','slam','healer','summon','ring'].includes(kind);warning.position.set(e.x,.025,e.z);warning.rotation.y=e.angle;
      const line=['archer','charger','charge'].includes(kind);warning.userData.sector.visible=!line&&kind!=='fan';warning.userData.line.visible=line;warning.userData.fan.visible=kind==='fan';warning.userData.fan.scale.setScalar(30);const radius=ENEMY_TYPES[e.type].range+.7;warning.userData.sector.scale.setScalar(radius);
      if(line){const length=kind==='archer'||kind==='fan'?14:11,width=kind==='archer'?.28:kind==='fan'?7:2.4;warning.userData.line.scale.set(width,1,length);warning.userData.line.position.z=length/2;}
    }
    for(const p of s.pickups){let m=this.pickupMeshes.get(p.id);if(!m){m=new THREE.Group();mesh(m,geo('ico',.22,0),mat(C.jade,.1,.4,C.jade),0,.45,0,false);ring(m,.4,.03,mat(C.jade,.1,.4,C.jade));this.roomGroup.add(m);this.pickupMeshes.set(p.id,m);}m.visible=!p.used;m.position.set(p.x,0,p.z);m.rotation.y=this.time;m.children[0].position.y=.45+Math.sin(this.time*3)*.12;}
    const actorIds=new Set(s.enemies.map(e=>e.id));for(const [id,a] of this.actors)if(!actorIds.has(id)){this.actorGroup.remove(a);releaseTree(a);this.actors.delete(id);const warning=this.warningMeshes.get(id);if(warning){this.roomGroup.remove(warning);releaseTree(warning);this.warningMeshes.delete(id);}}
    for(const p of s.projectiles){let m=this.projectileMeshes.get(p.id);if(!m){m=mesh(this.fxGroup,geo('sphere',p.radius,6,4),mat(p.owner==='player'?C.jade:C.red,.2,.4,p.owner==='player'?C.jade:C.red));this.projectileMeshes.set(p.id,m);}m.position.set(p.x,.9,p.z);m.scale.set(1,1,2.4);m.rotation.y=Math.atan2(p.vx,p.vz);}
    const pids=new Set(s.projectiles.map(p=>p.id));for(const [id,m] of this.projectileMeshes)if(!pids.has(id)){this.fxGroup.remove(m);this.projectileMeshes.delete(id);}
    for(const h of s.hazards){let m=this.hazardMeshes.get(h.id);if(!m){const g=h.kind==='ring'?new THREE.RingGeometry(h.inner,h.r,64):new THREE.CircleGeometry(h.r,48);m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({color:C.red,transparent:true,opacity:.16,side:THREE.DoubleSide,depthWrite:false}));m.rotation.x=-Math.PI/2;this.fxGroup.add(m);const outline=ring(m,h.r,.045,new THREE.MeshBasicMaterial({color:C.red}),0);outline.rotation.x=0;this.hazardMeshes.set(h.id,m);}m.position.set(h.x,.025,h.z);m.material.opacity=h.active?.7:.13+(1-h.delay/h.totalDelay)*.23;}
    const hids=new Set(s.hazards.map(h=>h.id));for(const [id,m] of this.hazardMeshes)if(!hids.has(id)){this.fxGroup.remove(m);m.geometry.dispose();m.material.dispose();m.children.forEach(c=>c.material.dispose());this.hazardMeshes.delete(id);}
    for(const b of s.barrels??[]){const m=this.barrelMeshes.get(b.id);if(m)m.visible=!b.broken;}
    this.portal.visible=s.cleared;this.portal.rotation.y=this.time*.3;if(this.chest)this.chest.visible=!s.chestUsed;
    if(this.altar){const crystal=this.altar.children.find(o=>o.geometry?.type==='IcosahedronGeometry');if(crystal){crystal.rotation.y=this.time*.5;crystal.position.y=1.7+Math.sin(this.time*2)*.1;}}
    for(const fx of this.effects){fx.time+=dt;const t=fx.time/fx.life;fx.mesh.material.opacity=Math.max(0,(1-t)*.8);if(!['slash','enemySlash','chain'].includes(fx.type))fx.mesh.scale.setScalar(fx.radius*(.3+t*.7));if(t>=1){this.fxGroup.remove(fx.mesh);fx.mesh.geometry.dispose();fx.mesh.material.dispose();}}
    this.effects=this.effects.filter(fx=>fx.time<fx.life);
    for(let i=0;i<this.particles.length;i++){const p=this.particles[i];p.life-=dt;if(p.life>0){p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;p.vy-=12*dt;this.dummy.position.set(p.x,p.y,p.z);this.dummy.scale.setScalar(Math.min(1,p.life*3));this.sparks.setColorAt(i,new THREE.Color(p.color));}else this.dummy.scale.setScalar(0);this.dummy.updateMatrix();this.sparks.setMatrixAt(i,this.dummy.matrix);}this.sparks.instanceMatrix.needsUpdate=true;if(this.sparks.instanceColor)this.sparks.instanceColor.needsUpdate=true;
    if(!this.settings.reducedMotion){this.envGem.rotation.y=this.time*.25;this.dust.rotation.y=this.time*.006;}
    if(menu){this.camTarget.set(22,22,29);this.camera.position.lerp(this.camTarget,1-Math.exp(-2*dt));this.camera.lookAt(1,1,-2);}
    else{const mobile=innerWidth<700;const distance=(mobile?20:19)*this.zoom;this.camTarget.set(s.player.x+Math.sin(this.yaw)*distance,s.player.hp>0?20*this.zoom:23,s.player.z+Math.cos(this.yaw)*distance);this.camera.position.lerp(this.camTarget,1-Math.exp(-7*dt));this.camera.lookAt(s.player.x,0,s.player.z-1.5);}
    this.renderer.render(this.scene,this.camera);
  }
  project(x,z,y=2.6){const v=new THREE.Vector3(x,y,z).project(this.camera);return {x:(v.x*.5+.5)*innerWidth,y:(-v.y*.5+.5)*innerHeight,visible:v.z<1};}
}
