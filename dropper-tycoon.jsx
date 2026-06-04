
import { useState, useEffect, useRef, useCallback } from "react";

// ==================== CONSTANTS ====================
const BAD_WORDS = ["nigger","nigga","nazi","hitler","fuck","shit","bitch","cunt","faggot","retard","kike","spic","chink","whore","slut","asshole","bastard","dick","cock","pussy","rape","pedophile","nonce","cuck","tranny","dyke"];
function containsBadWord(str) {
  const l = str.toLowerCase();
  return BAD_WORDS.some(w => l.includes(w));
}

const SPEED_TIERS = [1,1.5,2,3,4,5,6,7,8,9,10];
const HOLE_SIZES = [70,90,110,135,165,200];
const DROPPER_THEMES = [
  {name:"IRON",    c1:"#7a7a7a",c2:"#c0c0c0",c3:"#555",glow:"#aaaaaa"},
  {name:"COPPER",  c1:"#b87333",c2:"#e8a96b",c3:"#7a3e10",glow:"#e8a96b"},
  {name:"SILVER",  c1:"#b0b0c0",c2:"#e8e8f8",c3:"#707080",glow:"#c8c8ff"},
  {name:"GOLD",    c1:"#ffd700",c2:"#ffe88a",c3:"#cc8800",glow:"#ffd700"},
  {name:"EMERALD", c1:"#00aa55",c2:"#00ff88",c3:"#005522",glow:"#00ff88"},
  {name:"SAPPHIRE",c1:"#0055cc",c2:"#44aaff",c3:"#002288",glow:"#44aaff"},
  {name:"RUBY",    c1:"#cc1133",c2:"#ff5577",c3:"#880011",glow:"#ff4466"},
  {name:"AMETHYST",c1:"#9944cc",c2:"#cc88ff",c3:"#661199",glow:"#cc88ff"},
  {name:"PLASMA",  c1:"#ff00bb",c2:"#ff88ee",c3:"#aa0077",glow:"#ff00ff"},
  {name:"COSMIC",  c1:"#00ddff",c2:"#88ffff",c3:"#008899",glow:"#00e5ff"},
];
function getTheme(lvl) { return DROPPER_THEMES[Math.min(9,Math.floor((lvl-1)/10))]; }

const COMBO_ADJECTIVES=["VOID","NOVA","STORM","FLUX","NEXUS","ULTRA","HYPER","MEGA","OMEGA","ALPHA","PRIME","APEX","ZENITH","AETHER","SOLARIS","LUNAR","TITAN","PHOENIX","SHADOW","BLAZE"];
const COMBO_NOUNS=["CORE","PULSE","BEAM","WAVE","FIELD","MATRIX","ENGINE","FORGE","CRYSTAL","SHARD","PRISM","NEXUS","VORTEX","EMBER","RIFT","EPOCH","HERALD","SPECTER","LANCE","THRONE"];
const ABILITIES=[
  {a:"DOUBLE PULSE",d:"Fires 2 extra balls per drop cycle"},
  {a:"GOLD MAGNET",d:"+60% coin value on every drop"},
  {a:"CHAIN REACTION",d:"Each drop triggers a bonus cascade"},
  {a:"SPEED AURA",d:"3x drop rate multiplier for this dropper"},
  {a:"CRYSTAL BURST",d:"15% chance for 8x value super-drop"},
  {a:"VOID SIPHON",d:"Absorbs +20% value from all nearby droppers"},
  {a:"PLASMA SHIELD",d:"Earns passive income even when idle"},
  {a:"NOVA STORM",d:"Each ball splits into 3 on collection"},
  {a:"MATRIX LOOP",d:"Every 10th drop is worth 12x value"},
  {a:"OMEGA PULSE",d:"Periodically boosts all droppers by +25%"},
  {a:"FLUX DRIVE",d:"Speed gradually increases until max is reached"},
  {a:"APEX FORGE",d:"All upgrade costs reduced by 35%"},
  {a:"STAR CANNON",d:"Randomly fires star-shaped mega-drops"},
  {a:"TIME WARP",d:"Slows time locally, drops land harder"},
  {a:"GRAVITY WELL",d:"Pulls nearby balls into the collector"},
];

function generateComboName() {
  return COMBO_ADJECTIVES[Math.floor(Math.random()*COMBO_ADJECTIVES.length)]+" "+COMBO_NOUNS[Math.floor(Math.random()*COMBO_NOUNS.length)];
}
function generateAbility() { return ABILITIES[Math.floor(Math.random()*ABILITIES.length)]; }

function fmtMoney(n) {
  if(n>=1e12) return "$"+(n/1e12).toFixed(2)+"T";
  if(n>=1e9)  return "$"+(n/1e9).toFixed(2)+"B";
  if(n>=1e6)  return "$"+(n/1e6).toFixed(2)+"M";
  if(n>=1e3)  return "$"+(n/1e3).toFixed(1)+"K";
  return "$"+Math.floor(n);
}

function ballColor(val) {
  if(val<=25)   return {bg:"#888",ring:"#aaa",text:"#fff"};
  if(val<=75)   return {bg:"#b87333",ring:"#e8a96b",text:"#fff"};
  if(val<=150)  return {bg:"#b0b0c0",ring:"#e8e8f8",text:"#333"};
  if(val<=300)  return {bg:"#ffd700",ring:"#ffe88a",text:"#333"};
  if(val<=600)  return {bg:"#00aa55",ring:"#00ff88",text:"#fff"};
  if(val<=1200) return {bg:"#0055cc",ring:"#44aaff",text:"#fff"};
  if(val<=2500) return {bg:"#cc1133",ring:"#ff5577",text:"#fff"};
  if(val<=5000) return {bg:"#9944cc",ring:"#cc88ff",text:"#fff"};
  if(val<=10000)return {bg:"#ff00bb",ring:"#ff88ee",text:"#fff"};
  return {bg:"conic",ring:"#00e5ff",text:"#fff"};
}

// ==================== STORAGE (shared via Anthropic API simulation) ====================
// We use localStorage as the "server" for this in-browser multiplayer demo
// Keys: dt_users, dt_combos_global, dt_leaderboard, dt_combo_registry

function getDB(key) {
  try { return JSON.parse(localStorage.getItem(key)||"null"); } catch(e) { return null; }
}
function setDB(key,val) {
  try { localStorage.setItem(key,JSON.stringify(val)); } catch(e) {}
}

function getUsers() { return getDB("dt_users")||{}; }
function saveUsers(u) { setDB("dt_users",u); }
function getGlobalCombos() { return getDB("dt_global_combos")||{}; }
function saveGlobalCombos(c) { setDB("dt_global_combos",c); }
function getLeaderboard() { return getDB("dt_leaderboard")||[]; }
function saveLeaderboard(l) { setDB("dt_leaderboard",l); }

function getUserSave(username) {
  const users = getUsers();
  return users[username]?.save || null;
}
function saveUserGame(username, save) {
  const users = getUsers();
  if(!users[username]) return;
  users[username].save = save;
  saveUsers(users);
  // Update leaderboard
  const lb = getLeaderboard().filter(e=>e.name!==username);
  lb.push({name:username, money:save.totalEarned||0, combos:save.foundCombos?.length||0});
  lb.sort((a,b)=>b.money-a.money);
  saveLeaderboard(lb.slice(0,50));
}

// AI password generator (strong, unique, memorable)
const PASS_WORDS=["Blaze","Storm","Nova","Forge","Swift","Prism","Crest","Drift","Ember","Spark","Glint","Vault","Nexus","Pulse","Haze","Comet","Ridge","Frost","Gleam","Apex"];
const PASS_NUMS=["42","77","13","99","007","404","911","256","512","888"];
const PASS_SYMS=["#","@","!","$","*","&"];
function generatePassword() {
  const w1=PASS_WORDS[Math.floor(Math.random()*PASS_WORDS.length)];
  const w2=PASS_WORDS[Math.floor(Math.random()*PASS_WORDS.length)];
  const n=PASS_NUMS[Math.floor(Math.random()*PASS_NUMS.length)];
  const s=PASS_SYMS[Math.floor(Math.random()*PASS_SYMS.length)];
  return `${w1}${s}${w2}${n}`;
}

let idCounter = Date.now();
function newId() { return ++idCounter; }

// ==================== AUDIO ENGINE ====================
let audioCtx = null, musicGainNode = null, sfxGainNode = null, musicTimer = null;
let musicVol = 0.38, sfxVol = 0.65;

function initAudio() {
  if(audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  musicGainNode = audioCtx.createGain(); musicGainNode.gain.value = musicVol; musicGainNode.connect(audioCtx.destination);
  sfxGainNode = audioCtx.createGain(); sfxGainNode.gain.value = sfxVol; sfxGainNode.connect(audioCtx.destination);
}
function note(freq, type, dur, vol, when, dest) {
  if(!audioCtx) return;
  const o = audioCtx.createOscillator(), g = audioCtx.createGain();
  o.connect(g); g.connect(dest||sfxGainNode);
  o.type = type; o.frequency.value = freq;
  const t = when||audioCtx.currentTime;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t+dur);
  o.start(t); o.stop(t+dur+0.01);
}
function sfxClick() { initAudio(); note(700,"square",.05,.2); note(1000,"sine",.03,.12,audioCtx.currentTime+.025); }
function sfxUpgrade() { initAudio(); [440,550,660,880,1100].forEach((f,i)=>note(f,"triangle",.18,.22,audioCtx.currentTime+i*.07)); }
function sfxCombine() { initAudio();
  [262,330,392,523,659,784,1047].forEach((f,i)=>note(f,"sine",.25,.28,audioCtx.currentTime+i*.06));
  setTimeout(()=>[523,659,784,1047,1319].forEach((f,i)=>note(f,"square",.15,.15,audioCtx.currentTime+i*.04)),500);
}
function sfxMax() { initAudio(); [523,659,784,1047,1319,1568,2093].forEach((f,i)=>note(f,"sine",.35,.3,audioCtx.currentTime+i*.07)); }
function sfxCoin() { if(!audioCtx||Math.random()>.55) return; note(180+Math.random()*200,"sine",.08,.04); }
function sfxLogin() { initAudio(); [330,415,523].forEach((f,i)=>note(f,"sine",.2,.25,audioCtx.currentTime+i*.1)); }

function startMusic() {
  initAudio(); stopMusic();
  // Original energetic synth composition - upbeat melodic trance
  const bpm = 136, beat = 60/bpm, bar = beat*4;
  function playBar() {
    const n = audioCtx.currentTime;
    // Chord progression: Am - F - C - G
    const chords = [[220,261.6,329.6],[174.6,220,261.6],[261.6,329.6,392],[196,246.9,293.7]];
    chords.forEach((chord,ci) => {
      chord.forEach(f => {
        const o=audioCtx.createOscillator(),g=audioCtx.createGain(),filt=audioCtx.createBiquadFilter();
        filt.type="lowpass";filt.frequency.value=600;
        o.connect(filt);filt.connect(g);g.connect(musicGainNode);
        o.type="sawtooth";o.frequency.value=f;
        const t=n+ci*bar/4;
        g.gain.setValueAtTime(.08,t);g.gain.setValueAtTime(.06,t+beat*.9);g.gain.exponentialRampToValueAtTime(.0001,t+bar*.25-.05);
        o.start(t);o.stop(t+bar*.25);
      });
    });
    // Lead melody - cheerful & memorable
    const melody=[
      [659.3,.5],[783.99,.5],[880,.5],[1046.5,.5],
      [987.8,.5],[880,.5],[783.99,.5],[659.3,.5],
      [698.5,.5],[783.99,.25],[698.5,.25],[659.3,.5],[587.3,.5],
      [523.3,.5],[587.3,.5],[659.3,1]
    ];
    let mt=0;
    melody.forEach(([f,dur]) => {
      const o=audioCtx.createOscillator(),g=audioCtx.createGain();
      const t=n+mt*beat*.5;
      o.connect(g);g.connect(musicGainNode);
      o.type="square";o.frequency.value=f;
      g.gain.setValueAtTime(0,.001);g.gain.setValueAtTime(.07,t);
      g.gain.exponentialRampToValueAtTime(.0001,t+dur*beat*.5-.03);
      o.start(t);o.stop(t+dur*beat*.5);
      mt+=dur;
    });
    // Counter-melody (higher octave, softer)
    const counter=[
      [1318.5,.5],[1174.7,.5],[1046.5,.5],[987.8,.5],
      [1046.5,.5],[1174.7,.5],[1318.5,.5],[1568,.5],
      [1397,.5],[1318.5,.5],[1174.7,.5],[1046.5,.5],
      [987.8,.5],[880,.5],[987.8,.25],[1046.5,.25],[880,1]
    ];
    let ct=0;
    counter.forEach(([f,dur]) => {
      const o=audioCtx.createOscillator(),g=audioCtx.createGain();
      const t=n+ct*beat*.5;
      o.connect(g);g.connect(musicGainNode);
      o.type="triangle";o.frequency.value=f;
      g.gain.setValueAtTime(0,.001);g.gain.setValueAtTime(.035,t);
      g.gain.exponentialRampToValueAtTime(.0001,t+dur*beat*.5-.03);
      o.start(t);o.stop(t+dur*beat*.5);
      ct+=dur;
    });
    // Bass line
    const bassLine=[130.8,130.8,87.3,130.8,174.6,130.8,87.3,116.5];
    bassLine.forEach((f,i) => {
      const o=audioCtx.createOscillator(),g=audioCtx.createGain(),filt=audioCtx.createBiquadFilter();
      filt.type="lowpass";filt.frequency.value=280;
      o.connect(filt);filt.connect(g);g.connect(musicGainNode);
      o.type="sawtooth";o.frequency.value=f;
      const t=n+i*beat*.5;
      g.gain.setValueAtTime(.18,t);g.gain.exponentialRampToValueAtTime(.0001,t+beat*.45);
      o.start(t);o.stop(t+beat*.5);
    });
    // Kick
    for(let i=0;i<8;i++) {
      const o=audioCtx.createOscillator(),g=audioCtx.createGain();
      o.connect(g);g.connect(musicGainNode);o.type="sine";
      const t=n+i*beat*.5;
      o.frequency.setValueAtTime(110,t);o.frequency.exponentialRampToValueAtTime(25,t+.13);
      g.gain.setValueAtTime(.4,t);g.gain.exponentialRampToValueAtTime(.0001,t+.15);
      o.start(t);o.stop(t+.16);
    }
    // Snare on beats 2&4
    [1,3,5,7].forEach(i=>{
      const buf=audioCtx.createBuffer(1,audioCtx.sampleRate*.06,audioCtx.sampleRate);
      const d=buf.getChannelData(0);for(let j=0;j<d.length;j++)d[j]=(Math.random()*2-1);
      const src=audioCtx.createBufferSource(),g=audioCtx.createGain(),filt=audioCtx.createBiquadFilter();
      filt.type="bandpass";filt.frequency.value=3000;filt.Q.value=0.8;
      src.buffer=buf;src.connect(filt);filt.connect(g);g.connect(musicGainNode);
      const t=n+i*beat*.5;
      g.gain.setValueAtTime(.12,t);g.gain.exponentialRampToValueAtTime(.0001,t+.055);
      src.start(t);src.stop(t+.06);
    });
    // Hi-hats
    for(let i=0;i<16;i++) {
      const buf=audioCtx.createBuffer(1,audioCtx.sampleRate*.04,audioCtx.sampleRate);
      const d=buf.getChannelData(0);for(let j=0;j<d.length;j++)d[j]=(Math.random()*2-1);
      const src=audioCtx.createBufferSource(),g=audioCtx.createGain(),filt=audioCtx.createBiquadFilter();
      filt.type="highpass";filt.frequency.value=10000;
      src.buffer=buf;src.connect(filt);filt.connect(g);g.connect(musicGainNode);
      const t=n+i*beat*.25;
      const vol=i%2===0?.065:.035;
      g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.0001,t+.03);
      src.start(t);src.stop(t+.04);
    }
    // Arpeggiated synth
    const arp=[523.3,659.3,784,1046.5,784,659.3,523.3,440,523.3,659.3,784,1046.5,1318.5,1046.5,784,659.3];
    arp.forEach((f,i) => {
      const o=audioCtx.createOscillator(),g=audioCtx.createGain();
      o.connect(g);g.connect(musicGainNode);o.type="sine";o.frequency.value=f;
      const t=n+i*beat*.25;
      g.gain.setValueAtTime(.045,t);g.gain.exponentialRampToValueAtTime(.0001,t+beat*.22);
      o.start(t);o.stop(t+beat*.25);
    });
    musicTimer = setTimeout(playBar, bar*1000);
  }
  playBar();
}
function stopMusic() { if(musicTimer){clearTimeout(musicTimer);musicTimer=null;} }

// ==================== CANVAS DROPPER RENDERER ====================
function drawDropper(canvas, lvl, isCombined, combineData) {
  if(!canvas) return;
  const ctx = canvas.getContext("2d");
  const w=canvas.width, h=canvas.height, cx=w/2, cy=h*.48;
  ctx.clearRect(0,0,w,h);
  const t = isCombined ? combineData.theme : getTheme(lvl);

  // Outer glow ring
  ctx.beginPath(); ctx.arc(cx,cy,w*.44,0,Math.PI*2);
  ctx.strokeStyle=t.glow+"55"; ctx.lineWidth=3; ctx.stroke();

  // Main body gradient
  const gr=ctx.createRadialGradient(cx-w*.1,cy-h*.1,w*.04,cx,cy,w*.42);
  gr.addColorStop(0,t.c2);gr.addColorStop(.55,t.c1);gr.addColorStop(1,t.c3);
  ctx.beginPath();ctx.arc(cx,cy,w*.42,0,Math.PI*2);
  ctx.fillStyle=gr;ctx.fill();
  ctx.strokeStyle=t.glow+"99";ctx.lineWidth=1.5;ctx.stroke();

  // Inner highlight
  const hl=ctx.createRadialGradient(cx-w*.12,cy-h*.12,0,cx-w*.1,cy-h*.1,w*.25);
  hl.addColorStop(0,"rgba(255,255,255,.45)");hl.addColorStop(1,"rgba(255,255,255,0)");
  ctx.beginPath();ctx.arc(cx,cy,w*.42,0,Math.PI*2);ctx.fillStyle=hl;ctx.fill();

  // Orbital rings for higher levels / combos
  const rings = isCombined ? 3 : Math.floor((lvl-1)/25);
  for(let r=1;r<=rings;r++){
    ctx.beginPath();ctx.arc(cx,cy,w*(.44+r*.1),0,Math.PI*2);
    ctx.strokeStyle=t.glow+(r===1?"66":"33");ctx.lineWidth=1;ctx.stroke();
  }
  // Spokes for lvl > 30 or combined
  if(lvl>30||isCombined){
    const spokes=isCombined?8:Math.min(8,Math.floor(lvl/15)+2);
    for(let i=0;i<spokes;i++){
      const a=i*(Math.PI*2/spokes),x2=cx+Math.cos(a)*w*.38,y2=cy+Math.sin(a)*w*.38;
      ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(x2,y2);
      ctx.strokeStyle=t.c2+"55";ctx.lineWidth=1;ctx.stroke();
      ctx.beginPath();ctx.arc(x2,y2,w*.06,0,Math.PI*2);
      ctx.fillStyle=t.c2+"88";ctx.fill();
    }
  }
  // Drop count dots
  const dots=Math.min(8,1+Math.floor((lvl-1)/13));
  for(let i=0;i<dots;i++){
    const a=(i/dots)*Math.PI*2-Math.PI/2;
    const dx=cx+Math.cos(a)*w*.26,dy=cy+Math.sin(a)*h*.26;
    ctx.beginPath();ctx.arc(dx,dy,w*.045,0,Math.PI*2);
    ctx.fillStyle=t.c2;ctx.fill();
  }
  // Label
  const label = isCombined ? (combineData.shortName||"C") : String(lvl);
  ctx.font=`bold ${w*.22}px Orbitron,monospace`;
  ctx.textAlign="center";ctx.textBaseline="middle";
  ctx.fillStyle="rgba(0,0,0,.45)";ctx.fillText(label,cx+1,cy+1);
  ctx.fillStyle="#fff";ctx.fillText(label,cx,cy);
}

// ==================== MAIN COMPONENT ====================
export default function DropTycoon() {
  // Screen states: loading | auth | game
  const [screen, setScreen] = useState("loading");
  const [authMode, setAuthMode] = useState("choose"); // choose | signup | login
  const [loadPct, setLoadPct] = useState(0);
  const [loadTip, setLoadTip] = useState("Tip: Combine droppers to discover unique abilities");

  // Auth
  const [nameInput, setNameInput] = useState("");
  const [passInput, setPassInput] = useState("");
  const [authErr, setAuthErr] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [currentUser, setCurrentUser] = useState(null);

  // Game state
  const [money, setMoney] = useState(0);
  const [totalEarned, setTotalEarned] = useState(0);
  const [droppers, setDroppers] = useState([]);
  const [maxDroppers, setMaxDroppers] = useState(2);
  const [nextDropperCost, setNextDropperCost] = useState(150);
  const [globalSpeedLvl, setGlobalSpeedLvl] = useState(0);
  const [holeLvl, setHoleLvl] = useState(0);
  const [foundCombos, setFoundCombos] = useState([]);
  const [cps, setCps] = useState(0);

  // UI state
  const [overlay, setOverlay] = useState(null); // settings|reset|found|allcombos|leaderboard|combine
  const [combineStep, setCombineStep] = useState([]); // selected dropper ids
  const [combineSource, setCombineSource] = useState(null);
  const [toast, setToast] = useState([]);
  const [sideTab, setSideTab] = useState("upgrades");
  const [balls, setBalls] = useState([]);

  const moneyRef = useRef(0);
  const totalRef = useRef(0);
  const droppersRef = useRef([]);
  const globalSpeedRef = useRef(0);
  const holeLvlRef = useRef(0);
  const maxDropRef = useRef(2);
  const nextCostRef = useRef(150);
  const foundRef = useRef([]);
  const timerRefs = useRef({});
  const dropZoneRef = useRef(null);
  const currentUserRef = useRef(null);
  const ballIdRef = useRef(0);
  const tickCountRef = useRef({});

  useEffect(()=>{moneyRef.current=money;},[money]);
  useEffect(()=>{totalRef.current=totalEarned;},[totalEarned]);
  useEffect(()=>{droppersRef.current=droppers;},[droppers]);
  useEffect(()=>{globalSpeedRef.current=globalSpeedLvl;},[globalSpeedLvl]);
  useEffect(()=>{holeLvlRef.current=holeLvl;},[holeLvl]);
  useEffect(()=>{maxDropRef.current=maxDroppers;},[maxDroppers]);
  useEffect(()=>{nextCostRef.current=nextDropperCost;},[nextDropperCost]);
  useEffect(()=>{foundRef.current=foundCombos;},[foundCombos]);
  useEffect(()=>{currentUserRef.current=currentUser;},[currentUser]);

  const addToast = useCallback((msg,type="purple")=>{
    const id=Date.now()+Math.random();
    setToast(t=>[...t,{id,msg,type}]);
    setTimeout(()=>setToast(t=>t.filter(x=>x.id!==id)),2400);
  },[]);

  // ---- LOADING ----
  useEffect(()=>{
    const tips=["Tip: Combine droppers to unlock special abilities","Tip: Max a dropper to unlock a new slot","Tip: Upgrade the collector for bigger drops","Tip: Higher level = more drops per cycle","Tip: Combined droppers have unique powers"];
    let ti=0;
    const tipInt=setInterval(()=>{ti=(ti+1)%tips.length;setLoadTip(tips[ti]);},2200);
    let pct=0;
    const loadInt=setInterval(()=>{
      pct+=Math.random()*7+2;
      if(pct>=100){pct=100;clearInterval(loadInt);clearInterval(tipInt);setTimeout(()=>setScreen("auth"),400);}
      setLoadPct(Math.min(100,pct));
    },100);
    return ()=>{clearInterval(tipInt);clearInterval(loadInt);};
  },[]);

  // ---- SAVE / LOAD ----
  function buildSave() {
    return {
      money:moneyRef.current, totalEarned:totalRef.current,
      droppers:droppersRef.current, maxDroppers:maxDropRef.current,
      nextDropperCost:nextCostRef.current, globalSpeedLvl:globalSpeedRef.current,
      holeLvl:holeLvlRef.current, foundCombos:foundRef.current,
    };
  }
  function applySave(save,username) {
    setMoney(save.money||0); moneyRef.current=save.money||0;
    setTotalEarned(save.totalEarned||0); totalRef.current=save.totalEarned||0;
    setDroppers(save.droppers||[]); droppersRef.current=save.droppers||[];
    setMaxDroppers(save.maxDroppers||2); maxDropRef.current=save.maxDroppers||2;
    setNextDropperCost(save.nextDropperCost||150); nextCostRef.current=save.nextDropperCost||150;
    setGlobalSpeedLvl(save.globalSpeedLvl||0); globalSpeedRef.current=save.globalSpeedLvl||0;
    setHoleLvl(save.holeLvl||0); holeLvlRef.current=save.holeLvl||0;
    setFoundCombos(save.foundCombos||[]); foundRef.current=save.foundCombos||[];
  }
  function doSave() {
    if(!currentUserRef.current) return;
    saveUserGame(currentUserRef.current, buildSave());
  }

  // ---- AUTH ----
  function handleSignup() {
    const n=nameInput.trim();
    if(n.length<4){setAuthErr("Name must be at least 4 letters.");return;}
    if(containsBadWord(n)){setAuthErr("That name is not allowed.");return;}
    const users=getUsers();
    if(users[n]){setAuthErr("That name is already taken.");return;}
    const pass=generatePassword();
    users[n]={password:pass,save:null,created:Date.now()};
    saveUsers(users);
    setNewPassword(pass);
    setAuthMode("showpass");
    sfxLogin();
  }
  function handleContinueAfterPass() {
    const n=nameInput.trim();
    setCurrentUser(n); currentUserRef.current=n;
    sfxClick();
    enterGame(n,null);
  }
  function handleLogin() {
    const n=nameInput.trim();
    const p=passInput.trim();
    const users=getUsers();
    if(!users[n]){setAuthErr("No account with that name.");return;}
    if(users[n].password!==p){setAuthErr("Wrong password.");return;}
    setCurrentUser(n); currentUserRef.current=n;
    sfxLogin();
    enterGame(n, users[n].save);
  }
  function enterGame(username, save) {
    if(save){
      applySave(save,username);
    } else {
      const firstDp=makeDropper(1);
      setDroppers([firstDp]); droppersRef.current=[firstDp];
      setMoney(0); setTotalEarned(0);
      setMaxDroppers(2); setGlobalSpeedLvl(0);
      setHoleLvl(0); setFoundCombos([]);
      setNextDropperCost(150);
    }
    setScreen("game");
    startMusic();
  }

  useEffect(()=>{
    if(screen==="game"){
      restartTimers();
    }
    return ()=>{if(screen!=="game")stopAllTimers();};
  },[screen]);

  // ---- DROPPER LOGIC ----
  function makeDropper(lvl,x,y){
    return {id:newId(),lvl:Math.max(1,Math.min(100,lvl||1)),x:x||80+Math.random()*60,y:y||70+Math.random()*60,isCombined:false,combineData:null,speedLocal:0};
  }
  function dpValue(dp){
    const base=dp.lvl*5;
    if(dp.isCombined){
      let mult=1;
      if(dp.combineData.ability==="GOLD MAGNET")mult=1.6;
      if(dp.combineData.ability==="MATRIX LOOP")mult=1.1;
      return Math.floor(base*1.5*mult);
    }
    return base;
  }
  function dpInterval(dp,gSpd){
    const gm=SPEED_TIERS[Math.min(10,gSpd??globalSpeedRef.current)];
    const lm=SPEED_TIERS[Math.min(10,dp.speedLocal||0)];
    const cm=dp.isCombined&&dp.combineData.ability==="SPEED AURA"?3:1;
    return Math.max(250,2200/(gm*lm*cm));
  }
  function dpDropCount(dp){
    const base=1+Math.floor((dp.lvl-1)/13);
    let b=0;
    if(dp.isCombined){
      if(dp.combineData.ability==="DOUBLE PULSE")b=2;
      if(dp.combineData.ability==="NOVA STORM")b=2;
      if(dp.combineData.ability==="CHAIN REACTION")b=1;
    }
    return base+b;
  }
  function calcCPS(dps,gSpd){
    return (dps||droppersRef.current).reduce((s,dp)=>{
      const iv=dpInterval(dp,gSpd??globalSpeedRef.current)/1000;
      return s+dpValue(dp)*dpDropCount(dp)/iv;
    },0);
  }

  function stopAllTimers(){
    Object.values(timerRefs.current).forEach(clearTimeout);
    timerRefs.current={};
  }
  function restartTimers(){
    stopAllTimers();
    droppersRef.current.forEach(dp=>scheduleDrop(dp));
  }
  function scheduleDrop(dp){
    const iv=dpInterval(dp);
    const t=setTimeout(()=>executeDrop(dp),iv*(0.5+Math.random()*0.5));
    timerRefs.current[dp.id]=t;
  }
  function executeDrop(dp){
    // re-fetch dp from current state
    const latest=droppersRef.current.find(d=>d.id===dp.id);
    if(!latest) return;
    let val=dpValue(latest);
    const cnt=dpDropCount(latest);
    // Special abilities
    if(latest.isCombined){
      if(latest.combineData.ability==="CRYSTAL BURST"&&Math.random()<.15) val*=8;
      tickCountRef.current[latest.id]=(tickCountRef.current[latest.id]||0)+1;
      if(latest.combineData.ability==="MATRIX LOOP"&&tickCountRef.current[latest.id]%10===0) val*=12;
    }
    const earn=val*cnt;
    moneyRef.current+=earn; totalRef.current+=earn;
    setMoney(m=>m+earn);
    setTotalEarned(t=>t+earn);
    setCps(calcCPS());
    spawnBalls(latest,cnt,val);
    sfxCoin();
    const save=buildSave();
    save.money=moneyRef.current;save.totalEarned=totalRef.current;
    if(currentUserRef.current) saveUserGame(currentUserRef.current,save);
    const t=setTimeout(()=>executeDrop(latest),dpInterval(latest));
    timerRefs.current[latest.id]=t;
  }

  function spawnBalls(dp,count,val){
    if(!dropZoneRef.current) return;
    const zr=dropZoneRef.current.getBoundingClientRect();
    const dpEl=document.getElementById("dp-"+dp.id);
    if(!dpEl) return;
    const er=dpEl.getBoundingClientRect();
    const sx=(er.left+er.right)/2-zr.left;
    const sy=er.bottom-zr.top-10;
    const holeEls=dropZoneRef.current.querySelectorAll(".collector-hole");
    const dpIdx=droppersRef.current.findIndex(d=>d.id===dp.id);
    let tx=sx, ty=zr.height-45;
    if(holeEls[dpIdx]){
      const hr=holeEls[dpIdx].getBoundingClientRect();
      tx=(hr.left+hr.right)/2-zr.left;
    }
    for(let i=0;i<count;i++){
      const bid=++ballIdRef.current;
      const offsetX=(i-(count-1)/2)*16;
      setBalls(b=>[...b,{id:bid,x:sx+offsetX,y:sy,tx:tx+offsetX*.3,ty,val,start:Date.now(),dur:800+Math.random()*400}]);
      setTimeout(()=>setBalls(b=>b.filter(x=>x.id!==bid)),1400);
    }
  }

  // ---- UPGRADE DROPPER ----
  function upgradeDp(dpId){
    setDroppers(dps=>{
      const dp=dps.find(d=>d.id===dpId);
      if(!dp||dp.lvl>=100) return dps;
      const cost=dp.lvl*40*(dp.isCombined?1.5:1);
      if(moneyRef.current<cost) return dps;
      moneyRef.current-=cost;
      setMoney(moneyRef.current);
      const nd={...dp,lvl:Math.min(100,dp.lvl+1)};
      let nm=maxDropRef.current;
      if(nd.lvl===100){nm++;setMaxDroppers(nm);maxDropRef.current=nm;addToast("LVL 100! Dropper slot +1 unlocked","gold");}
      sfxUpgrade();
      const newDps=dps.map(d=>d.id===dpId?nd:d);
      droppersRef.current=newDps;
      setCps(calcCPS(newDps));
      doSave();
      return newDps;
    });
  }
  function upgradeDpSpeed(dpId){
    setDroppers(dps=>{
      const dp=dps.find(d=>d.id===dpId);
      if(!dp||(dp.speedLocal||0)>=10) return dps;
      const cost=200*Math.pow(3,(dp.speedLocal||0));
      if(moneyRef.current<cost) return dps;
      moneyRef.current-=cost;setMoney(moneyRef.current);
      const nd={...dp,speedLocal:(dp.speedLocal||0)+1};
      const newDps=dps.map(d=>d.id===dpId?nd:d);
      droppersRef.current=newDps;
      sfxUpgrade();
      // restart timer for this dropper
      if(timerRefs.current[dpId]) clearTimeout(timerRefs.current[dpId]);
      scheduleDrop(nd);
      setCps(calcCPS(newDps));
      addToast("Drop speed increased!","green");
      doSave();
      return newDps;
    });
  }
  function dropperMax(dpId){
    setDroppers(dps=>{
      const dp=dps.find(d=>d.id===dpId);
      if(!dp||dp.lvl>=100) return dps;
      const cost=(100-dp.lvl)*50*(dp.isCombined?2:1);
      if(moneyRef.current<cost) return dps;
      moneyRef.current-=cost;setMoney(moneyRef.current);
      const nd={...dp,lvl:100};
      let nm=maxDropRef.current+1;setMaxDroppers(nm);maxDropRef.current=nm;
      sfxMax();
      addToast("DROPPER MAXED! New slot unlocked!","gold");
      const newDps=dps.map(d=>d.id===dpId?nd:d);
      droppersRef.current=newDps;
      setCps(calcCPS(newDps));
      doSave();
      return newDps;
    });
  }

  // ---- GLOBAL UPGRADES ----
  const GLOBAL_UPGRADES=[
    {id:"speed",name:"GLOBAL SPEED",desc:"All droppers gain a speed tier",costBase:300,costMult:4,maxLevel:10,color:"#0077ff",stateGet:()=>globalSpeedLvl,stateSet:setGlobalSpeedLvl,ref:globalSpeedRef},
    {id:"hole",name:"COLLECTOR SIZE",desc:"Bigger hole, higher earn radius",costBase:500,costMult:3.5,maxLevel:5,color:"#a855f7",stateGet:()=>holeLvl,stateSet:setHoleLvl,ref:holeLvlRef},
  ];
  function doGlobalUpg(upg){
    const lvl=upg.stateGet();
    if(lvl>=upg.maxLevel) return;
    const cost=Math.floor(upg.costBase*Math.pow(upg.costMult,lvl));
    if(moneyRef.current<cost) return;
    moneyRef.current-=cost;setMoney(moneyRef.current);
    upg.stateSet(lvl+1);upg.ref.current=lvl+1;
    if(upg.id==="speed") setCps(calcCPS(droppersRef.current,lvl+1));
    sfxUpgrade();addToast(upg.name+" upgraded!","green");doSave();
  }

  // ---- ADD DROPPER ----
  function addDropper(){
    if(droppersRef.current.length>=maxDropRef.current) return;
    if(moneyRef.current<nextCostRef.current) return;
    moneyRef.current-=nextCostRef.current;setMoney(moneyRef.current);
    const w=(dropZoneRef.current?.offsetWidth||400)-100;
    const idx=droppersRef.current.length;
    const cols=Math.max(1,maxDropRef.current);
    const cw=w/cols;
    const x=Math.floor(cw*idx+cw/2-35)+10;
    const y=60+Math.random()*80;
    const dp=makeDropper(1,x,y);
    const newDps=[...droppersRef.current,dp];
    setDroppers(newDps);droppersRef.current=newDps;
    const newCost=Math.floor(nextCostRef.current*2.5);
    setNextDropperCost(newCost);nextCostRef.current=newCost;
    scheduleDrop(dp);
    setCps(calcCPS(newDps));
    addToast("New dropper added!","green");doSave();
    sfxClick();
  }

  // ---- COMBINE ----
  async function doCombine() {
    if(combineStep.length!==2) return;
    const [idA,idB]=combineStep;
    const a=droppersRef.current.find(d=>d.id===idA);
    const b=droppersRef.current.find(d=>d.id===idB);
    if(!a||!b) return;

    const nameA=a.isCombined?a.combineData.name:getTheme(a.lvl).name;
    const nameB=b.isCombined?b.combineData.name:getTheme(b.lvl).name;
    const comboKey=`${nameA}+${nameB}`;
    const comboKeyR=`${nameB}+${nameA}`;

    // Check global combo registry for permanent results
    const globalCombos=getGlobalCombos();
    let resultName, abilityObj, themeIdx;
    if(globalCombos[comboKey]){
      const cached=globalCombos[comboKey];
      resultName=cached.name; abilityObj={a:cached.ability,d:cached.abilityDesc}; themeIdx=cached.themeIdx;
    } else if(globalCombos[comboKeyR]){
      const cached=globalCombos[comboKeyR];
      resultName=cached.name; abilityObj={a:cached.ability,d:cached.abilityDesc}; themeIdx=cached.themeIdx;
    } else {
      // AI generates this combo (permanent from now on)
      resultName=generateComboName();
      abilityObj=generateAbility();
      themeIdx=Math.min(9,Math.floor((a.lvl+b.lvl)/20));
      // Try AI naming
      try {
        const resp=await fetch("https://api.anthropic.com/v1/messages",{
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify({
            model:"claude-sonnet-4-20250514",
            max_tokens:200,
            messages:[{role:"user",content:`You are designing a tycoon game dropper combination system. Two droppers are being combined:
Dropper A: ${nameA} (level ${a.lvl})
Dropper B: ${nameB} (level ${b.lvl})
Return ONLY a JSON object with fields: name (2-word ALL CAPS cool sci-fi name), ability (short 2-3 word ALL CAPS power name), abilityDesc (one sentence description of the ability). Make it feel powerful and unique. No markdown, no extra text, pure JSON only.`}]
          })
        });
        const data=await resp.json();
        const txt=data.content?.map(c=>c.text||"").join("").replace(/```json|```/g,"").trim();
        const parsed=JSON.parse(txt);
        if(parsed.name&&parsed.ability&&parsed.abilityDesc){
          resultName=parsed.name.toUpperCase();
          abilityObj={a:parsed.ability.toUpperCase(),d:parsed.abilityDesc};
        }
      } catch(e){}
      // Save permanently
      globalCombos[comboKey]={name:resultName,ability:abilityObj.a,abilityDesc:abilityObj.d,themeIdx,discoveredBy:currentUserRef.current,discoveredAt:Date.now()};
      saveGlobalCombos(globalCombos);
    }

    const newLvl=Math.min(100,Math.floor((a.lvl+b.lvl)/2)+5);
    const theme={...DROPPER_THEMES[themeIdx]};
    const shortName=resultName.split(" ").map(w=>w[0]).join("");
    const combined={
      id:newId(),lvl:newLvl,
      x:(a.x+b.x)/2,y:Math.min(a.y,b.y),
      isCombined:true,speedLocal:0,
      combineData:{name:resultName,shortName,ability:abilityObj.a,abilityDesc:abilityObj.d,theme,
        parentA:{name:nameA,lvl:a.lvl},parentB:{name:nameB,lvl:b.lvl},level:newLvl}
    };
    // Remove old, add new
    if(timerRefs.current[idA]) clearTimeout(timerRefs.current[idA]);
    if(timerRefs.current[idB]) clearTimeout(timerRefs.current[idB]);
    const newDps=droppersRef.current.filter(d=>d.id!==idA&&d.id!==idB);
    newDps.push(combined);
    setDroppers(newDps);droppersRef.current=newDps;
    scheduleDrop(combined);

    // Add to personal found list
    const fc=[...foundRef.current,{
      name:resultName,parentA:{name:nameA,lvl:a.lvl},parentB:{name:nameB,lvl:b.lvl},
      ability:abilityObj.a,abilityDesc:abilityObj.d,level:newLvl,
      discoveredAt:Date.now(),discoveredBy:currentUserRef.current
    }];
    setFoundCombos(fc);foundRef.current=fc;
    setCps(calcCPS(newDps));
    sfxCombine();setOverlay(null);setCombineStep([]);
    addToast("COMBINED! "+resultName+" created!","gold");doSave();
  }

  // ---- RESET ----
  function doReset(){
    stopAllTimers();
    setMoney(0);moneyRef.current=0;
    setTotalEarned(0);totalRef.current=0;
    const fd=makeDropper(1);
    setDroppers([fd]);droppersRef.current=[fd];
    setMaxDroppers(2);maxDropRef.current=2;
    setNextDropperCost(150);nextCostRef.current=150;
    setGlobalSpeedLvl(0);globalSpeedRef.current=0;
    setHoleLvl(0);holeLvlRef.current=0;
    setFoundCombos([]);foundRef.current=[];
    setCps(0);setBalls([]);
    setOverlay(null);doSave();
    addToast("Progress reset!","red");
    // Back to loading screen
    setScreen("loading");setLoadPct(0);stopMusic();
    let p=0;
    const li=setInterval(()=>{
      p+=Math.random()*8+3;
      if(p>=100){p=100;clearInterval(li);
        setTimeout(()=>{
          setScreen("game");
          startMusic();
          setTimeout(()=>{scheduleDrop(fd);},200);
        },400);
      }
      setLoadPct(Math.min(100,p));
    },100);
  }

  // CPS update
  useEffect(()=>{
    const iv=setInterval(()=>setCps(calcCPS()),2000);
    return ()=>clearInterval(iv);
  },[]);

  // Dropper canvas rendering
  useEffect(()=>{
    droppers.forEach(dp=>{
      const c=document.getElementById("dpcanv-"+dp.id);
      if(c) drawDropper(c,dp.lvl,dp.isCombined,dp.combineData);
    });
  },[droppers]);

  // ==================== STYLES ====================
  const S={
    root:{fontFamily:"'Orbitron',monospace",background:"#05010e",color:"#fff",width:"100%",minHeight:"680px",position:"relative",overflow:"hidden"},
    // BG gradient layers
    bgLayer:{position:"absolute",inset:0,background:"linear-gradient(160deg,#0d0028 0%,#050018 40%,#001228 70%,#0a0005 100%)",zIndex:0},
    bgGrid:{position:"absolute",inset:0,backgroundImage:"linear-gradient(#a855f70a 1px,transparent 1px),linear-gradient(90deg,#a855f70a 1px,transparent 1px)",backgroundSize:"44px 44px",zIndex:1},
    // Screens
    screen:{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",zIndex:10},
    // Buttons
    primaryBtn:{fontFamily:"'Orbitron',monospace",fontSize:"13px",letterSpacing:"2px",padding:"14px 40px",border:"1px solid #ff00aa",borderRadius:"7px",background:"linear-gradient(135deg,#ff6b00cc,#ff00aacc)",color:"#fff",cursor:"pointer",transition:"all .2s",minWidth:"220px"},
    secondaryBtn:{fontFamily:"'Orbitron',monospace",fontSize:"12px",letterSpacing:"2px",padding:"12px 40px",border:"1px solid #a855f7",borderRadius:"7px",background:"#1a0835bb",color:"#a855f7",cursor:"pointer",transition:"all .2s",minWidth:"220px"},
    blueBtn:{fontFamily:"'Orbitron',monospace",fontSize:"9px",letterSpacing:"1px",padding:"7px 10px",border:"2px solid #0066ff",borderRadius:"5px",background:"#001133",color:"#66aaff",cursor:"pointer",transition:"all .15s",width:"100%"},
    greenBtn:{fontFamily:"'Orbitron',monospace",fontSize:"9px",letterSpacing:"1px",padding:"7px 10px",border:"2px solid #00aa55",borderRadius:"5px",background:"#002211",color:"#00ff88",cursor:"pointer",transition:"all .15s",width:"100%"},
    purpleBtn:{fontFamily:"'Orbitron',monospace",fontSize:"9px",padding:"6px 8px",border:"1px solid #a855f7",borderRadius:"5px",background:"#1a0835",color:"#a855f7",cursor:"pointer",transition:"all .15s"},
    goldBtn:{fontFamily:"'Orbitron',monospace",fontSize:"9px",padding:"6px 8px",border:"1px solid #ffd700",borderRadius:"5px",background:"#1a1000",color:"#ffd700",cursor:"pointer",transition:"all .15s"},
    redBtn:{fontFamily:"'Orbitron',monospace",fontSize:"9px",padding:"6px 8px",border:"1px solid #ff3355",borderRadius:"5px",background:"#1a0010",color:"#ff4466",cursor:"pointer",transition:"all .15s"},
    cyanBtn:{fontFamily:"'Orbitron',monospace",fontSize:"9px",padding:"6px 8px",border:"1px solid #00e5ff",borderRadius:"5px",background:"#001a22",color:"#00e5ff",cursor:"pointer",transition:"all .15s"},
    input:{fontFamily:"'Orbitron',monospace",fontSize:"12px",padding:"12px 16px",borderRadius:"6px",border:"1px solid #a855f744",background:"#0e0520",color:"#fff",width:"100%",outline:"none"},
    card:{background:"#0e0520cc",border:"1px solid #a855f733",borderRadius:"10px",padding:"12px"},
    modal:{background:"linear-gradient(135deg,#0d0028,#1a0835)",border:"1px solid #a855f7",borderRadius:"14px",padding:"24px",minWidth:"300px",maxWidth:"380px",maxHeight:"560px",display:"flex",flexDirection:"column"},
    overlay:{position:"absolute",inset:0,zIndex:50,display:"flex",alignItems:"center",justifyContent:"center",background:"#000000cc"},
  };

  // ==================== RENDER HELPERS ====================
  function DropperCard({dp}) {
    const t=dp.isCombined?dp.combineData.theme:getTheme(dp.lvl);
    const upCost=dp.lvl>=100?null:dp.lvl*40*(dp.isCombined?1.5:1);
    const spCost=(dp.speedLocal||0)>=10?null:Math.round(200*Math.pow(3,(dp.speedLocal||0)));
    const maxCost=(100-dp.lvl)*50*(dp.isCombined?2:1);
    const pct=(dp.lvl/100)*100;
    const canAffordUp=upCost&&moneyRef.current>=upCost;
    const canAffordSp=spCost&&moneyRef.current>=spCost;
    const canAffordMax=dp.lvl<100&&moneyRef.current>=maxCost;
    return (
      <div style={{...S.card,marginBottom:"8px",borderColor:t.glow+"44"}}>
        <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"8px"}}>
          <canvas id={"dpcanv-"+dp.id} width={52} height={52} style={{borderRadius:"50%",border:"1px solid "+t.glow+"88",flexShrink:0,display:"block"}}/>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontFamily:"'Orbitron',monospace",fontSize:"9px",color:t.glow,letterSpacing:"1px",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
              {dp.isCombined?dp.combineData.name:getTheme(dp.lvl).name}
            </div>
            <div style={{fontSize:"10px",color:t.glow,fontWeight:"bold"}}>LVL {dp.lvl}/100</div>
            <div style={{height:"4px",background:"#1a0835",borderRadius:"2px",marginTop:"3px"}}>
              <div style={{height:"100%",width:pct+"%",background:t.glow,borderRadius:"2px",transition:"width .3s"}}/>
            </div>
            {dp.isCombined&&<div style={{fontSize:"8px",color:"#ff00aa88",marginTop:"2px",fontFamily:"'Orbitron',monospace"}}>{dp.combineData.ability}</div>}
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"4px",marginBottom:"4px"}}>
          <button style={{...S.blueBtn,opacity:canAffordUp?1:.4}} onClick={()=>{sfxClick();upgradeDp(dp.id);}}>
            {upCost?`LVL UP\n${fmtMoney(upCost)}`:"MAX LVL"}
          </button>
          <button style={{...S.blueBtn,borderColor:"#00aacc",color:"#44ccff",opacity:canAffordSp?1:.4}} onClick={()=>{sfxClick();upgradeDpSpeed(dp.id);}}>
            {spCost?`SPD\n${fmtMoney(spCost)}`:"MAX SPD"}
          </button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"4px"}}>
          <button style={{...S.greenBtn,opacity:canAffordMax?1:.4,fontSize:"8px"}} onClick={()=>{sfxClick();dropperMax(dp.id);}}>
            DROPPER MAXER {fmtMoney(maxCost)}
          </button>
          <button style={{...S.purpleBtn,width:"100%"}} onClick={()=>{sfxClick();setCombineSource(dp.id);setCombineStep([dp.id]);setOverlay("combine");}}>
            COMBINE
          </button>
        </div>
      </div>
    );
  }

  function GlobalUpgCard({upg}) {
    const lvl=upg.id==="speed"?globalSpeedLvl:holeLvl;
    const cost=lvl>=upg.maxLevel?null:Math.floor(upg.costBase*Math.pow(upg.costMult,lvl));
    const pct=(lvl/upg.maxLevel)*100;
    const canAfford=cost&&money>=cost;
    return (
      <div style={{...S.card,marginBottom:"8px"}}>
        <div style={{fontFamily:"'Orbitron',monospace",fontSize:"9px",letterSpacing:"1px",marginBottom:"3px"}}>{upg.name}</div>
        <div style={{fontSize:"10px",color:"#ffffff66",marginBottom:"5px"}}>{upg.desc} — LVL {lvl}/{upg.maxLevel}</div>
        <div style={{height:"4px",background:"#1a0835",borderRadius:"2px",marginBottom:"6px"}}>
          <div style={{height:"100%",width:pct+"%",background:upg.color,borderRadius:"2px",transition:"width .3s"}}/>
        </div>
        <button style={{...S.blueBtn,borderColor:upg.color,color:upg.color,opacity:canAfford?1:.4}} onClick={()=>{sfxClick();doGlobalUpg(upg);}}>
          {cost?`UPGRADE ${fmtMoney(cost)}`:"MAXED!"}
        </button>
      </div>
    );
  }

  // ==================== SCREEN: LOADING ====================
  if(screen==="loading") return (
    <div style={S.root}>
      <div style={S.bgLayer}/><div style={S.bgGrid}/>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&display=swap');
      @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
      @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
      @keyframes pulse{0%,100%{opacity:.7}50%{opacity:1}}
      .loadlogo{animation:float 3s ease-in-out infinite}
      .spinner{animation:spin 2s linear infinite}
      `}</style>
      <div style={{...S.screen,gap:"0"}}>
        <div style={{display:"flex",gap:"12px",marginBottom:"28px",animation:"pulse 1.5s infinite"}}>
          {[0,1,2].map(i=><div key={i} style={{width:"22px",height:"22px",borderRadius:"50%",background:`conic-gradient(from ${i*120}deg,#ff6b00,#ff00aa,#a855f7,#00e5ff,#ff6b00)`,animation:`spin ${1.2+i*.3}s linear infinite`}}/>)}
        </div>
        <div className="loadlogo" style={{fontFamily:"'Orbitron',monospace",fontSize:"clamp(24px,5vw,40px)",fontWeight:"900",letterSpacing:"4px",background:"linear-gradient(135deg,#ff6b00,#ff00aa,#a855f7,#00e5ff)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text",marginBottom:"6px"}}>
          DROP TYCOON
        </div>
        <div style={{fontFamily:"'Orbitron',monospace",fontSize:"10px",letterSpacing:"8px",color:"#a855f7",marginBottom:"50px"}}>ULTIMATE EDITION</div>
        <div style={{width:"360px",height:"8px",background:"#120328",borderRadius:"4px",overflow:"hidden",border:"1px solid #a855f733",marginBottom:"10px"}}>
          <div style={{height:"100%",width:loadPct+"%",background:"linear-gradient(90deg,#ff6b00,#ff00aa,#a855f7,#00e5ff)",borderRadius:"4px",transition:"width .12s"}}/>
        </div>
        <div style={{fontFamily:"'Orbitron',monospace",fontSize:"10px",color:"#a855f7",letterSpacing:"2px",marginBottom:"20px"}}>LOADING... {Math.floor(loadPct)}%</div>
        <div style={{fontSize:"11px",color:"#ffffff44",letterSpacing:"1px"}}>{loadTip}</div>
      </div>
    </div>
  );

  // ==================== SCREEN: AUTH ====================
  if(screen==="auth") {
    if(authMode==="choose") return (
      <div style={S.root}>
        <div style={S.bgLayer}/><div style={S.bgGrid}/>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&display=swap');
        @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}`}</style>
        <div style={{...S.screen,gap:"0"}}>
          <div style={{fontFamily:"'Orbitron',monospace",fontSize:"clamp(20px,4vw,34px)",fontWeight:"900",letterSpacing:"3px",background:"linear-gradient(135deg,#ff6b00,#ff00aa,#a855f7)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text",marginBottom:"6px",animation:"float 3s ease-in-out infinite"}}>
            DROP TYCOON
          </div>
          <div style={{fontFamily:"'Orbitron',monospace",fontSize:"9px",letterSpacing:"6px",color:"#a855f766",marginBottom:"52px"}}>ULTIMATE EDITION</div>
          <button style={{...S.primaryBtn,marginBottom:"12px"}} onClick={()=>{sfxClick();setAuthMode("signup");setAuthErr("");}}>SIGN UP</button>
          <button style={S.secondaryBtn} onClick={()=>{sfxClick();setAuthMode("login");setAuthErr("");}}>LOG IN</button>
        </div>
      </div>
    );

    if(authMode==="signup") return (
      <div style={S.root}>
        <div style={S.bgLayer}/><div style={S.bgGrid}/>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&display=swap');`}</style>
        <div style={{...S.screen}}>
          <div style={{...S.modal,minWidth:"320px"}}>
            <div style={{fontFamily:"'Orbitron',monospace",fontSize:"16px",fontWeight:"700",textAlign:"center",marginBottom:"20px",color:"#a855f7"}}>CREATE ACCOUNT</div>
            <div style={{fontSize:"10px",color:"#ffffff66",marginBottom:"8px",fontFamily:"'Orbitron',monospace",letterSpacing:"1px"}}>CHOOSE YOUR NAME</div>
            <input style={{...S.input,marginBottom:"8px"}} placeholder="Enter name (4+ letters)..." value={nameInput} onChange={e=>setNameInput(e.target.value)} maxLength={20}/>
            <div style={{fontSize:"9px",color:"#ffffff44",marginBottom:"16px"}}>Min 4 characters. No inappropriate names.</div>
            {authErr&&<div style={{fontSize:"10px",color:"#ff4466",marginBottom:"12px",fontFamily:"'Orbitron',monospace"}}>{authErr}</div>}
            <button style={{...S.primaryBtn,marginBottom:"8px",opacity:nameInput.trim().length>=4?1:.5}} onClick={()=>{sfxClick();handleSignup();}}>CREATE ACCOUNT</button>
            <button style={{...S.secondaryBtn,padding:"10px"}} onClick={()=>{sfxClick();setAuthMode("choose");setAuthErr(""); setNameInput("");}}>BACK</button>
          </div>
        </div>
      </div>
    );

    if(authMode==="showpass") return (
      <div style={S.root}>
        <div style={S.bgLayer}/><div style={S.bgGrid}/>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&display=swap');`}</style>
        <div style={{...S.screen}}>
          <div style={{...S.modal,minWidth:"320px",alignItems:"center"}}>
            <div style={{fontFamily:"'Orbitron',monospace",fontSize:"14px",fontWeight:"700",textAlign:"center",marginBottom:"16px",color:"#00ff88"}}>ACCOUNT CREATED!</div>
            <div style={{fontSize:"10px",color:"#ffffffaa",marginBottom:"8px",textAlign:"center",fontFamily:"'Orbitron',monospace"}}>Welcome, {nameInput}!</div>
            <div style={{fontSize:"10px",color:"#ffffff66",marginBottom:"12px",textAlign:"center",lineHeight:"1.6"}}>
              Your password has been generated. <span style={{color:"#ff4466"}}>Save it — you'll need it to log back in!</span>
            </div>
            <div style={{background:"#001122",border:"2px solid #00e5ff",borderRadius:"8px",padding:"14px 20px",marginBottom:"20px",textAlign:"center"}}>
              <div style={{fontSize:"9px",color:"#00e5ff88",marginBottom:"4px",fontFamily:"'Orbitron',monospace",letterSpacing:"1px"}}>YOUR PASSWORD</div>
              <div style={{fontFamily:"'Orbitron',monospace",fontSize:"16px",color:"#00e5ff",letterSpacing:"2px",fontWeight:"700"}}>{newPassword}</div>
            </div>
            <button style={{...S.primaryBtn,width:"100%"}} onClick={handleContinueAfterPass}>CONTINUE TO GAME</button>
          </div>
        </div>
      </div>
    );

    if(authMode==="login") return (
      <div style={S.root}>
        <div style={S.bgLayer}/><div style={S.bgGrid}/>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&display=swap');`}</style>
        <div style={{...S.screen}}>
          <div style={{...S.modal,minWidth:"320px"}}>
            <div style={{fontFamily:"'Orbitron',monospace",fontSize:"16px",fontWeight:"700",textAlign:"center",marginBottom:"20px",color:"#a855f7"}}>LOG IN</div>
            <div style={{fontSize:"10px",color:"#ffffff66",marginBottom:"6px",fontFamily:"'Orbitron',monospace",letterSpacing:"1px"}}>NAME</div>
            <input style={{...S.input,marginBottom:"12px"}} placeholder="Your name..." value={nameInput} onChange={e=>setNameInput(e.target.value)} maxLength={20}/>
            <div style={{fontSize:"10px",color:"#ffffff66",marginBottom:"6px",fontFamily:"'Orbitron',monospace",letterSpacing:"1px"}}>PASSWORD</div>
            <input style={{...S.input,marginBottom:"16px"}} type="password" placeholder="Your password..." value={passInput} onChange={e=>setPassInput(e.target.value)}/>
            {authErr&&<div style={{fontSize:"10px",color:"#ff4466",marginBottom:"12px",fontFamily:"'Orbitron',monospace"}}>{authErr}</div>}
            <button style={{...S.primaryBtn,marginBottom:"8px"}} onClick={()=>{sfxClick();handleLogin();}}>LOG IN</button>
            <button style={{...S.secondaryBtn,padding:"10px"}} onClick={()=>{sfxClick();setAuthMode("choose");setAuthErr("");setNameInput("");setPassInput("");}}>BACK</button>
          </div>
        </div>
      </div>
    );
  }

  // ==================== SCREEN: GAME ====================
  const holeSize=HOLE_SIZES[Math.min(5,holeLvl)];
  const atMaxDroppers=droppers.length>=maxDroppers;
  const globalCombos=getGlobalCombos();
  const allFoundCombos=Object.entries(globalCombos).map(([k,v])=>({key:k,...v}));

  return (
    <div style={S.root}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&display=swap');
      @keyframes holeGlow{0%,100%{box-shadow:0 0 12px #a855f755,inset 0 0 20px #000}50%{box-shadow:0 0 24px #a855f7aa,inset 0 0 30px #1a0835}}
      @keyframes ballFloat{from{transform:scale(1)}to{transform:scale(1.08)}}
      @keyframes spinRing{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
      @keyframes glowPulse{0%,100%{filter:brightness(1)}50%{filter:brightness(1.4)}}
      .hdr-btn:hover{opacity:.85;transform:scale(1.04)}
      .drop-btn:hover{opacity:.85}
      .drop-btn:active{transform:scale(.96)}
      `}</style>
      <div style={S.bgLayer}/><div style={S.bgGrid}/>

      {/* Animated particles */}
      <div style={{position:"absolute",inset:0,zIndex:1,pointerEvents:"none"}}>
        {[...Array(30)].map((_,i)=>(
          <div key={i} style={{position:"absolute",width:Math.random()*3+1+"px",height:Math.random()*3+1+"px",borderRadius:"50%",left:Math.random()*100+"%",top:Math.random()*100+"%",background:["#a855f7","#ff00aa","#00e5ff","#ff6b00"][i%4],opacity:Math.random()*.5+.1,animation:`spinRing ${3+Math.random()*4}s linear infinite`,animationDelay:Math.random()*3+"s"}}/>
        ))}
      </div>

      {/* TOP BAR */}
      <div style={{position:"relative",zIndex:20,width:"100%",height:"54px",background:"#06010e99",borderBottom:"1px solid #a855f733",display:"flex",alignItems:"center",padding:"0 12px",gap:"6px",flexShrink:0}}>
        <div style={{background:"#0d0228",border:"1px solid #ffd700",borderRadius:"8px",padding:"5px 12px",display:"flex",alignItems:"center",gap:"8px"}}>
          <div style={{width:"16px",height:"16px",borderRadius:"50%",background:"radial-gradient(#ffe88a,#ffd700,#cc8800)",flexShrink:0}}/>
          <span style={{fontFamily:"'Orbitron',monospace",fontSize:"13px",color:"#ffd700",fontWeight:"700"}}>{fmtMoney(Math.floor(money))}</span>
        </div>
        <div style={{fontFamily:"'Orbitron',monospace",fontSize:"9px",color:"#00ff8888"}}>{fmtMoney(Math.floor(cps))}/s</div>
        <div style={{fontFamily:"'Orbitron',monospace",fontSize:"8px",color:"#a855f766"}}>| {currentUser}</div>
        <div style={{flex:1}}/>
        {[
          {label:"LEADERBOARD",type:"leaderboard",style:S.goldBtn},
          {label:"ALL COMBOS",type:"allcombos",style:S.cyanBtn},
          {label:"MY FOUND",type:"found",style:S.purpleBtn},
          {label:"SETTINGS",type:"settings",style:{...S.purpleBtn,borderColor:"#a855f766"}},
          {label:"RESET",type:"reset",style:S.redBtn},
        ].map(b=>(
          <button key={b.type} className="hdr-btn" style={b.style} onClick={()=>{sfxClick();setOverlay(b.type);}}>
            {b.label}
          </button>
        ))}
      </div>

      {/* GAME BODY */}
      <div style={{position:"relative",zIndex:10,flex:1,display:"flex",width:"100%",overflow:"hidden",minHeight:"0",height:"calc(100% - 54px)"}}>

        {/* DROP ZONE */}
        <div ref={dropZoneRef} style={{flex:1,position:"relative",overflow:"hidden",background:"linear-gradient(180deg,#05010e 0%,#080120 100%)"}}>
          <div style={{position:"absolute",inset:0,backgroundImage:"linear-gradient(#a855f706 1px,transparent 1px),linear-gradient(90deg,#a855f706 1px,transparent 1px)",backgroundSize:"40px 40px"}}/>

          {/* Droppers */}
          {droppers.map(dp=>{
            const t=dp.isCombined?dp.combineData.theme:getTheme(dp.lvl);
            const upCost=dp.lvl>=100?null:dp.lvl*40*(dp.isCombined?1.5:1);
            const maxCost=(100-dp.lvl)*50*(dp.isCombined?2:1);
            return (
              <div key={dp.id} id={"dp-"+dp.id} style={{position:"absolute",left:dp.x+"px",top:dp.y+"px",width:"82px",display:"flex",flexDirection:"column",alignItems:"center"}}>
                <div style={{position:"relative",animation:"glowPulse 2.5s infinite"}}>
                  <canvas id={"dpcanv-"+dp.id} width={70} height={70} style={{display:"block",borderRadius:"50%",border:"2px solid "+t.glow+"88",boxShadow:`0 0 16px ${t.glow}44`}}/>
                </div>
                <div style={{fontFamily:"'Orbitron',monospace",fontSize:"7px",color:t.glow,marginTop:"3px",letterSpacing:"1px",textAlign:"center",maxWidth:"82px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                  {dp.isCombined?dp.combineData.name:getTheme(dp.lvl).name}
                </div>
                <div style={{fontFamily:"'Orbitron',monospace",fontSize:"8px",color:t.glow,fontWeight:"700"}}>LV{dp.lvl}</div>
                <div style={{display:"flex",gap:"3px",marginTop:"3px",flexWrap:"wrap",justifyContent:"center"}}>
                  <button className="drop-btn" style={{...S.blueBtn,fontSize:"6px",padding:"3px 5px",width:"auto",opacity:upCost&&money>=upCost?1:.5}} onClick={()=>{sfxClick();upgradeDp(dp.id);}}>
                    {upCost?`UP ${fmtMoney(upCost)}`:"MAX"}
                  </button>
                  {dp.lvl<100&&<button className="drop-btn" style={{...S.greenBtn,fontSize:"6px",padding:"3px 5px",width:"auto",opacity:money>=maxCost?1:.5}} onClick={()=>{sfxClick();dropperMax(dp.id);}}>
                    MAX {fmtMoney(maxCost)}
                  </button>}
                </div>
              </div>
            );
          })}

          {/* Falling balls */}
          {balls.map(b=>{
            const p=Math.min(1,(Date.now()-b.start)/b.dur);
            const ease=1-Math.pow(1-p,3);
            const x=b.x+(b.tx-b.x)*ease;
            const y=b.y+(b.ty-b.y)*ease;
            const bc=ballColor(b.val);
            const sz=Math.max(16,Math.min(26,12+Math.floor(b.val/60)));
            const isConic=bc.bg==="conic";
            return (
              <div key={b.id} style={{
                position:"absolute",left:x-sz/2+"px",top:y-sz/2+"px",
                width:sz+"px",height:sz+"px",borderRadius:"50%",
                background:isConic?`conic-gradient(#00e5ff,#a855f7,#ff00aa,#ff6b00,#00e5ff)`:bc.bg,
                border:"2px solid "+bc.ring,
                boxShadow:`0 0 8px ${bc.ring}88`,
                display:"flex",alignItems:"center",justifyContent:"center",
                fontFamily:"'Orbitron',monospace",fontSize:Math.max(6,sz-10)+"px",color:bc.text,fontWeight:"700",
                pointerEvents:"none",zIndex:5,
                opacity:p>.82?1-(p-.82)/.18:1,
              }}>
                {b.val>=1000?fmtMoney(b.val):"$"+b.val}
              </div>
            );
          })}

          {/* Collector holes */}
          <div style={{position:"absolute",bottom:"0",left:"0",right:"0",height:"58px",display:"flex",justifyContent:"space-around",alignItems:"flex-end",padding:"0 16px"}}>
            {droppers.map((_,i)=>(
              <div key={i} className="collector-hole" style={{display:"flex",flexDirection:"column",alignItems:"center"}}>
                <div style={{
                  width:holeSize+"px",height:Math.floor(holeSize*.5)+"px",
                  borderRadius:"50%",border:"2px solid #a855f7",
                  background:"radial-gradient(ellipse,#000 25%,#0d0028 55%,#a855f744 100%)",
                  boxShadow:"0 0 20px #a855f766,inset 0 0 25px #000",
                  animation:"holeGlow 2s infinite",
                }}/>
                <div style={{fontFamily:"'Orbitron',monospace",fontSize:"7px",color:"#a855f799",marginTop:"2px",letterSpacing:"1px"}}>COLLECTOR</div>
                <div style={{fontFamily:"'Orbitron',monospace",fontSize:"6px",color:"#00e5ff66"}}>LV{holeLvl+1}</div>
              </div>
            ))}
          </div>
        </div>

        {/* SIDEBAR */}
        <div style={{width:"195px",background:"#06010e",borderLeft:"1px solid #a855f733",display:"flex",flexDirection:"column",overflow:"hidden",flexShrink:0}}>
          {/* Tabs */}
          <div style={{display:"flex",borderBottom:"1px solid #a855f733",flexShrink:0}}>
            {["upgrades","droppers"].map(t=>(
              <button key={t} style={{flex:1,padding:"10px 4px",fontFamily:"'Orbitron',monospace",fontSize:"7px",letterSpacing:".5px",border:"none",cursor:"pointer",background:sideTab===t?"#1a0835":"transparent",color:sideTab===t?"#a855f7":"#ffffff44",borderBottom:sideTab===t?"2px solid #a855f7":"2px solid transparent",transition:"all .2s"}}
                onClick={()=>{sfxClick();setSideTab(t);}}>
                {t.toUpperCase()}
              </button>
            ))}
          </div>
          <div style={{flex:1,overflowY:"auto",padding:"8px",scrollbarWidth:"thin",scrollbarColor:"#a855f744 #06010e"}}>
            {sideTab==="upgrades"&&(
              <>
                {GLOBAL_UPGRADES.map(u=><GlobalUpgCard key={u.id} upg={u}/>)}
                <div style={{fontFamily:"'Orbitron',monospace",fontSize:"8px",color:"#a855f799",textAlign:"center",margin:"8px 0 4px",letterSpacing:".5px"}}>{droppers.length}/{maxDroppers} DROPPERS</div>
                <button style={{...S.goldBtn,width:"100%",padding:"9px",marginBottom:"4px",opacity:!atMaxDroppers&&money>=nextDropperCost?1:.4}} onClick={()=>{addDropper();}}>
                  {atMaxDroppers?"SLOT FULL":`ADD DROPPER\n${fmtMoney(nextDropperCost)}`}
                </button>
              </>
            )}
            {sideTab==="droppers"&&(
              droppers.length===0
                ?<div style={{fontSize:"11px",color:"#ffffff44",textAlign:"center",padding:"20px"}}>No droppers yet</div>
                :droppers.map(dp=><DropperCard key={dp.id} dp={dp}/>)
            )}
          </div>
        </div>
      </div>

      {/* TOASTS */}
      <div style={{position:"absolute",top:"64px",left:"50%",transform:"translateX(-50%)",zIndex:60,display:"flex",flexDirection:"column",gap:"6px",alignItems:"center",pointerEvents:"none"}}>
        {toast.map(t=>(
          <div key={t.id} style={{
            background:t.type==="gold"?"#1a1000":t.type==="green"?"#001a0f":t.type==="red"?"#1a0010":"#0e0520",
            border:`1px solid ${t.type==="gold"?"#ffd700":t.type==="green"?"#00ff88":t.type==="red"?"#ff3355":"#a855f7"}`,
            color:t.type==="gold"?"#ffd700":t.type==="green"?"#00ff88":t.type==="red"?"#ff4466":"#a855f7",
            fontFamily:"'Orbitron',monospace",fontSize:"9px",letterSpacing:"1px",padding:"7px 16px",borderRadius:"5px",whiteSpace:"nowrap",
          }}>{t.msg}</div>
        ))}
      </div>

      {/* OVERLAYS */}
      {overlay&&(
        <div style={S.overlay} onClick={e=>{if(e.target===e.currentTarget){sfxClick();setOverlay(null);}}}>
          {overlay==="settings"&&(
            <div style={S.modal}>
              <div style={{fontFamily:"'Orbitron',monospace",fontSize:"15px",textAlign:"center",marginBottom:"20px",color:"#a855f7"}}>SETTINGS</div>
              {[["MUSIC","music",musicVol,v=>{musicVol=v;if(musicGainNode)musicGainNode.gain.value=v;}],["SFX","sfx",sfxVol,v=>{sfxVol=v;if(sfxGainNode)sfxGainNode.gain.value=v;}]].map(([lbl,id,val,fn])=>(
                <div key={id} style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"14px"}}>
                  <div style={{fontFamily:"'Orbitron',monospace",fontSize:"8px",minWidth:"50px",color:"#ffffffaa"}}>{lbl}</div>
                  <input type="range" min="0" max="100" defaultValue={Math.round(val*100)} style={{flex:1,accentColor:"#a855f7"}} onChange={e=>fn(e.target.value/100)}/>
                  <span style={{fontFamily:"'Orbitron',monospace",fontSize:"9px",color:"#a855f7",minWidth:"28px",textAlign:"right"}} id={"vv-"+id}>{Math.round(val*100)}</span>
                </div>
              ))}
              <button style={{...S.purpleBtn,width:"100%",padding:"11px",marginTop:"4px"}} onClick={()=>{sfxClick();setOverlay(null);}}>CLOSE</button>
            </div>
          )}

          {overlay==="reset"&&(
            <div style={S.modal}>
              <div style={{fontFamily:"'Orbitron',monospace",fontSize:"15px",textAlign:"center",marginBottom:"16px",color:"#ff3355"}}>RESET PROGRESS</div>
              <div style={{fontSize:"12px",color:"#ffdddd",textAlign:"center",marginBottom:"20px",lineHeight:"1.7"}}>Are you sure you want to reset all your progress?<br/><span style={{color:"#ff335588",fontSize:"10px"}}>You'll keep your account and name.</span></div>
              <div style={{display:"flex",gap:"10px"}}>
                <button style={{flex:1,padding:"11px",background:"#330010",border:"1px solid #ff3355",color:"#ff6677",borderRadius:"6px",cursor:"pointer",fontFamily:"'Orbitron',monospace",fontSize:"10px"}} onClick={()=>{sfxClick();doReset();}}>RESET</button>
                <button style={{flex:1,padding:"11px",background:"#1a0835",border:"1px solid #a855f7",color:"#a855f7",borderRadius:"6px",cursor:"pointer",fontFamily:"'Orbitron',monospace",fontSize:"10px"}} onClick={()=>{sfxClick();setOverlay(null);}}>CANCEL</button>
              </div>
            </div>
          )}

          {overlay==="found"&&(
            <div style={{...S.modal,maxHeight:"540px"}}>
              <div style={{fontFamily:"'Orbitron',monospace",fontSize:"15px",textAlign:"center",marginBottom:"16px",color:"#a855f7"}}>MY FOUND COMBOS</div>
              <div style={{flex:1,overflowY:"auto",scrollbarWidth:"thin",scrollbarColor:"#a855f744 transparent"}}>
                {foundCombos.length===0
                  ?<div style={{fontSize:"11px",color:"#ffffff44",textAlign:"center",padding:"20px"}}>No combos yet — combine droppers!</div>
                  :foundCombos.map((c,i)=>(
                    <div key={i} style={{...S.card,marginBottom:"8px",borderColor:"#a855f766"}}>
                      <div style={{fontFamily:"'Orbitron',monospace",fontSize:"10px",color:"#00e5ff",marginBottom:"3px"}}>{c.name}</div>
                      <div style={{fontSize:"10px",color:"#ffffff55",marginBottom:"3px"}}>{c.parentA.name} LV{c.parentA.lvl} + {c.parentB.name} LV{c.parentB.lvl}</div>
                      <div style={{fontSize:"9px",color:"#ff00aa88",fontFamily:"'Orbitron',monospace"}}>{c.ability}: {c.abilityDesc}</div>
                    </div>
                  ))
                }
              </div>
              <button style={{...S.purpleBtn,width:"100%",padding:"11px",marginTop:"10px"}} onClick={()=>{sfxClick();setOverlay(null);}}>CLOSE</button>
            </div>
          )}

          {overlay==="allcombos"&&(
            <div style={{...S.modal,maxHeight:"560px"}}>
              <div style={{fontFamily:"'Orbitron',monospace",fontSize:"14px",textAlign:"center",marginBottom:"16px",color:"#00e5ff"}}>ALL DISCOVERED COMBOS</div>
              <div style={{flex:1,overflowY:"auto",scrollbarWidth:"thin",scrollbarColor:"#00e5ff44 transparent"}}>
                {allFoundCombos.length===0
                  ?<div style={{fontSize:"11px",color:"#ffffff44",textAlign:"center",padding:"20px"}}>No combos discovered globally yet!</div>
                  :allFoundCombos.map((c,i)=>(
                    <div key={i} style={{...S.card,marginBottom:"8px",borderColor:"#00e5ff33"}}>
                      <div style={{fontFamily:"'Orbitron',monospace",fontSize:"10px",color:"#00e5ff",marginBottom:"2px"}}>{c.name}</div>
                      <div style={{fontSize:"10px",color:"#ffffff55",marginBottom:"2px"}}>{c.key.replace("+"," + ")}</div>
                      <div style={{fontSize:"9px",color:"#ff00aa88",fontFamily:"'Orbitron',monospace",marginBottom:"3px"}}>{c.ability}: {c.abilityDesc}</div>
                      {c.discoveredBy&&<div style={{fontSize:"8px",color:"#ffd70088",fontFamily:"'Orbitron',monospace"}}>First found by: {c.discoveredBy}</div>}
                    </div>
                  ))
                }
              </div>
              <button style={{...S.cyanBtn,width:"100%",padding:"11px",marginTop:"10px"}} onClick={()=>{sfxClick();setOverlay(null);}}>CLOSE</button>
            </div>
          )}

          {overlay==="leaderboard"&&(()=>{
            const lb=getLeaderboard();
            return (
              <div style={{...S.modal,maxHeight:"540px"}}>
                <div style={{fontFamily:"'Orbitron',monospace",fontSize:"15px",textAlign:"center",marginBottom:"16px",color:"#ffd700"}}>MONEY RECORDS</div>
                <div style={{flex:1,overflowY:"auto",scrollbarWidth:"thin",scrollbarColor:"#ffd70044 transparent"}}>
                  {lb.length===0
                    ?<div style={{fontSize:"11px",color:"#ffffff44",textAlign:"center",padding:"20px"}}>No records yet!</div>
                    :lb.map((e,i)=>(
                      <div key={i} style={{display:"flex",alignItems:"center",gap:"10px",padding:"8px 10px",background:e.name===currentUser?"#1a1000":"#0e052088",border:`1px solid ${e.name===currentUser?"#ffd700":"#a855f722"}`,borderRadius:"7px",marginBottom:"6px"}}>
                        <div style={{fontFamily:"'Orbitron',monospace",fontSize:"11px",color:i===0?"#ffd700":i===1?"#c0c0c0":i===2?"#b87333":"#ffffff44",minWidth:"20px"}}>#{i+1}</div>
                        <div style={{flex:1}}>
                          <div style={{fontFamily:"'Orbitron',monospace",fontSize:"10px",color:e.name===currentUser?"#ffd700":"#fff"}}>{e.name}</div>
                          <div style={{fontSize:"9px",color:"#ffffff55"}}>{e.combos} combos</div>
                        </div>
                        <div style={{fontFamily:"'Orbitron',monospace",fontSize:"11px",color:"#ffd700"}}>{fmtMoney(Math.floor(e.money))}</div>
                      </div>
                    ))
                  }
                </div>
                <button style={{...S.goldBtn,width:"100%",padding:"11px",marginTop:"10px"}} onClick={()=>{sfxClick();setOverlay(null);}}>CLOSE</button>
              </div>
            );
          })()}

          {overlay==="combine"&&(
            <div style={{...S.modal,maxHeight:"560px"}}>
              <div style={{fontFamily:"'Orbitron',monospace",fontSize:"14px",textAlign:"center",marginBottom:"6px",color:"#a855f7"}}>COMBINE DROPPERS</div>
              <div style={{fontSize:"10px",color:"#ffffff55",textAlign:"center",marginBottom:"12px"}}>Select 2 droppers to fuse into a new form</div>
              <div style={{flex:1,overflowY:"auto",scrollbarWidth:"thin",scrollbarColor:"#a855f744 transparent"}}>
                {droppers.length<2
                  ?<div style={{fontSize:"11px",color:"#ffffff44",textAlign:"center",padding:"20px"}}>You need at least 2 droppers</div>
                  :droppers.map(dp=>{
                    const t=dp.isCombined?dp.combineData.theme:getTheme(dp.lvl);
                    const sel=combineStep.includes(dp.id);
                    return (
                      <div key={dp.id} style={{...S.card,marginBottom:"7px",cursor:"pointer",borderColor:sel?"#00ff88":t.glow+"44",background:sel?"#001a0f":"#0e0520cc"}} onClick={()=>{
                        sfxClick();
                        if(sel){if(dp.id!==combineSource)setCombineStep(s=>s.filter(id=>id!==dp.id));}
                        else{if(combineStep.length<2)setCombineStep(s=>[...s,dp.id]);else setCombineStep([combineSource??dp.id,dp.id]);}
                      }}>
                        <div style={{fontFamily:"'Orbitron',monospace",fontSize:"10px",color:t.glow,marginBottom:"2px"}}>{dp.isCombined?dp.combineData.name:getTheme(dp.lvl).name} {sel&&"✓"}</div>
                        <div style={{fontSize:"10px",color:"#ffffff55"}}>LVL {dp.lvl} • {fmtMoney(dpValue(dp))}/drop</div>
                      </div>
                    );
                  })
                }
              </div>
              <button style={{...S.purpleBtn,width:"100%",padding:"11px",marginTop:"8px",borderColor:"#00ff88",color:"#00ff88",background:"#001a0f",opacity:combineStep.length===2?1:.4}}
                onClick={()=>{sfxClick();if(combineStep.length===2)doCombine();}}>
                {combineStep.length===2?"COMBINE!":"SELECT 2 DROPPERS"}
              </button>
              <button style={{...S.purpleBtn,width:"100%",padding:"9px",marginTop:"6px"}} onClick={()=>{sfxClick();setOverlay(null);setCombineStep([]);}}>CANCEL</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
