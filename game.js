import * as THREE from 'three';

// ============================================================ STARFALL
const canvas = document.getElementById('game');
const $ = id => document.getElementById(id);
const hud=$('hud'), dmgNums=$('dmgNums'), toastEl=$('toast');

const CLASSES = {
  strider:{ name:'STRIDER', sub:'HUNTER', hp:100, shield:100, speed:8.2, jump:8.2, jumps:3, reloadMul:0.7, abilMul:0.9, superName:'GOLDEN GUN', superDesc:'3 solar precision shots', color:0x7df9ff },
  bulwark:{ name:'BULWARK', sub:'TITAN', hp:150, shield:110, speed:6.8, jump:7.2, jumps:2, reloadMul:1.0, abilMul:1.0, superName:'FIST OF HAVOC', superDesc:'devastating arc slam', color:0x9d6bff },
  arcanist:{ name:'ARCANIST', sub:'WARLOCK', hp:100, shield:100, speed:7.2, jump:7.6, jumps:2, glide:true, reloadMul:0.9, abilMul:0.6, superName:'NOVA BOMB', superDesc:'void vortex nuke', color:0xf5c542 },
};
const WEAPONS = [
  { name:'KHVOSTOK-7 AUTO RIFLE', type:'KINETIC • AUTO', dmg:13, headMul:2.0, rpm:540, mag:30, reserve:240, auto:true, spread:0.018, adsSpread:0.004, reload:1.5, range:120, kick:0.011, tracer:0x7df9ff, sound:'rifle' },
  { name:'DUSTOFFER HAND CANNON', type:'SOLAR • PRECISION', dmg:46, headMul:2.2, rpm:170, mag:8, reserve:72, auto:false, spread:0.008, adsSpread:0.001, reload:1.4, range:140, kick:0.035, tracer:0xffb35d, sound:'cannon' },
  { name:'TRUTHSEEKER ROCKET', type:'VOID • HEAVY 💥', dmg:165, headMul:1.3, rpm:45, mag:2, reserve:10, auto:false, spread:0.01, adsSpread:0.004, reload:2.6, range:200, kick:0.07, splash:7.5, tracer:0xc77dff, sound:'rocket' },
];
const ENEMY_DEFS = {
  thrall:  { hp:55,  speed:6.2, dmg:12, score:100, glimmer:15, scale:1,   color:0xff3b5c, ranged:false, name:'Husk Thrall' },
  acolyte: { hp:85,  speed:3.8, dmg:9,  score:150, glimmer:25, scale:1.1, color:0xff8a3d, ranged:true,  name:'Husk Acolyte', fireCd:2.4 },
  knight:  { hp:260, speed:2.9, dmg:20, score:300, glimmer:50, scale:1.55,color:0x9d6bff, ranged:true,  name:'Husk Knight', fireCd:3.2 },
  warden:  { hp:2400,speed:2.4, dmg:30, score:5000,glimmer:1000,scale:2.6,color:0xff2222, ranged:true,  name:'WARDEN OF THE DARK', fireCd:1.6 },
};

// ---------------- audio (procedural, no assets) ----------------
const AudioSys = {
  ctx:null, master:null, muted:false, vol:0.5,
  init(){ if(this.ctx) return; try{ this.ctx=new (window.AudioContext||window.webkitAudioContext)(); this.master=this.ctx.createGain(); this.master.gain.value=this.vol; this.master.connect(this.ctx.destination);}catch(e){} },
  setVol(v){ this.vol=v; if(this.master) this.master.gain.value=this.muted?0:v; },
  toggleMute(){ this.muted=!this.muted; if(this.master) this.master.gain.value=this.muted?0:this.vol; return this.muted; },
  blip(freq=440,dur=0.08,type='square',vol=0.25,slide=0){ if(!this.ctx||this.muted) return; const t=this.ctx.currentTime; const o=this.ctx.createOscillator(),g=this.ctx.createGain(); o.type=type;o.frequency.setValueAtTime(freq,t); if(slide) o.frequency.exponentialRampToValueAtTime(Math.max(30,freq+slide),t+dur); g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(0.001,t+dur); o.connect(g);g.connect(this.master); o.start(t);o.stop(t+dur+0.02); },
  noise(dur=0.2,vol=0.3,low=400,high=4000){ if(!this.ctx||this.muted) return; const t=this.ctx.currentTime; const len=this.ctx.sampleRate*dur; const buf=this.ctx.createBuffer(1,len,this.ctx.sampleRate); const d=buf.getChannelData(0); for(let i=0;i<len;i++) d[i]=(Math.random()*2-1)*(1-i/len); const s=this.ctx.createBufferSource(); s.buffer=buf; const f=this.ctx.createBiquadFilter(); f.type='bandpass'; f.frequency.value=(low+high)/2; f.Q.value=0.7; const g=this.ctx.createGain(); g.gain.value=vol; s.connect(f);f.connect(g);g.connect(this.master); s.start(t); },
  shoot(kind){ if(kind==='rifle'){this.noise(0.09,0.35,900,5000);this.blip(180,0.07,'sawtooth',0.18,-90);} else if(kind==='cannon'){this.noise(0.16,0.5,200,2500);this.blip(120,0.14,'square',0.3,-60);} else if(kind==='rocket'){this.noise(0.5,0.5,80,900);this.blip(70,0.4,'sawtooth',0.35,40);} else if(kind==='enemy'){this.blip(520,0.15,'sawtooth',0.12,-260);} },
  hit(){this.blip(1150,0.05,'square',0.12);}, crit(){this.blip(1600,0.07,'square',0.16);this.blip(2200,0.06,'square',0.1);},
  hurt(){this.noise(0.2,0.4,150,800);this.blip(90,0.25,'sawtooth',0.3,-30);},
  reload(){this.blip(500,0.06,'square',0.15);setTimeout(()=>this.blip(750,0.06,'square',0.15),120);},
  boom(){this.noise(0.7,0.7,40,500);this.blip(55,0.6,'sine',0.5,-20);},
  pickup(){this.blip(880,0.08,'sine',0.2,440);}, super(){this.blip(200,0.5,'sawtooth',0.3,800);this.noise(0.4,0.3,300,3000);},
  wave(){[330,415,494,660].forEach((f,i)=>setTimeout(()=>this.blip(f,0.18,'triangle',0.22),i*110));},
  empty(){this.blip(220,0.06,'square',0.15);},
};

// ---------------- renderer / scene ----------------
const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, powerPreference:'high-performance' });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x060a18);
scene.fog = new THREE.FogExp2(0x0a1228, 0.012);
const camera = new THREE.PerspectiveCamera(78, innerWidth/innerHeight, 0.08, 600);
camera.rotation.order='YXZ';

scene.add(new THREE.HemisphereLight(0x9fc0ff, 0x2a1a3e, 1.35));
const sun = new THREE.DirectionalLight(0xcfe4ff, 2.2);
sun.position.set(-40,60,25); sun.castShadow=true;
sun.shadow.mapSize.set(1024,1024);
sun.shadow.camera.left=-70;sun.shadow.camera.right=70;sun.shadow.camera.top=70;sun.shadow.camera.bottom=-70;sun.shadow.camera.far=200;
scene.add(sun);
const magenta = new THREE.PointLight(0x9d6bff, 60, 90); magenta.position.set(20,12,-20); scene.add(magenta);
const cyanPt = new THREE.PointLight(0x33e0ff, 50, 80); cyanPt.position.set(-18,10,18); scene.add(cyanPt);
const beaconLight = new THREE.PointLight(0x7df9ff, 80, 60); beaconLight.position.set(0,6,0); scene.add(beaconLight);
const muzzleLight = new THREE.PointLight(0xffd28a, 0, 18); scene.add(muzzleLight);
const fill = new THREE.PointLight(0xbfd9ff, 12, 30); camera.add(fill); fill.position.set(0,0.5,0.5);

// stars
{
  const g=new THREE.BufferGeometry(); const N=1400; const pos=new Float32Array(N*3);
  for(let i=0;i<N;i++){ const r=480, th=Math.random()*Math.PI*2, ph=Math.acos(Math.random()*0.95); pos[i*3]=r*Math.sin(ph)*Math.cos(th); pos[i*3+1]=r*Math.cos(ph)+10; pos[i*3+2]=r*Math.sin(ph)*Math.sin(th); }
  g.setAttribute('position', new THREE.BufferAttribute(pos,3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({color:0xaac8ff,size:1.6,sizeAttenuation:false,transparent:true,opacity:0.9})));
}
// giant planet + traveler
{
  const planet=new THREE.Mesh(new THREE.SphereGeometry(160,32,32), new THREE.MeshBasicMaterial({color:0x2a1a5e,fog:false}));
  planet.position.set(180,60,-380); scene.add(planet);
  const ring=new THREE.Mesh(new THREE.RingGeometry(190,250,64), new THREE.MeshBasicMaterial({color:0x9d6bff,transparent:true,opacity:0.28,side:THREE.DoubleSide,fog:false}));
  ring.position.copy(planet.position); ring.rotation.x=1.2; scene.add(ring);
  const trav=new THREE.Mesh(new THREE.SphereGeometry(38,48,48), new THREE.MeshStandardMaterial({color:0xdfeaff,emissive:0x8fb8ff,emissiveIntensity:0.55,roughness:0.35,metalness:0.1}));
  trav.position.set(-90,95,-190); scene.add(trav);
  window._traveler=trav;
  const glow=new THREE.Mesh(new THREE.SphereGeometry(42,32,32), new THREE.MeshBasicMaterial({color:0x7df9ff,transparent:true,opacity:0.14,fog:false}));
  glow.position.copy(trav.position); scene.add(glow);
}

// ground texture via canvas
function groundTexture(){
  const c=document.createElement('canvas'); c.width=c.height=512; const x=c.getContext('2d');
  x.fillStyle='#141c30'; x.fillRect(0,0,512,512);
  for(let i=0;i<2600;i++){ x.fillStyle=`rgba(${20+Math.random()*40|0},${30+Math.random()*50|0},${60+Math.random()*60|0},${0.25+Math.random()*0.4})`; const s=1+Math.random()*3; x.fillRect(Math.random()*512,Math.random()*512,s,s); }
  x.strokeStyle='rgba(125,249,255,0.10)'; x.lineWidth=2;
  for(let i=0;i<=4;i++){ x.beginPath();x.moveTo(i*128,0);x.lineTo(i*128,512);x.stroke(); x.beginPath();x.moveTo(0,i*128);x.lineTo(512,i*128);x.stroke(); }
  const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(24,24); return t;
}
const ARENA_R=58;
{
  const gnd=new THREE.Mesh(new THREE.CircleGeometry(90,64), new THREE.MeshStandardMaterial({map:groundTexture(),roughness:0.9,metalness:0.15}));
  gnd.rotation.x=-Math.PI/2; gnd.receiveShadow=true; scene.add(gnd);
  const wall=new THREE.Mesh(new THREE.CylinderGeometry(ARENA_R+2,ARENA_R+2,14,48,1,true), new THREE.MeshStandardMaterial({color:0x182238,roughness:0.6,side:THREE.DoubleSide}));
  scene.add(wall);
}
function safeMat(color,opts={}){ return new THREE.MeshStandardMaterial({color,roughness:0.65,metalness:0.3,...opts}); }

// colliders: {x,z,r} circles + beacon
const colliders=[];
// world structures
const structures=new THREE.Group(); scene.add(structures);
function addCollider(x,z,r){ colliders.push({x,z,r}); }
function box(w,h,d,color,x,y,z,ry=0,emissive=0){
  const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d), safeMat(color,{emissive,emissiveIntensity:emissive?0.7:0}));
  m.position.set(x,y,z); m.rotation.y=ry; m.castShadow=true; m.receiveShadow=true; structures.add(m); return m;
}
function pillar(x,z,h=14,r=1.6,color=0x2a3350){
  const m=new THREE.Mesh(new THREE.CylinderGeometry(r*0.8,r,h,8), safeMat(color));
  m.position.set(x,h/2,z); m.castShadow=true; m.receiveShadow=true; structures.add(m);
  const cap=new THREE.Mesh(new THREE.BoxGeometry(r*3,0.8,r*3), safeMat(0x1c243c,{emissive:0x7df9ff,emissiveIntensity:0.35}));
  cap.position.set(x,h+0.4,z); structures.add(cap);
  addCollider(x,z,r+0.7); return m;
}
function crystal(x,z,s=1,color=0x33f0ff){
  const grp=new THREE.Group();
  for(let i=0;i<4;i++){ const h=(2+Math.random()*4)*s; const m=new THREE.Mesh(new THREE.OctahedronGeometry(0.7*s), new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:0.9,roughness:0.15,transparent:true,opacity:0.92}));
    m.position.set((Math.random()-0.5)*3*s,h/2,(Math.random()-0.5)*3*s); m.rotation.set(Math.random(),Math.random(),0.3); m.castShadow=true; grp.add(m); }
  grp.position.set(x,0,z); structures.add(grp); addCollider(x,z,2*s); return grp;
}
// beacon center
{
  const base=new THREE.Mesh(new THREE.CylinderGeometry(4,5,1,24), safeMat(0x223052)); base.position.y=0.5; base.receiveShadow=true; scene.add(base);
  const beam=new THREE.Mesh(new THREE.CylinderGeometry(0.9,1.4,40,16,1,true), new THREE.MeshBasicMaterial({color:0x7df9ff,transparent:true,opacity:0.35,side:THREE.DoubleSide,depthWrite:false}));
  beam.position.y=20; scene.add(beam); window._beam=beam;
  const holo=new THREE.Mesh(new THREE.OctahedronGeometry(1.2), new THREE.MeshStandardMaterial({color:0x7df9ff,emissive:0x7df9ff,emissiveIntensity:1.4}));
  holo.position.y=5.2; scene.add(holo); window._holo=holo;
  addCollider(0,0,5.2);
}
// scatter ruins / cover
const coverSpots=[[14,8],[-15,10],[10,-16],[-12,-14],[24,-6],[-26,-4],[6,26],[-8,-28],[28,14],[-30,16],[0,34],[0,-36],[36,-2],[-38,-2]];
coverSpots.forEach(([x,z],i)=>{
  if(i%3===0){ box(4,2.2,4,0x2b3a5e,x,1.1,z,Math.random(),0x000000); addCollider(x,z,3.2); }
  else if(i%3===1){ pillar(x,z,9+Math.random()*7); }
  else { box(6,1.2,2,0x3a2c5e,x,0.6,z,Math.random()*3,0x9d6bff); addCollider(x,z,3.4); }
});
crystal(20,22,1.2); crystal(-22,-22,1.4,0x9d6bff); crystal(30,-20,1,0xf5c542); crystal(-28,24,1.1); crystal(8,-8,0.8);
// arches
for(let i=0;i<5;i++){ const a=i/5*Math.PI*2; const x=Math.cos(a)*44, z=Math.sin(a)*44;
  const m=new THREE.Mesh(new THREE.TorusGeometry(7,1.1,10,22,Math.PI), safeMat(0x33415e)); m.position.set(x,0,z); m.lookAt(0,0,0); structures.add(m); }
addCollider(14,8,3.2);

// light orbs / pickups, projectiles, particles, enemies arrays
const enemies=[], friendlies=[], enemyBolts=[], rockets=[], grenades=[], pickups=[], floaters=[];
const particles=[];
const particleGeo=new THREE.SphereGeometry(0.09,6,6);
function spawnParticle(pos,color,count=8,speed=7,life=0.7,up=3){
  for(let i=0;i<count;i++){ const m=new THREE.Mesh(particleGeo, new THREE.MeshBasicMaterial({color,transparent:true})); m.position.copy(pos);
    const v=new THREE.Vector3((Math.random()-0.5)*speed, Math.random()*up+1, (Math.random()-0.5)*speed);
    particles.push({m,v,life:life*(0.6+Math.random()*0.7),max:life}); scene.add(m); }
}
function updateParticles(dt){
  for(let i=particles.length-1;i>=0;i--){ const p=particles[i]; p.life-=dt; p.v.y-=12*dt; p.m.position.addScaledVector(p.v,dt);
    p.m.material.opacity=Math.max(0,p.life/p.max); if(p.m.position.y<0.05){p.m.position.y=0.05;p.v.y*=-0.4;} if(p.life<=0){scene.remove(p.m);p.m.material.dispose();particles.splice(i,1);} }
  if(particles.length>700){ const extra=particles.splice(0,particles.length-700); extra.forEach(p=>{scene.remove(p.m);}); }
}
function tracer(a,b,color=0x7df9ff,life=0.07){
  const g=new THREE.BufferGeometry().setFromPoints([a,b]);
  const l=new THREE.Line(g,new THREE.LineBasicMaterial({color,transparent:true,opacity:1}));
  scene.add(l); floaters.push({m:l,life,max:life,kind:'tracer'});
}
function updateFloaters(dt){
  for(let i=floaters.length-1;i>=0;i--){ const f=floaters[i]; f.life-=dt;
    if(f.kind==='tracer'){ f.m.material.opacity=Math.max(0,f.life/f.max); if(f.life<=0){scene.remove(f.m);f.m.geometry.dispose();f.m.material.dispose();floaters.splice(i,1);} }
  }
}

// ---------------- game state ----------------
const G = {
  started:false, paused:false, dead:false, won:false, locked:false,
  classKey:'strider', wave:0, score:0, glimmer:0, kills:0, light:1350,
  waveActive:false, spawnQueue:[], spawnTimer:0, betweenTimer:0,
  time:0, superCharge:0, grenadeCd:0, meleeCd:0, riftCd:0, riftActive:null,
  shake:0, ads:0, superMode:0, goldenShots:0,
};
let player;
function makePlayer(classKey){
  const c=CLASSES[classKey];
  return { pos:new THREE.Vector3(0,1.7,20), vel:new THREE.Vector3(), yaw:0, pitch:0,
    hp:c.hp, maxHp:c.hp, shield:c.shield, maxShield:c.shield, lastDamage:-99,
    onGround:true, jumps:0, sprinting:false, crouch:false,
    ammo:WEAPONS.map(w=>w.mag), reserve:WEAPONS.map(w=>w.reserve), slot:0,
    reloading:0, fireCd:0, triggerHeld:false, adsHeld:false, alive:true };
}
player=makePlayer('strider');

// weapon viewmodel
const gunRig=new THREE.Group(); camera.add(gunRig); scene.add(camera);
let gunMeshes=[];
function buildGun(slot){
  while(gunRig.children.length) gunRig.remove(gunRig.children[0]);
  gunMeshes=[];
  const dark=new THREE.MeshStandardMaterial({color:0x1a2236,roughness:0.5,metalness:0.7});
  const accent=new THREE.MeshStandardMaterial({color:slot===0?0x7df9ff:slot===1?0xffb35d:0xc77dff,emissive:slot===0?0x7df9ff:slot===1?0xff8a3d:0x9d6bff,emissiveIntensity:0.9});
  const body=new THREE.Mesh(new THREE.BoxGeometry(0.09,0.13,slot===2?0.85:0.62),dark); body.position.set(0.24,-0.22,-0.55); gunRig.add(body);
  const barrel=new THREE.Mesh(new THREE.CylinderGeometry(0.025,0.025,0.3,10),dark); barrel.rotation.x=Math.PI/2; barrel.position.set(0.24,-0.19,-0.95); gunRig.add(barrel);
  const glow=new THREE.Mesh(new THREE.BoxGeometry(0.02,0.02,0.4),accent); glow.position.set(0.285,-0.2,-0.6); gunRig.add(glow);
  const sight=new THREE.Mesh(new THREE.BoxGeometry(0.03,0.05,0.06),dark); sight.position.set(0.24,-0.13,-0.6); gunRig.add(sight);
  if(slot===1){ body.scale.set(1.1,1.1,0.7); }
  if(slot===2){ body.scale.set(1.5,1.4,1.2); const tip=new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.06,0.08,10),accent); tip.rotation.x=Math.PI/2; tip.position.set(0.24,-0.19,-1.1); gunRig.add(tip); }
  gunMeshes=[body,barrel,glow,sight];
}
buildGun(0);
const flash=new THREE.Mesh(new THREE.PlaneGeometry(0.3,0.3), new THREE.MeshBasicMaterial({color:0xfff2b0,transparent:true,opacity:0,depthWrite:false}));
flash.position.set(0.24,-0.19,-1.15); gunRig.add(flash);

// ---------------- input ----------------
const keys={};
addEventListener('keydown',e=>{ keys[e.code]=true;
  if(e.code==='Digit1') switchSlot(0); if(e.code==='Digit2') switchSlot(1); if(e.code==='Digit3') switchSlot(2);
  if(e.code==='KeyR') startReload();
  if(e.code==='KeyE') throwGrenade();
  if(e.code==='KeyF') doMelee();
  if(e.code==='KeyC') dropRift();
  if(e.code==='KeyX') fireSuper();
  if(e.code==='KeyM'){ const m=AudioSys.toggleMute(); note(m?'MUTED':'SOUND ON'); }
  if(e.code==='KeyP'||e.code==='Escape'){ if(G.started&&!G.dead&&!G.won) togglePause(); }
  if(e.code==='Space') e.preventDefault();
});
addEventListener('keyup',e=>{keys[e.code]=false;});
document.addEventListener('mousemove',e=>{ if(!G.locked||G.paused||!G.started) return;
  const s=0.0022*(parseFloat($('setSens').value)||1)*(G.ads>0.5?0.6:1);
  player.yaw-=e.movementX*s; player.pitch-=e.movementY*s; player.pitch=Math.max(-1.45,Math.min(1.45,player.pitch));
});
document.addEventListener('mousedown',e=>{ if(!G.started||G.paused) return;
  if(!G.locked){ canvas.requestPointerLock(); return; }
  if(e.button===0) player.triggerHeld=true;
  if(e.button===2) player.adsHeld=true;
});
addEventListener('mouseup',e=>{ if(e.button===0) player.triggerHeld=false; if(e.button===2) player.adsHeld=false; });
addEventListener('contextmenu',e=>e.preventDefault());
document.addEventListener('pointerlockchange',()=>{ G.locked=document.pointerLockElement===canvas; $('fps').textContent=G.locked?`${fps|0} FPS • ${WEAPONS[player.slot].name}`:'click to lock mouse'; });
addEventListener('resize',()=>{ camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth,innerHeight); });

// ---------------- UI wiring ----------------
let selectedClass='strider';
document.querySelectorAll('.classCard').forEach(c=>c.onclick=()=>{ document.querySelectorAll('.classCard').forEach(x=>x.classList.remove('sel')); c.classList.add('sel'); selectedClass=c.dataset.class; AudioSys.init(); AudioSys.pickup(); });
$('btnHow').onclick=()=>{ $('menuScreen').classList.add('hidden'); $('helpScreen').classList.remove('hidden'); };
$('btnBack').onclick=()=>{ $('helpScreen').classList.add('hidden'); $('menuScreen').classList.remove('hidden'); };
$('btnDeploy').onclick=()=>{ AudioSys.init(); AudioSys.ctx&&AudioSys.ctx.resume(); startRun(selectedClass); };
$('btnResume').onclick=()=>togglePause();
$('btnRestart').onclick=()=>{ $('pauseScreen').classList.add('hidden'); startRun(G.classKey); };
$('btnQuit').onclick=()=>{ $('pauseScreen').classList.add('hidden'); toMenu(); };
$('btnRevive').onclick=()=>{ restartWave(); };
$('btnMenu2').onclick=()=>{ $('deathScreen').classList.add('hidden'); toMenu(); };
$('btnAgain').onclick=()=>{ $('winScreen').classList.add('hidden'); startRun(G.classKey); };
$('setVol').oninput=e=>AudioSys.setVol(parseFloat(e.target.value));
$('setQuality').onchange=e=>applyQuality(e.target.value);
function applyQuality(q){ if(q==='low'){renderer.setPixelRatio(0.75);renderer.shadowMap.enabled=false;sun.castShadow=false;} else if(q==='med'){renderer.setPixelRatio(Math.min(devicePixelRatio,1.25));renderer.shadowMap.enabled=true;sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);} else {renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);} if(sun.shadow.map){sun.shadow.map.dispose();sun.shadow.map=null;} }
function toMenu(){ G.started=false;G.paused=false;hud.classList.remove('on'); $('menuScreen').classList.remove('hidden'); document.exitPointerLock&&document.exitPointerLock(); clearWorld(); }
function note(t,sub=''){ toastEl.innerHTML=`<h2>${t}</h2>${sub?`<p>${sub}</p>`:''}`; clearTimeout(note._t); note._t=setTimeout(()=>toastEl.innerHTML='',2200); }
function feed(t){ const d=document.createElement('div'); d.className='kf'; d.innerHTML=t; $('killfeed').prepend(d); while($('killfeed').children.length>5) $('killfeed').lastChild.remove(); setTimeout(()=>{d.style.opacity='0';d.style.transition='opacity .5s';},3800); }
function dmgNum(worldPos,text,cls=''){ const v=worldPos.clone().project(camera); if(v.z>1) return; const x=(v.x*0.5+0.5)*innerWidth, y=(-v.y*0.5+0.5)*innerHeight; const d=document.createElement('div'); d.className='dmgnum '+cls; d.textContent=text; d.style.left=x+'px'; d.style.top=y+'px'; dmgNums.appendChild(d); setTimeout(()=>d.remove(),850); }
function hitmarker(kill=false){ const h=$('hitmarker'); h.classList.remove('show'); void h.offsetWidth; h.classList.add('show'); h.classList.toggle('kill',kill); }

// ---------------- run / wave control ----------------
function clearWorld(){ enemies.forEach(e=>scene.remove(e.grp)); enemies.length=0; enemyBolts.forEach(b=>scene.remove(b.m)); enemyBolts.length=0; rockets.forEach(r=>scene.remove(r.m)); rockets.length=0; grenades.forEach(g=>scene.remove(g.m)); grenades.length=0; pickups.forEach(p=>scene.remove(p.m)); pickups.length=0; }
function startRun(classKey){
  G.classKey=classKey; const c=CLASSES[classKey];
  clearWorld(); player=makePlayer(classKey); buildGun(0);
  Object.assign(G,{started:true,paused:false,dead:false,won:false,wave:0,score:0,glimmer:0,kills:0,light:1350+0,superCharge:0,grenadeCd:0,meleeCd:0,riftCd:0,riftActive:null,superMode:0,goldenShots:0,waveActive:false,betweenTimer:1.2,spawnQueue:[]});
  $('menuScreen').classList.add('hidden'); $('deathScreen').classList.add('hidden'); $('winScreen').classList.add('hidden'); $('pauseScreen').classList.add('hidden');
  hud.classList.add('on'); $('classLabel').textContent=`${c.name} • ${c.sub}`; $('superName').textContent=c.superName;
  $('score').textContent='0'; $('glimmer').textContent='✦ 0 GLIMMER';
  note('WAVE INCOMING','DEFEND THE BEACON'); AudioSys.wave();
  canvas.requestPointerLock();
}
function restartWave(){ // revive: retry same wave with full hp
  enemies.forEach(e=>scene.remove(e.grp)); enemies.length=0; enemyBolts.length=0;
  const c=CLASSES[G.classKey]; player.hp=player.maxHp; player.shield=player.maxShield; player.pos.set(0,1.7,20); player.vel.set(0,0,0); player.alive=true;
  G.dead=false; G.spawnQueue=[]; G.waveActive=false; G.betweenTimer=1.5; G.superCharge=Math.max(G.superCharge,40);
  $('deathScreen').classList.add('hidden'); hud.classList.add('on'); canvas.requestPointerLock();
  note('REVIVED BY GHOST','WAVE '+Math.max(1,G.wave)+' RETRY');
}
function togglePause(){ if(!G.started||G.dead||G.won) return; G.paused=!G.paused;
  $('pauseScreen').classList.toggle('hidden',!G.paused);
  if(G.paused){ document.exitPointerLock&&document.exitPointerLock(); $('pauseStats').textContent=`Wave ${G.wave} • ${G.kills} kills • ${G.score} score • ${G.glimmer} glimmer • Super ${G.superCharge|0}%`; }
  else canvas.requestPointerLock();
}
function buildWave(n){
  const q=[]; const budget=4+n*2.2;
  let count=Math.min(6+Math.floor(n*1.6),26);
  for(let i=0;i<count;i++){ const r=Math.random();
    if(n>=5&&i===0&&n%5===0){ q.push('warden'); continue; }
    if(r<0.45) q.push('thrall'); else if(r<0.78) q.push('acolyte'); else q.push('knight');
    if(n>=4&&Math.random()<0.12) q.push('thrall');
  }
  if(n>=3) q.push('knight');
  return q;
}
function startWave(n){
  G.wave=n; G.waveActive=true; G.spawnQueue=buildWave(n); G.spawnTimer=0;
  $('wave').textContent='WAVE '+n+(n%5===0?' — ☠ WARDEN ☠':'');
  $('objective').textContent=n%5===0?'SLAY THE WARDEN':'DEFEND THE BEACON';
  note('WAVE '+n, n%5===0?'☠ WARDEN OF THE DARK ☠':$('superName')&&G.superCharge>=100?'SUPER READY — PRESS X':'HOSTILES INBOUND');
  AudioSys.wave();
}

// ---------------- enemies ----------------
function spawnEnemy(kind){
  const def=ENEMY_DEFS[kind];
  const grp=new THREE.Group();
  const bodyMat=new THREE.MeshStandardMaterial({color:def.color,emissive:def.color,emissiveIntensity:0.35,roughness:0.5});
  const darkMat=new THREE.MeshStandardMaterial({color:0x11162a,roughness:0.7});
  const s=def.scale;
  if(kind==='thrall'){
    const b=new THREE.Mesh(new THREE.ConeGeometry(0.55*s,1.8*s,7),bodyMat); b.position.y=1.1*s; b.castShadow=true; grp.add(b);
    const head=new THREE.Mesh(new THREE.SphereGeometry(0.34*s,10,10),new THREE.MeshStandardMaterial({color:0xffe08a,emissive:0xffd24a,emissiveIntensity:1.2})); head.position.y=2.1*s; grp.add(head);
    const cl1=new THREE.Mesh(new THREE.ConeGeometry(0.12,1.1,5),darkMat); cl1.position.set(-0.5,1.2,0.2); cl1.rotation.z=1.2; grp.add(cl1);
    const cl2=cl1.clone(); cl2.position.x=0.5; cl2.rotation.z=-1.2; grp.add(cl2);
  } else if(kind==='warden'){
    const b=new THREE.Mesh(new THREE.BoxGeometry(1.8*s*0.6,2.6*s*0.5,1.1),bodyMat); b.position.y=1.9; b.castShadow=true; grp.add(b);
    const head=new THREE.Mesh(new THREE.OctahedronGeometry(0.7),new THREE.MeshStandardMaterial({color:0xff2222,emissive:0xff0000,emissiveIntensity:2})); head.position.y=3.6; grp.add(head);
    const crown=new THREE.Mesh(new THREE.TorusGeometry(0.9,0.12,8,16),darkMat); crown.position.y=3.6; crown.rotation.x=Math.PI/2; grp.add(crown);
    [-1,1].forEach(sd=>{ const arm=new THREE.Mesh(new THREE.BoxGeometry(0.5,2.4,0.5),darkMat); arm.position.set(sd*1.4,1.8,0); grp.add(arm); });
  } else {
    const b=new THREE.Mesh(new THREE.CapsuleGeometry(0.5*s,1.1*s,4,8),bodyMat); b.position.y=1.3*s; b.castShadow=true; grp.add(b);
    const head=new THREE.Mesh(new THREE.SphereGeometry(0.32*s,10,10),new THREE.MeshStandardMaterial({color:0xffffff,emissive:def.color,emissiveIntensity:1.4})); head.position.y=2.35*s; grp.add(head);
    const gun=new THREE.Mesh(new THREE.BoxGeometry(0.18,0.18,1.1*s),darkMat); gun.position.set(0.5*s,1.5*s,-0.4); grp.add(gun);
    if(kind==='knight'){ const sh=new THREE.Mesh(new THREE.BoxGeometry(1.6*s,0.25,0.9),darkMat); sh.position.y=1.9*s; grp.add(sh); }
  }
  // hp bar sprite
  const hpC=document.createElement('canvas'); hpC.width=64; hpC.height=8;
  const hpT=new THREE.CanvasTexture(hpC);
  const hpS=new THREE.Sprite(new THREE.SpriteMaterial({map:hpT,depthTest:false})); hpS.scale.set(1.6,0.2,1); hpS.position.y=(kind==='warden'?4.6:2.9*s); grp.add(hpS);
  const a=Math.random()*Math.PI*2, r=34+Math.random()*14;
  grp.position.set(Math.cos(a)*r,0,Math.sin(a)*r);
  scene.add(grp);
  const hpMul=1+(G.wave-1)*0.13;
  enemies.push({kind,def,grp,hp:def.hp*hpMul,maxHp:def.hp*hpMul,hpC,hpT,hpS,fireT:1+Math.random()*2,meleeT:0,flash:0,spawnT:0.6,phase:Math.random()*10});
  if(kind==='warden'){ $('bossBar').style.display='block'; feed('☠ <b style="color:#ff6b6b">WARDEN OF THE DARK</b> has arrived'); }
}
function drawEnemyHp(e){
  const x=e.hpC.getContext('2d'); x.clearRect(0,0,64,8); x.fillStyle='rgba(0,0,0,.7)'; x.fillRect(0,0,64,8);
  const f=Math.max(0,e.hp/e.maxHp); x.fillStyle=f>0.5?'#7dff9a':f>0.25?'#f5c542':'#ff5252'; x.fillRect(1,1,62*f,6); e.hpT.needsUpdate=true;
}
function damageEnemy(e,dmg,isHead,hitPos){
  if(e.hp<=0) return;
  if(isHead) dmg*=WEAPONS[player.slot].headMul;
  const crit=isHead&&Math.random()<0.35;
  if(crit) dmg*=1.6;
  e.hp-=dmg; e.flash=0.09; drawEnemyHp(e);
  spawnParticle(hitPos||e.grp.position.clone().add(new THREE.Vector3(0,1.5,0)), isHead?0xffd24a:0x7df9ff, 5, 5, 0.5, 3);
  dmgNum(e.grp.position.clone().add(new THREE.Vector3(0,2.2,0)), Math.round(dmg), crit||isHead?'crit':'');
  if(player.slot===0) G.superCharge=Math.min(100,G.superCharge+(isHead?1.6:0.9));
  else G.superCharge=Math.min(100,G.superCharge+(isHead?2.6:1.4));
  AudioSys.hit(); if(crit||isHead) AudioSys.crit(); hitmarker(false);
  if(e.hp<=0) killEnemy(e,isHead);
}
function killEnemy(e,superKill=false){
  const pos=e.grp.position.clone(); pos.y=1.5;
  spawnParticle(pos,e.def.color,22,9,0.9,6); spawnParticle(pos,0xffffff,10,6,0.5,4);
  AudioSys.boom(); hitmarker(true);
  G.kills++; G.score+=e.def.score; G.glimmer+=e.def.glimmer; G.light+=e.kind==='warden'?25:1;
  G.superCharge=Math.min(100,G.superCharge+(e.kind==='warden'?40:6));
  feed(`${e.def.name} <span style="color:#f5c542">+${e.def.score}</span>`);
  $('score').textContent=G.score.toLocaleString(); $('glimmer').textContent=`✦ ${G.glimmer.toLocaleString()} GLIMMER`;
  // drops: 30% orb heal, knights always drop
  if(Math.random()<0.35||e.kind==='knight'||e.kind==='warden'){
    const orb=new THREE.Mesh(new THREE.SphereGeometry(0.32,12,12), new THREE.MeshStandardMaterial({color:0x7df9ff,emissive:0x33e0ff,emissiveIntensity:2}));
    orb.position.set(pos.x,0.6,pos.z); scene.add(orb);
    pickups.push({m:orb,t:0,life:22,heal:e.kind==='warden'?60:25,super:e.kind==='warden'?50:12});
  }
  if(e.kind==='warden'){ for(let i=0;i<3;i++){ const orb=new THREE.Mesh(new THREE.SphereGeometry(0.32,12,12), new THREE.MeshStandardMaterial({color:0xf5c542,emissive:0xff8a3d,emissiveIntensity:2})); orb.position.set(pos.x+(Math.random()-0.5)*4,0.6,pos.z+(Math.random()-0.5)*4); scene.add(orb); pickups.push({m:orb,t:0,life:30,heal:40,super:25}); } }
  scene.remove(e.grp);
  e.dead=true;
  if(e.kind==='warden'){ $('bossBar').style.display='none'; note('WARDEN FELLED','+5000 SCORE'); }
}

// ---------------- player combat ----------------
const ray=new THREE.Raycaster();
function switchSlot(i){ if(i===player.slot||player.reloading>0) return; player.slot=i; player.reloading=0; player.fireCd=Math.max(player.fireCd,0.25); buildGun(i); const w=WEAPONS[i]; $('wName').textContent=w.name; $('wType').textContent=w.type; AudioSys.reload(); updateSlots(); }
function updateSlots(){ [...document.querySelectorAll('.slot')].forEach((s,i)=>s.classList.toggle('active',i===player.slot)); }
function startReload(){ const w=WEAPONS[player.slot]; if(player.reloading>0||player.ammo[player.slot]>=w.mag||player.reserve[player.slot]<=0) return; player.reloading=w.reload*CLASSES[G.classKey].reloadMul; AudioSys.reload(); }
function finishReload(){ const w=WEAPONS[player.slot]; const need=w.mag-player.ammo[player.slot]; const take=Math.min(need,player.reserve[player.slot]); player.ammo[player.slot]+=take; player.reserve[player.slot]-=take; }
function eyePos(){ return player.pos.clone(); }
function shootDir(spread){
  const d=new THREE.Vector3(0,0,-1).applyEuler(camera.rotation);
  d.x+=(Math.random()-0.5)*spread*2; d.y+=(Math.random()-0.5)*spread*2; d.z+=(Math.random()-0.5)*spread*2; return d.normalize();
}
function tryFire(dt){
  const w=WEAPONS[player.slot];
  player.fireCd-=dt;
  const wantFire=w.auto?player.triggerHeld:(player.triggerHeld&&!player._semiLatch);
  if(player.reloading>0||G.paused||!player.alive) { if(!player.triggerHeld) player._semiLatch=false; return; }
  if(!wantFire||player.fireCd>0){ if(!player.triggerHeld) player._semiLatch=false; return; }
  if(player.ammo[player.slot]<=0){ AudioSys.empty(); player.fireCd=0.25; player._semiLatch=true; if(player.reserve[player.slot]>0) startReload(); return; }
  player._semiLatch=true;
  // golden gun super overrides
  if(G.superMode>0&&G.classKey==='strider'){ fireGolden(); return; }
  player.fireCd=60/w.rpm; player.ammo[player.slot]--;
  AudioSys.shoot(w.sound);
  // recoil + flash + shake
  player.pitch+=w.kick*(player.adsHeld?0.5:1); G.shake=Math.min(0.5,G.shake+w.kick*2);
  flash.material.opacity=1; muzzleLight.position.copy(camera.position).add(new THREE.Vector3(0,0,-1).applyEuler(camera.rotation).multiplyScalar(1.2)); muzzleLight.intensity=26;
  gunRig.position.z=0.09; setTimeout(()=>gunRig.position.z=0,60);
  const spread=player.adsHeld?w.adsSpread:w.spread+(player.sprinting?0.02:0);
  if(player.slot===2){ fireRocket(spread); return; }
  const origin=eyePos(), dir=shootDir(spread);
  ray.set(origin,dir); ray.far=w.range;
  const targets=enemies.filter(e=>!e.dead&&e.spawnT<=0).map(e=>e.grp);
  const hits=ray.intersectObjects(targets,true);
  const end=origin.clone().addScaledVector(dir,w.range);
  if(hits.length){
    const h=hits[0]; const e=enemies.find(e=>e.grp===ancestor(h.object));
    const isHead=h.object.geometry&&(h.object.geometry.type==='SphereGeometry'||h.object.geometry.type==='OctahedronGeometry');
    damageEnemy(e,w.dmg,isHead,h.point);
    tracer(origin.clone().addScaledVector(dir,1.2).add(new THREE.Vector3(0,-0.15,0)),h.point,w.tracer);
  } else tracer(origin.clone().addScaledVector(dir,1.2).add(new THREE.Vector3(0,-0.15,0)),end,w.tracer);
  updateAmmo();
  if(player.ammo[player.slot]===0&&player.reserve[player.slot]>0) startReload();
}
function ancestor(o){ while(o&&o.parent&&o.parent!==scene){ if(enemies.some(e=>e.grp===o.parent)) return o.parent; o=o.parent; } let r=o; while(r.parent&&r.parent!==scene) r=r.parent; return r; }
function fireRocket(){
  const origin=eyePos(), dir=shootDir(0.004);
  const m=new THREE.Mesh(new THREE.SphereGeometry(0.22,10,10), new THREE.MeshBasicMaterial({color:0xffd28a}));
  m.position.copy(origin).addScaledVector(dir,1); scene.add(m);
  rockets.push({m,vel:dir.multiplyScalar(42),life:4,dmg:WEAPONS[2].dmg});
  tracer(origin,end_of(dir,origin),0xc77dff);
}
function end_of(dir,origin){ return origin.clone().addScaledVector(dir,30); }
function explode(pos,dmg,radius,fromPlayer=true,color=0xffa63d){
  spawnParticle(pos,color,30,12,0.9,8); spawnParticle(pos,0x333333,14,6,1.1,5); AudioSys.boom(); G.shake=Math.min(0.8,G.shake+0.3);
  muzzleLight.position.copy(pos); muzzleLight.intensity=60; muzzleLight.color.set(0xffa63d);
  const fl=new THREE.Mesh(new THREE.SphereGeometry(radius*0.35,12,12), new THREE.MeshBasicMaterial({color,transparent:true,opacity:0.7}));
  fl.position.copy(pos); scene.add(fl); floaters.push({m:fl,life:0.25,max:0.25,kind:'tracer'});
  if(fromPlayer){ enemies.forEach(e=>{ if(e.dead) return; const d=e.grp.position.clone(); d.y=1.5; const dist=d.distanceTo(pos); if(dist<radius){ damageEnemy(e,dmg*(1-dist/radius*0.6),false,d); } }); }
  else { const d=player.pos.distanceTo(pos); if(d<radius){ hurtPlayer(dmg*(1-d/radius*0.5),pos); } }
}
function throwGrenade(){
  if(!G.started||G.paused||G.grenadeCd>0||!player.alive) return;
  G.grenadeCd=11*CLASSES[G.classKey].abilMul; AudioSys.shoot('cannon');
  const dir=new THREE.Vector3(0,0,-1).applyEuler(camera.rotation);
  const m=new THREE.Mesh(new THREE.SphereGeometry(0.2,10,10), new THREE.MeshStandardMaterial({color:0xffb35d,emissive:0xff6a00,emissiveIntensity:2}));
  m.position.copy(eyePos()).addScaledVector(dir,1); scene.add(m);
  grenades.push({m,vel:dir.multiplyScalar(18).add(new THREE.Vector3(0,5,0)),life:2.2,fuse:1.1});
  note('','SOLAR GRENADE OUT');
}
function doMelee(){
  if(!G.started||G.paused||G.meleeCd>0||!player.alive) return;
  G.meleeCd=4*CLASSES[G.classKey].abilMul; AudioSys.noise(0.12,0.4,300,2000);
  gunRig.position.x=0.25; setTimeout(()=>gunRig.position.x=0,120);
  const fwd=new THREE.Vector3(0,0,-1).applyEuler(camera.rotation);
  let hit=false;
  enemies.forEach(e=>{ if(e.dead) return; const to=e.grp.position.clone().sub(player.pos); to.y=0; const d=to.length(); const ang=to.normalize().dot(new THREE.Vector3(fwd.x,0,fwd.z).normalize());
    if(d<4.2&&ang>0.5){ damageEnemy(e,G.classKey==='bulwark'?120:75,false,e.grp.position.clone().add(new THREE.Vector3(0,1.6,0))); hit=true; } });
  if(!hit) feed('melee whiffed…');
}
function dropRift(){
  if(!G.started||G.paused||G.riftCd>0||!player.alive) return;
  G.riftCd=16*CLASSES[G.classKey].abilMul; AudioSys.super();
  if(G.riftActive) scene.remove(G.riftActive.m);
  const m=new THREE.Mesh(new THREE.CylinderGeometry(3.4,3.4,0.15,24), new THREE.MeshBasicMaterial({color:0x7df9ff,transparent:true,opacity:0.35}));
  m.position.set(player.pos.x,0.1,player.pos.z); scene.add(m);
  G.riftActive={m,life:8};
  feed('⬢ <b>HEALING RIFT</b> deployed');
}
function fireSuper(){
  if(!G.started||G.paused||G.superCharge<100||!player.alive) return;
  G.superCharge=0; AudioSys.super();
  if(G.classKey==='strider'){ G.superMode=8; G.goldenShots=3; note('GOLDEN GUN','3 shots — aim for heads [LMB]'); }
  else if(G.classKey==='bulwark'){ // fist of havoc: slam
    note('FIST OF HAVOC','SLAM!'); G.shake=0.9;
    const p=player.pos.clone(); p.y=1;
    explode(p,420,14,true,0x9d6bff);
    enemies.forEach(e=>{ if(!e.dead){ const d=e.grp.position.distanceTo(player.pos); if(d<16){ damageEnemy(e,420,false,e.grp.position.clone()); } } });
  } else { // nova bomb projectile
    note('NOVA BOMB','VOID DEATH INBOUND');
    const dir=new THREE.Vector3(0,0,-1).applyEuler(camera.rotation);
    const m=new THREE.Mesh(new THREE.SphereGeometry(0.55,14,14), new THREE.MeshBasicMaterial({color:0xc77dff}));
    m.position.copy(eyePos()).addScaledVector(dir,1.2); scene.add(m);
    rockets.push({m,vel:dir.multiplyScalar(26),life:5,dmg:520,nova:true});
  }
  updateSuper();
}
function fireGolden(){
  if(G.goldenShots<=0){G.superMode=0;return;}
  G.goldenShots--; player.fireCd=0.5; AudioSys.shoot('cannon'); AudioSys.super();
  const origin=eyePos(), dir=shootDir(0.001);
  ray.set(origin,dir); ray.far=200;
  const targets=enemies.filter(e=>!e.dead).map(e=>e.grp);
  const hits=ray.intersectObjects(targets,true);
  const end=origin.clone().addScaledVector(dir,200);
  tracer(origin,end,0xffd24a,0.25); spawnParticle(origin,0xffd24a,8,4,0.4,2);
  if(hits.length){ const h=hits[0]; const e=enemies.find(e=>e.grp===ancestor(h.object)); damageEnemy(e,650,true,h.point); explode(h.point,150,5,true,0xffd24a); }
  if(G.goldenShots<=0) G.superMode=0;
}
function hurtPlayer(dmg,fromPos){
  if(!player.alive||G.paused||!G.started) return;
  // bulwark barricade-ish DR while sprinting? small
  if(G.classKey==='bulwark') dmg*=0.88;
  player.lastDamage=G.time;
  let rem=dmg;
  if(player.shield>0){ const s=Math.min(player.shield,rem); player.shield-=s; rem-=s; }
  player.hp-=rem;
  $('dmgVignette').style.opacity=1; setTimeout(()=>$('dmgVignette').style.opacity=0,180);
  AudioSys.hurt(); G.shake=Math.min(0.7,G.shake+0.25);
  const dv=$('dmgNums'); // directional indicator
  if(fromPos){ const dir=fromPos.clone().sub(player.pos); const yawTo=Math.atan2(-dir.x,-dir.z); let rel=yawTo-player.yaw; $('dmgDir').style.opacity=1; $('dmgDir').style.transform=`translate(-50%,-50%) rotate(${-rel}rad)`; clearTimeout(hurtPlayer._t); hurtPlayer._t=setTimeout(()=>$('dmgDir').style.opacity=0,400); }
  dmgNum(player.pos.clone().add(new THREE.Vector3(0,0.6,0)).add(new THREE.Vector3(0,0,-1).applyEuler(camera.rotation).multiplyScalar(3)),'-'+Math.round(dmg),'player');
  if(player.hp<=0){ player.hp=0; player.alive=false; onDeath(); }
}
function onDeath(){
  G.dead=true; document.exitPointerLock&&document.exitPointerLock();
  $('deathStats').textContent=`Wave ${G.wave} • ${G.kills} kills • ${G.score.toLocaleString()} score • ${G.glimmer.toLocaleString()} glimmer. Your Ghost can revive you — the Horde resets to this wave.`;
  setTimeout(()=>{ $('deathScreen').classList.remove('hidden'); hud.classList.remove('on'); },700);
  AudioSys.boom();
}

// ---------------- physics / movement ----------------
function collide(pos,r=0.9){
  for(const c of colliders){ const dx=pos.x-c.x, dz=pos.z-c.z; const d=Math.hypot(dx,dz); if(d<c.r+r&&d>0.001){ const push=(c.r+r-d); pos.x+=dx/d*push; pos.z+=dz/d*push; } }
  const dc=Math.hypot(pos.x,pos.z); if(dc>ARENA_R){ pos.x*=ARENA_R/dc; pos.z*=ARENA_R/dc; }
}
function updatePlayer(dt){
  const c=CLASSES[G.classKey];
  const fwd=new THREE.Vector3(-Math.sin(player.yaw),0,-Math.cos(player.yaw));
  const right=new THREE.Vector3(-fwd.z,0,fwd.x);
  let mx=0,mz=0;
  if(keys['KeyW']){mx+=fwd.x;mz+=fwd.z;} if(keys['KeyS']){mx-=fwd.x;mz-=fwd.z;}
  if(keys['KeyA']){mx-=right.x;mz-=right.z;} if(keys['KeyD']){mx+=right.x;mz+=right.z;}
  const moving=(mx||mz);
  player.sprinting=!!keys['ShiftLeft']&&!!keys['KeyW']&&!player.adsHeld;
  let speed=c.speed*(player.sprinting?1.45:1)*(player.adsHeld?0.55:1);
  if(moving){ const l=Math.hypot(mx,mz); mx/=l;mz/=l; }
  const accel=player.onGround?26:9;
  player.vel.x+=(mx*speed-player.vel.x)*Math.min(1,accel*dt);
  player.vel.z+=(mz*speed-player.vel.z)*Math.min(1,accel*dt);
  // gravity / jump
  player.vel.y-=22*dt;
  if(c.glide&&!player.onGround&&keys['Space']&&player.vel.y<0) player.vel.y=Math.max(player.vel.y,-2.2); // warlock glide
  if(keys['Space']&&!player._jumpLatch){
    player._jumpLatch=true;
    if(player.onGround){ player.vel.y=c.jump; player.onGround=false; player.jumps=1; AudioSys.blip(300,0.1,'sine',0.12,200); }
    else if(player.jumps<c.jumps-1){ player.vel.y=c.jump*0.92; player.jumps++; spawnParticle(player.pos.clone().add(new THREE.Vector3(0,-1,0)),0x7df9ff,8,4,0.5,2); AudioSys.blip(420,0.1,'sine',0.12,200); }
  }
  if(!keys['Space']) player._jumpLatch=false;
  player.pos.x+=player.vel.x*dt; player.pos.z+=player.vel.z*dt; player.pos.y+=player.vel.y*dt;
  collide(player.pos);
  if(player.pos.y<=1.7){ player.pos.y=1.7; player.vel.y=0; player.onGround=true; player.jumps=0; }
  else if(player.pos.y>1.71) player.onGround=false;
  // regen (destiny style)
  const sinceHit=G.time-player.lastDamage;
  if(sinceHit>3.5&&player.shield<player.maxShield){ player.shield=Math.min(player.maxShield,player.shield+34*dt*(G.classKey==='arcanist'?1.5:1)); }
  if(sinceHit>7&&player.hp<player.maxHp){ player.hp=Math.min(player.maxHp,player.hp+12*dt*(G.classKey==='arcanist'?1.6:1)); if(Math.random()<dt*2) $('healVignette').style.opacity=0.7; }
  else $('healVignette').style.opacity=0;
  // rift heal
  if(G.riftActive){ const d=Math.hypot(player.pos.x-G.riftActive.m.position.x,player.pos.z-G.riftActive.m.position.z); if(d<3.4){ player.hp=Math.min(player.maxHp,player.hp+26*dt); player.shield=Math.min(player.maxShield,player.shield+26*dt); } }
  // cooldowns
  G.grenadeCd=Math.max(0,G.grenadeCd-dt); G.meleeCd=Math.max(0,G.meleeCd-dt); G.riftCd=Math.max(0,G.riftCd-dt);
  if(G.riftActive){ G.riftActive.life-=dt; G.riftActive.m.rotation.y+=dt; if(G.riftActive.life<=0){scene.remove(G.riftActive.m);G.riftActive=null;} }
  if(G.superMode>0){ G.superMode-=dt; if(G.superMode<=0) G.superMode=0; }
  // reload
  if(player.reloading>0){ player.reloading-=dt; if(player.reloading<=0){ finishReload(); updateAmmo(); } }
  // camera
  G.ads+=((player.adsHeld?1:0)-G.ads)*Math.min(1,12*dt);
  const fov=78-G.ads*14+(player.sprinting?5:0);
  if(Math.abs(camera.fov-fov)>0.1){camera.fov=fov;camera.updateProjectionMatrix();}
  G.shake=Math.max(0,G.shake-dt*2.2);
  const shx=(Math.random()-0.5)*G.shake*0.06, shy=(Math.random()-0.5)*G.shake*0.06;
  camera.position.copy(player.pos); camera.position.x+=shx; camera.position.y+=shy+(moving&&player.onGround?Math.sin(G.time*(player.sprinting?13:9))*0.045:0);
  camera.rotation.set(player.pitch,player.yaw,0);
  // gun pose
  const gx=0.24-G.ads*0.24, gy=-0.22+G.ads*0.075;
  gunRig.position.x+=(gx-gunRig.position.x)*Math.min(1,14*dt);
  gunRig.position.y+=(gy-gunRig.position.y)*Math.min(1,14*dt);
  flash.material.opacity=Math.max(0,flash.material.opacity-dt*10);
  muzzleLight.intensity=Math.max(0,muzzleLight.intensity-dt*220);
  // golden gun tint
  gunRig.children.forEach(m=>{ if(G.superMode>0&&G.classKey==='strider'&&m.material&&m.material.emissive) m.material.emissive.setHex(0xffb300); });
}

// ---------------- enemy AI ----------------
function updateEnemies(dt){
  let alive=0;
  for(let i=enemies.length-1;i>=0;i--){
    const e=enemies[i]; if(e.dead){enemies.splice(i,1);continue;}
    alive++;
    e.phase+=dt; e.flash=Math.max(0,(e.flash||0)-dt);
    if(e.spawnT>0){ e.spawnT-=dt; e.grp.scale.setScalar(0.01+ (0.6-e.spawnT)*2); spawnParticle(e.grp.position.clone().add(new THREE.Vector3(0,1,0)),0x9d6bff,2,3,0.4,2); continue; }
    e.grp.scale.setScalar(1);
    const toP=player.pos.clone().sub(e.grp.position); toP.y=0; const dist=toP.length(); toP.normalize();
    // separation
    const sep=new THREE.Vector3();
    for(const o of enemies){ if(o===e||o.dead) continue; const d=e.grp.position.distanceTo(o.grp.position); if(d<2.4&&d>0.01){ sep.add(e.grp.position.clone().sub(o.grp.position).normalize().multiplyScalar((2.4-d)*1.4)); } }
    const dir=toP.clone().addScaledVector(sep,0.6).normalize();
    const want=e.kind==='acolyte'?10:(e.kind==='knight'?8:(e.kind==='warden'?9:1.2));
    let mx=0,mz=0;
    if(dist>want){ mx=dir.x; mz=dir.z; }
    else if(e.kind==='thrall'){ mx=dir.x; mz=dir.z; }
    else { // strafe
      const s=Math.sin(e.phase*0.9)>0?1:-1; mx=-dir.z*s*0.6+dir.x*0.15; mz=dir.x*s*0.6+dir.z*0.15;
    }
    const sp=e.def.speed*(1+G.wave*0.02);
    e.grp.position.x+=mx*sp*dt; e.grp.position.z+=mz*sp*dt;
    // collide with structures
    for(const cl of colliders){ const dx=e.grp.position.x-cl.x,dz=e.grp.position.z-cl.z; const d=Math.hypot(dx,dz); if(d<cl.r+0.6&&d>0.01){e.grp.position.x+=dx/d*(cl.r+0.6-d);e.grp.position.z+=dz/d*(cl.r+0.6-d);} }
    e.grp.position.y=Math.abs(Math.sin(e.phase*6))*0.12;
    e.grp.rotation.y=Math.atan2(dir.x,dir.z);
    e.grp.traverse(o=>{ if(o.material&&o.material.emissive&&e.flash>0) o.material.emissiveIntensity=2.2; else if(o.material&&o.material.emissive&&o.material.userDataBase===undefined){} });
    // attacks
    if(!player.alive) continue;
    if(!e.def.ranged||e.kind==='thrall'){
      e.meleeT-=dt;
      if(dist<2.6&&e.meleeT<=0){ e.meleeT=1.1; hurtPlayer(e.def.dmg*(1+G.wave*0.04),e.grp.position); spawnParticle(player.pos.clone(),0xff5252,8,6,0.5,3); }
    } else {
      e.fireT-=dt;
      const los=dist<55;
      if(los&&e.fireT<=0){ e.fireT=e.def.fireCd*(0.8+Math.random()*0.5)*(e.kind==='warden'?Math.max(0.5,1-G.wave*0.02):1); fireEnemyBolt(e); }
    }
  }
  // boss bar
  const w=enemies.find(e=>e.kind==='warden'&&!e.dead);
  if(w){ $('bossHp').firstElementChild.style.width=(100*Math.max(0,w.hp/w.maxHp))+'%'; }
  return alive;
}
function fireEnemyBolt(e){
  const from=e.grp.position.clone(); from.y=e.kind==='warden'?3.4:2.0;
  const target=player.pos.clone(); target.y-=0.2;
  const dir=target.sub(from).normalize();
  // lead / inaccuracy
  dir.x+=(Math.random()-0.5)*0.06; dir.y+=(Math.random()-0.5)*0.03; dir.z+=(Math.random()-0.5)*0.06; dir.normalize();
  const color=e.kind==='warden'?0xff3333:0xff7b3d;
  const m=new THREE.Mesh(new THREE.SphereGeometry(e.kind==='warden'?0.3:0.18,8,8), new THREE.MeshBasicMaterial({color}));
  m.position.copy(from); scene.add(m);
  const spd=e.kind==='warden'?22:16;
  enemyBolts.push({m,vel:dir.multiplyScalar(spd),life:4,dmg:e.def.dmg*(1+G.wave*0.04)});
  AudioSys.shoot('enemy');
  spawnParticle(from,color,4,3,0.3,1);
}
function updateProjectiles(dt){
  // enemy bolts
  for(let i=enemyBolts.length-1;i>=0;i--){ const b=enemyBolts[i]; b.life-=dt; b.m.position.addScaledVector(b.vel,dt);
    spawnParticle(b.m.position.clone(),0xff7b3d,1,0.5,0.25,0.5);
    let hit=false;
    if(b.m.position.distanceTo(player.pos)<1.1&&player.alive){ hurtPlayer(b.dmg,b.m.position); hit=true; }
    if(b.m.position.y<0||b.life<=0) hit=true;
    for(const c of colliders){ if(Math.hypot(b.m.position.x-c.x,b.m.position.z-c.z)<c.r&&b.m.position.y<10){hit=true;break;} }
    if(hit){ spawnParticle(b.m.position.clone(),0xff7b3d,6,5,0.5,3); scene.remove(b.m); enemyBolts.splice(i,1); }
  }
  // rockets (player)
  for(let i=rockets.length-1;i>=0;i--){ const r=rockets[i]; r.life-=dt; r.m.position.addScaledVector(r.vel,dt);
    spawnParticle(r.m.position.clone(),r.nova?0xc77dff:0xffd28a,2,1,0.4,1);
    let boom=r.life<=0||r.m.position.y<0.2;
    if(!boom){ for(const e of enemies){ if(e.dead||e.spawnT>0) continue; const p=e.grp.position.clone(); p.y=1.5; if(p.distanceTo(r.m.position)<1.6+(e.kind==='warden'?1.5:0)){boom=true;break;} } }
    if(boom){ const pos=r.m.position.clone(); scene.remove(r.m); rockets.splice(i,1); explode(pos,r.dmg,r.nova?13:WEAPONS[2].splash,true,r.nova?0x9d6bff:0xffa63d); }
  }
  // grenades
  for(let i=grenades.length-1;i>=0;i--){ const g=grenades[i]; g.life-=dt; g.fuse-=dt; g.vel.y-=16*dt; g.m.position.addScaledVector(g.vel,dt);
    if(g.m.position.y<0.2){g.m.position.y=0.2;g.vel.y*=-0.4;g.vel.x*=0.7;g.vel.z*=0.7;}
    if(g.fuse<=0){ const pos=g.m.position.clone(); scene.remove(g.m); grenades.splice(i,1);
      explode(pos,130,7.5,true,0xffb35d);
      // lingering burn
      for(let k=0;k<3;k++) setTimeout(()=>{ if(!G.paused) explode(pos.clone().add(new THREE.Vector3((Math.random()-0.5)*5,0.5,(Math.random()-0.5)*5)),40,4.5,true,0xff6a00); },400*(k+1));
    } else if(g.life<=0){ scene.remove(g.m); grenades.splice(i,1); }
  }
  // pickups
  for(let i=pickups.length-1;i>=0;i--){ const p=pickups[i]; p.t+=dt; p.life-=dt; p.m.rotation.y+=dt*3; p.m.position.y=0.6+Math.sin(p.t*4)*0.15;
    if(p.m.position.distanceTo(player.pos)<2&&player.alive){ player.hp=Math.min(player.maxHp,player.hp+p.heal); player.shield=Math.min(player.maxShield,player.shield+p.heal*0.5); G.superCharge=Math.min(100,G.superCharge+p.super); AudioSys.pickup(); spawnParticle(p.m.position.clone(),0x7df9ff,10,5,0.6,3); feed(`✦ Light orb <span style="color:#7df9ff">+${p.heal} HP</span>`); scene.remove(p.m); pickups.splice(i,1); updateSuper(); continue; }
    if(p.life<=0){ scene.remove(p.m); pickups.splice(i,1); }
  }
}

// ---------------- waves update ----------------
function updateWaves(dt,aliveCount){
  if(!G.waveActive){
    G.betweenTimer-=dt;
    if(G.betweenTimer<=0){ startWave(G.wave+1); }
    return;
  }
  if(G.spawnQueue.length){
    G.spawnTimer-=dt;
    const interval=Math.max(0.25,1.1-G.wave*0.06);
    if(G.spawnTimer<=0){ G.spawnTimer=interval; const batch=G.wave>=5?2:1; for(let i=0;i<batch&&G.spawnQueue.length;i++) spawnEnemy(G.spawnQueue.shift()); }
  } else if(aliveCount===0){
    G.waveActive=false;
    const bonus=200+G.wave*100; G.score+=bonus; G.glimmer+=50+G.wave*10;
    $('score').textContent=G.score.toLocaleString(); $('glimmer').textContent=`✦ ${G.glimmer.toLocaleString()} GLIMMER`;
    // ammo resupply
    player.reserve=player.reserve.map((r,i)=>Math.min(WEAPONS[i].reserve,r+Math.ceil(WEAPONS[i].mag*0.8)));
    updateAmmo();
    if(G.wave>=10){ winGame(); return; }
    G.betweenTimer=6;
    note('WAVE '+G.wave+' CLEAR',`+${bonus} SCORE • NEXT WAVE IN 6s — GRAB ORBS`);
    feed(`✓ Wave ${G.wave} cleared <span style="color:#7dff9a">+${bonus}</span>`);
    AudioSys.pickup();
  }
  $('enemiesLeft').textContent=`HOSTILES: ${aliveCount+G.spawnQueue.length}`;
}
function winGame(){ G.won=true; document.exitPointerLock&&document.exitPointerLock(); $('winScreen').classList.remove('hidden'); hud.classList.remove('on');
  $('winStats').textContent=`Score ${G.score.toLocaleString()} • ${G.kills} kills • ${G.glimmer.toLocaleString()} glimmer • Light ${G.light}. The Traveler stirs. Legend, Guardian.`; AudioSys.wave(); }

// ---------------- HUD ----------------
function updateAmmo(){ const w=WEAPONS[player.slot]; $('ammo').innerHTML=`${player.reloading>0?'––':player.ammo[player.slot]} <small>/ ${player.reserve[player.slot]}</small>`; }
function updateSuper(){ $('superBar').firstElementChild.style.width=G.superCharge+'%'; $('abGrenade').classList.toggle('ready',G.grenadeCd<=0); $('abMelee').classList.toggle('ready',G.meleeCd<=0); $('abRift').classList.toggle('ready',G.riftCd<=0); }
let hudT=0;
function updateHUD(dt){
  hudT-=dt; if(hudT>0) return; hudT=0.08;
  $('shieldBar').firstElementChild.style.transform=`scaleX(${Math.max(0,player.shield/player.maxShield)})`;
  $('hpBar').firstElementChild.style.transform=`scaleX(${Math.max(0,player.hp/player.maxHp)})`;
  $('hpText').textContent=`${Math.ceil(player.hp)} HP • ${Math.ceil(player.shield)} SHIELD${player.reloading>0?' • RELOADING…':''}${G.superMode>0?' • ⚡ SUPER ACTIVE ('+G.goldenShots+' shots)':''}`;
  $('wave').textContent=G.wave===0?'INBOUND':('WAVE '+G.wave+(G.wave%5===0&&enemies.some(e=>e.kind==='warden'&&!e.dead)?' — ☠ WARDEN ☠':''));
  $('classLabel').textContent=`${CLASSES[G.classKey].name} • LVL ${1+Math.floor(G.kills/12)}`;
  $('lvlLabel').textContent='LIGHT '+G.light;
  updateSuper(); updateAmmo();
  const cds=[[G.grenadeCd,'abGrenade'],[G.meleeCd,'abMelee'],[G.riftCd,'abRift']];
  cds.forEach(([cd,id])=>{ const el=document.querySelector('#'+id+' .cd'); if(cd>0){el.classList.remove('hidden');el.textContent=Math.ceil(cd);} else el.classList.add('hidden'); });
  if(G.superCharge>=100){ $('superWrap').style.boxShadow='0 0 18px rgba(245,197,66,.7)'; } else $('superWrap').style.boxShadow='none';
}
// radar
const radar=$('radar').getContext('2d');
function drawRadar(){
  radar.clearRect(0,0,148,148);
  radar.save(); radar.translate(74,74);
  radar.strokeStyle='rgba(125,249,255,.25)'; radar.beginPath(); radar.arc(0,0,60,0,7); radar.stroke();
  radar.beginPath(); radar.arc(0,0,32,0,7); radar.stroke();
  // beacon
  radar.fillStyle='#7df9ff'; radar.fillRect(-2,-2,4,4);
  const yaw=player.yaw;
  const dot=(wx,wz,color,size=3)=>{
    const dx=wx-player.pos.x, dz=wz-player.pos.z;
    const rx=dx*Math.cos(-yaw)-dz*Math.sin(-yaw), rz=dx*Math.sin(-yaw)+dz*Math.cos(-yaw);
    const sx=rx*1.1, sy=rz*1.1;
    if(Math.hypot(sx,sy)>66) return;
    radar.fillStyle=color; radar.beginPath(); radar.arc(sx,sy,size,0,7); radar.fill();
  };
  enemies.forEach(e=>{ if(!e.dead) dot(e.grp.position.x,e.grp.position.z,e.kind==='warden'?'#ff2222':'#ff8a3d',e.kind==='warden'?5:3); });
  pickups.forEach(p=>dot(p.m.position.x,p.m.position.z,'#7df9ff',2));
  // facing wedge
  radar.fillStyle='rgba(255,255,255,.8)'; radar.beginPath(); radar.moveTo(0,-8); radar.lineTo(-5,2); radar.lineTo(5,2); radar.fill();
  radar.restore();
}

// ---------------- main loop ----------------
const clock=new THREE.Clock();
let fps=60, fpsA=0, fpsN=0, fpsT=0;
function loop(){
  requestAnimationFrame(loop);
  const dt=Math.min(0.05,clock.getDelta());
  G.time+=dt;
  fpsA+=dt; fpsN++; fpsT+=dt; if(fpsT>0.5){fps=Math.round(fpsN/fpsA);fpsA=0;fpsN=0;fpsT=0; if(G.locked) $('fps').textContent=`${fps} FPS • ${WEAPONS[player.slot].name}${G.superCharge>=100?' • SUPER READY [X]':''}`;}
  if(window._traveler) window._traveler.rotation.y+=dt*0.02;
  if(window._beam){ window._beam.rotation.y+=dt*0.6; window._beam.material.opacity=0.28+Math.sin(G.time*2.5)*0.1; }
  if(window._holo){ window._holo.rotation.y+=dt*1.4; window._holo.position.y=5.2+Math.sin(G.time*2)*0.25; }
  beaconLight.intensity=70+Math.sin(G.time*3)*15;
  if(G.started&&!G.paused&&!G.dead&&!G.won){
    updatePlayer(dt);
    tryFire(dt);
    const alive=updateEnemies(dt);
    updateProjectiles(dt);
    updateParticles(dt); updateFloaters(dt);
    updateWaves(dt,alive);
    updateHUD(dt); drawRadar();
  } else {
    updateParticles(G.paused?0:dt); updateFloaters(G.paused?0:dt);
    // idle menu camera orbit
    if(!G.started){ const t=G.time*0.08; camera.position.set(Math.sin(t)*30,10,Math.cos(t)*30); camera.lookAt(0,6,0); camera.fov=60; camera.updateProjectionMatrix(); }
  }
  renderer.render(scene,camera);
}
applyQuality('med');
updateAmmo(); updateSlots();
loop();

// auto quality drop if slow
setInterval(()=>{ if(fps<28&&renderer.getPixelRatio()>0.8&&G.started){ renderer.setPixelRatio(0.8); } },4000);
