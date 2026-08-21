/* ROOT: absolute site root, stays correct at any depth and after SPA navigation */
const ROOT = (function(){
  var sc=document.querySelector('script[src*="js/app.js"]');
  var rel=sc ? sc.getAttribute('src').replace(/js\/app\.js.*$/,'') : '';
  return new URL(rel||'./', location.href).href;
})();

/* ================= PASSWORD POLICY ================= */
const PW_RULES = {
  len:   function(pw){ return pw.length>=8 && pw.length<=31; },
  upper: function(pw){ return /[A-Z]/.test(pw); },
  lower: function(pw){ return /[a-z]/.test(pw); },
  digit: function(pw){ return /[0-9]/.test(pw); },
  name:  function(pw,user){ return !user || pw.toLowerCase().indexOf(user.toLowerCase())===-1; }
};
const PW_TEXT = {
  len:  'Your password must be between 8 and 31 characters.',
  upper:'Your password must contain at least 1 uppercase letter.',
  lower:'Your password must contain at least 1 lowercase letter.',
  digit:'Your password must contain at least 1 number.',
  name: 'Your password cannot contain your username.'
};
function pwCheck(pw,user){
  var out={};
  for(var k in PW_RULES){ out[k]= k==='name' ? PW_RULES[k](pw,user) : PW_RULES[k](pw); }
  return out;
}
function pwFirstError(pw,user){
  var r=pwCheck(pw,user);
  for(var k in r){ if(!r[k]) return PW_TEXT[k]; }
  return null;
}
function pwPaintRules(listId,pw,user){
  var ul=document.getElementById(listId); if(!ul) return;
  var r=pwCheck(pw,user);
  ul.querySelectorAll('li').forEach(function(li){
    var k=li.getAttribute('data-r'); if(!(k in r)) return;
    var ok=r[k];
    li.classList.toggle('pass', ok && pw.length>0);
    li.classList.toggle('fail', !ok && pw.length>0);
    li.querySelector('i').className = 'ti ' + (pw.length===0 ? 'ti-circle' : (ok?'ti-circle-check':'ti-circle-x'));
  });
}

/* ================= ACCOUNT CHIP ================= */
function initials(n){ return (n||'A').trim().charAt(0).toUpperCase(); }
function renderAcct(){
  /* hide the LOGIN signpost once logged in (avoids duplicate entry points) */
  var lp=document.getElementById('pin-login');
  if(lp) lp.style.display = Auth.loggedIn ? 'none' : '';

  var el=document.getElementById('hd-acct'); if(!el) return;
  var isHome = !!document.querySelector('.homebar');
  var disc='<a class="btn-discord" href="'+DISCORD_URL+'"'+
           (DISCORD_URL==='#'?' onclick="alert(\'Discord invite link coming soon\');return false;"':' target="_blank" rel="noopener"')+
           ' title="Join our Discord"><i class="ti ti-brand-discord"></i><span>Discord</span></a>';
  var html=disc;
  if(Auth.loggedIn){
    var n=Auth.user()||'Adventurer';
    html+='<div class="acct-chip" onclick="openPanel(\'account\')">'+
      '<div class="acct-av">'+initials(n)+'</div><span class="acct-nm">'+n+'</span></div>';
  } else if(!isHome){
    /* subpages have no floating signpost, so keep a login entry there */
    html+='<button class="btn-login" onclick="openPanel(\'login\')"><i class="ti ti-login"></i> Login</button>';
  }
  el.innerHTML=html;
}

/* ================= SLIDE PANEL ================= */
function $panel(){ return document.getElementById('panel'); }
function $backdrop(){ return document.getElementById('backdrop'); }
var ICONS={server:'ti-scroll',download:'ti-download',marketplace:'ti-scale',donation:'ti-heart',
           login:'ti-login',register:'ti-user-plus',account:'ti-user-circle'};
var TITLES={server:'Server Detail',download:'Download',donation:'Donation',
            login:'Login',register:'Create Account',account:'My Account'};

function openPanel(type){
  if(type==='marketplace'){ location.href=ROOT+'pages/marketplace.html'; return; }
  if(type==='login' && Auth.loggedIn) type='account';
  if(type==='donation' && !Auth.loggedIn) type='login';
  var panel=$panel(), backdrop=$backdrop();
  if(!panel){ location.href=ROOT; return; }
  document.getElementById('pnl-icon').className='ti '+ICONS[type];
  document.getElementById('pnl-title').textContent=TITLES[type];
  document.getElementById('pnl-body').innerHTML=render(type);
  if(type==='donation') selAmt=null;
  if(type==='account') loadAccountPanel();
  panel.classList.add('show'); backdrop.classList.add('show');
}
function closePanel(){
  var p=$panel(), b=$backdrop();
  if(p) p.classList.remove('show');
  if(b) b.classList.remove('show');
}
function render(t){
  if(t==='login')    return loginHTML();
  if(t==='register') return registerHTML();
  if(t==='account')  return accountHTML();
  if(t==='download') return downloadHTML();
  if(t==='server')   return serverHTML();
  if(t==='donation') return donationHTML();
  return '';
}

/* ---- Login / Register / Account ---- */
function loginHTML(){ return `
  <p class="lead">Sign in to your NeRO account to donate, trade, and track your progress.</p>
  <div id="login-msg"></div>
  <label class="fld">Account ID</label><input class="inp" id="login-id" placeholder="yourname">
  <label class="fld">Password</label><input class="inp" id="login-pw" type="password" placeholder="••••••••">
  <button class="btn-gold" id="login-btn" onclick="doLogin()">Login</button>
  <div class="rowlinks"><a href="#" onclick="return false">Forgot password?</a>
  <a href="#" onclick="openPanel('register');return false">Register</a></div>`;
}
async function doLogin(){
  var id=(document.getElementById('login-id').value||'').trim();
  var pw=document.getElementById('login-pw').value||'';
  if(!NeroAPI.enabled()){                      /* demo mode until backend is live */
    Auth.loggedIn=true; Auth.setUser(id||'Adventurer'); renderAcct(); openPanel('account'); return;
  }
  if(!id||!pw) return panelMsg('login-msg','Enter your username and password.',false);
  var b=document.getElementById('login-btn'); b.disabled=true; b.textContent='Signing in...';
  var res=await NeroAPI.post('/account.php',{action:'login',userid:id,password:pw});
  b.disabled=false; b.textContent='Login';
  if(res&&res.ok){
    Auth.loggedIn=true; Auth.setUser(res.data.userid); Auth.setToken(res.data.token||'');
    renderAcct(); openPanel('account');
  }
  else panelMsg('login-msg',(res&&res.error)||'Could not sign in.',false);
}
function registerHTML(){
  return `
    <p class="lead">Create your NeRO game account. This is the same account you use in-game.</p>
    <div id="reg-msg"></div>
    <label class="fld">Username</label>
    <input class="inp" id="reg-id" placeholder="4-23 letters or numbers" maxlength="23"
           autocomplete="username" oninput="regPwHint()">
    <label class="fld">Email</label>
    <input class="inp" id="reg-mail" type="email" placeholder="name@email.com" maxlength="39">
    <label class="fld">Password</label>
    <input class="inp" id="reg-pw" type="password" placeholder="8-31 characters" maxlength="31"
           autocomplete="new-password" oninput="regPwHint()">
    <ul class="pw-rules" id="reg-rules">
      <li data-r="len"><i class="ti ti-circle"></i> 8 to 31 characters</li>
      <li data-r="upper"><i class="ti ti-circle"></i> At least 1 uppercase letter</li>
      <li data-r="lower"><i class="ti ti-circle"></i> At least 1 lowercase letter</li>
      <li data-r="digit"><i class="ti ti-circle"></i> At least 1 number</li>
      <li data-r="name"><i class="ti ti-circle"></i> Cannot contain your username</li>
    </ul>
    <label class="fld">Confirm password</label>
    <input class="inp" id="reg-pw2" type="password" placeholder="repeat password" maxlength="31" autocomplete="new-password">
    <label class="fld">Gender</label>
    <select class="inp" id="reg-sex"><option value="M">Male</option><option value="F">Female</option></select>
    <button class="btn-gold" id="reg-btn" onclick="doRegister()">Create Account</button>
    <div class="rowlinks"><span></span><a href="#" onclick="openPanel('login');return false">Already have an account?</a></div>`;
}

function panelMsg(id,text,ok){
  var el=document.getElementById(id); if(!el) return;
  el.innerHTML='<div class="note-login" style="'+
    (ok?'background:rgba(70,209,127,.12);border-color:rgba(70,209,127,.5);color:#8ce0b4'
       :'background:rgba(226,75,74,.12);border-color:rgba(226,75,74,.5);color:#f0a3a3')+'">'+text+'</div>';
}
async function doRegister(){
  var id=(document.getElementById('reg-id').value||'').trim();
  var mail=(document.getElementById('reg-mail').value||'').trim();
  var pw=document.getElementById('reg-pw').value||'';
  var pw2=document.getElementById('reg-pw2').value||'';
  var sex=document.getElementById('reg-sex').value||'M';

  if(id.length<4)  return panelMsg('reg-msg','Username must be at least 4 characters.',false);
  if(!/^[A-Za-z0-9_]+$/.test(id)) return panelMsg('reg-msg','Username can only use letters, numbers and underscore.',false);
  var pwErr=pwFirstError(pw,id);
  if(pwErr)        return panelMsg('reg-msg',pwErr,false);
  if(pw!==pw2)     return panelMsg('reg-msg','Passwords do not match.',false);
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) return panelMsg('reg-msg','Please enter a valid email.',false);

  var btn=document.getElementById('reg-btn');
  btn.disabled=true; btn.textContent='Creating...';
  var res=await NeroAPI.post('/account.php',
    {action:'register', userid:id, password:pw, email:mail, sex:sex});
  btn.disabled=false; btn.textContent='Create Account';

  if(res && res.ok){
    panelMsg('reg-msg','Account created. You can log in now.',true);
    setTimeout(function(){ openPanel('login'); },1400);
  }else{
    panelMsg('reg-msg',(res && res.error) || 'Could not create the account.',false);
  }
}

function accountHTML(){
  var n=Auth.user()||'Adventurer';
  return `
  <div class="prof-hero"><div class="prof-av">${initials(n)}</div>
    <div><div class="prof-nm">${n}</div><div class="prof-sub" id="pnl-since">—</div></div></div>
  <div class="kv"><span>Cash Point</span><span id="pnl-cp">—</span></div>
  <div class="kv"><span>Characters</span><span id="pnl-nchar">—</span></div>
  <div class="kv"><span>Guild</span><span id="pnl-guild">—</span></div>
  <div class="kv"><span>Status</span><span id="pnl-status">—</span></div>
  <button class="btn-gold" onclick="openPanel('donation')">Donate / Top Up</button>
  <a class="btn-ghost" href="${ROOT}pages/account.html">Manage Account</a>
  <a class="btn-ghost" href="${ROOT}pages/marketplace.html">My Marketplace Listings</a>
  <button class="btn-ghost" onclick="doLogout()">Log Out</button>`;
}
async function loadAccountPanel(){
  var set=function(id,v,color){
    var e=document.getElementById(id); if(!e) return;
    e.textContent=v; if(color!==undefined) e.style.color=color;
  };
  var d = await NeroAPI.get('me');
  if(!d){
    set('pnl-cp','Not connected'); set('pnl-nchar','—'); set('pnl-guild','—');
    set('pnl-status','—'); set('pnl-since','—');
    return;
  }
  var chars=d.characters||[];
  var anyOnline=chars.some(function(c){ return Number(c.online)===1; });
  var withGuild=chars.filter(function(c){ return c.guild; });
  set('pnl-cp', fmtNum(d.account.cash_point||0)+' CP');
  set('pnl-nchar', chars.length);
  set('pnl-guild', withGuild.length ? withGuild[0].guild : '—');
  set('pnl-status', anyOnline?'Online':'Offline', anyOnline?'#46d17f':'');
  set('pnl-since', d.account.registered ? ('Member since '+d.account.registered) : 'Member');
}
async function doLogout(){
  if(NeroAPI.enabled()){ await NeroAPI.post('/account.php',{action:'logout'}); }
  Auth.logout(); Auth.setToken('');
  renderAcct(); closePanel();
  if(location.pathname.indexOf('account.html')>-1) location.href=ROOT;
}

/* ---- Download ---- */
function downloadHTML(){ return `
  <p class="lead">Download the NeRO game client and patcher to begin your adventure.</p>
  <div class="kv"><span>Client size</span><span>TBC</span></div>
  <div class="kv"><span>OS</span><span>Windows 10 / 11</span></div>
  <a class="btn-gold" href="${DOWNLOAD_URL}" target="_blank" rel="noopener">Download Full Client</a>`;
}

/* ---- Server detail ---- */
function serverHTML(){ var s=SERVER_INFO; return `
  <p class="lead">Core settings of New Era Ragnarok Online — NeRO.</p>
  <div class="kv"><span>Base Rate</span><span>${s.base}</span></div>
  <div class="kv"><span>Job Rate</span><span>${s.job}</span></div>
  <div class="kv"><span>Drop Rate</span><span>${s.drop}</span></div>
  <div class="kv"><span>Max Base Level</span><span>${s.maxbase}</span></div>
  <div class="kv"><span>Max Job Level</span><span>${s.maxjob}</span></div>
  <div class="kv"><span>Episode</span><span>${s.episode}</span></div>
  <label class="fld" style="margin-top:22px">Statistics</label>
  <div class="statbtns">
    <a class="statbtn" href="${ROOT}pages/stat-woe.html"><i class="ti ti-swords"></i>WoE</a>
    <a class="statbtn" href="${ROOT}pages/stat-pvp.html"><i class="ti ti-skull"></i>PvP</a>
    <a class="statbtn" href="${ROOT}pages/stat-mvp.html"><i class="ti ti-crown"></i>MVP</a>
    <a class="statbtn" href="${ROOT}pages/stat-zeny.html"><i class="ti ti-coins"></i>Zeny</a>
  </div>
  <a class="btn-ghost" href="${ROOT}wiki/index.html" style="margin-top:16px">Open Full Wiki</a>`;
}

/* ---- Donation (1 CP : 1 Rp) ---- */
var selAmt=null;
function donationHTML(){
  return `<div class="soon-panel"><i class="ti ti-clock-hour-4"></i>
    <h3>Coming Soon</h3>
    <p>Donations and Cash Point top-ups are being finished up. Check back soon!</p></div>`;
}

function pickAmt(i){ selAmt=i;
  document.querySelectorAll('.amt').forEach(function(e){e.classList.toggle('sel',+e.dataset.i===i);});
  updateSummary();
}
function updateSummary(){
  var box=document.getElementById('don-summary'); if(!box) return;
  if(selAmt===null){ box.innerHTML='Select an amount to see your total.'; return; }
  var cp=DONATE_AMOUNTS[selAmt].cp;
  var streamer=document.getElementById('don-streamer').value;
  var guild=document.getElementById('don-guild').value;
  var bonus=streamer?Math.round(cp*0.10):0;
  box.innerHTML='Base: <b>'+fmtNum(cp)+' CP</b><br>'+
    (streamer?'Streamer bonus (+10%): <b>+'+fmtNum(bonus)+' CP</b> → '+streamer+'<br>':'')+
    (guild?'Guild: <b>'+guild+'</b><br>':'')+
    '<hr style="border:none;border-top:1px solid rgba(228,184,75,.3);margin:8px 0">'+
    'You receive: <b>'+fmtNum(cp+bonus)+' CP</b><br>You pay: <b>'+fmtRp(cp)+'</b>';
}

async function doDonate(){
  if(selAmt===null) return panelMsg('don-msg','Please choose an amount first.',false);
  var amount=DONATE_AMOUNTS[selAmt].cp;
  var streamer=document.getElementById('don-streamer').value;
  var guild=document.getElementById('don-guild').value;

  var btn=document.getElementById('don-btn');
  btn.disabled=true; btn.textContent='Preparing...';
  var res=await NeroAPI.post('/donate.php',
    {userid:Auth.user(), amount:amount, streamer:streamer, guild:guild});
  btn.disabled=false; btn.textContent='Proceed to Payment';

  if(res && res.ok && res.data && res.data.pay_url){
    window.location.href=res.data.pay_url;      /* hand off to the gateway */
  }else{
    panelMsg('don-msg',(res && res.error) || 'Payment is not connected yet.',false);
  }
}

/* ================= TABLE / GRID SEARCH ================= */
function filterTable(){
  var q=(document.getElementById('tblsearch').value||'').toLowerCase();
  var tbl=document.getElementById('stbl'); if(!tbl) return;
  var rows=tbl.tBodies[0].rows, shown=0;
  for(var i=0;i<rows.length;i++){
    if(rows[i].classList.contains('norow-row')) continue;
    var hit=rows[i].textContent.toLowerCase().indexOf(q)>-1;
    rows[i].style.display=hit?'':'none'; if(hit)shown++;
  }
  var hits=document.getElementById('hits');
  if(hits) hits.textContent=q?shown+' result'+(shown===1?'':'s'):'';
  var empty=tbl.querySelector('.norow-row');
  if(shown===0){
    if(!empty){ var r=tbl.tBodies[0].insertRow(); r.className='norow-row';
      var c=r.insertCell(); c.colSpan=tbl.rows[0].cells.length; c.className='norow'; c.textContent='No results found.'; }
  } else if(empty){ empty.remove(); }
}
var curF='all';
function setFilter(f,el){ curF=f;
  document.querySelectorAll('.toggle button').forEach(function(b){b.classList.remove('on');});
  el.classList.add('on'); filterItems();
}
function filterItems(){
  var qEl=document.getElementById('mkt-q'); if(!qEl) return;
  var q=(qEl.value||'').toLowerCase();
  document.querySelectorAll('.card-item').forEach(function(c){
    var okF=curF==='all'||c.dataset.type===curF;
    var okQ=c.dataset.name.indexOf(q)>-1;
    c.style.display=(okF&&okQ)?'':'none';
  });
}

/* ================= ONLINE COUNTER ================= */
var ONLINE = null;                            /* null = not loaded yet, show "—" */
var MERCHANTS = null;
var PEAK = null;                              /* null = not loaded yet, hide */
var SRV_STATUS = 'unknown';                   /* 'up' | 'partial' | 'down' | 'unknown' */
function paintOnline(){
  var set=function(id,v){ document.querySelectorAll('#'+id).forEach(function(e){ e.textContent=v; }); };
  set('online-num',   ONLINE===null    ? '—' : fmtNum(ONLINE));
  set('merchant-num', MERCHANTS===null ? '—' : fmtNum(MERCHANTS));
  set('peak-num',     PEAK===null      ? '—' : fmtNum(PEAK));
  document.querySelectorAll('.hd-pill').forEach(function(b){
    b.classList.remove('down','partial');
    if(SRV_STATUS==='partial'||SRV_STATUS==='down') b.classList.add(SRV_STATUS);
    b.title = SRV_STATUS==='up' ? 'All servers online' :
              SRV_STATUS==='partial' ? 'Some servers are down' :
              SRV_STATUS==='down' ? 'Servers are offline' : 'Status unknown';
  });
}
async function refreshOnline(){
  if(!NeroAPI.enabled()) return;                /* no backend configured: leave "—" */
  var d = await NeroAPI.get('online');
  if(d && typeof d.characters === 'number'){
    ONLINE = d.characters;                      /* real number from the game DB */
    MERCHANTS = typeof d.merchants === 'number' ? d.merchants : null;
    PEAK = typeof d.peak === 'number' ? d.peak : null;
    var allUp = d.login && d.char && d.map;
    var anyUp = d.login || d.char || d.map;
    SRV_STATUS = allUp ? 'up' : (anyUp ? 'partial' : 'down');
  }else{
    ONLINE = null;                              /* API unreachable: be honest, don't guess */
    MERCHANTS = null;
    PEAK = null;
    SRV_STATUS = 'unknown';
  }
  sessionStorage.setItem('nero_srv',SRV_STATUS);
  paintOnline();
}
setInterval(refreshOnline, NeroAPI.enabled()? 30000 : 5000);
refreshOnline();

function tickServerTime(){
  var d=new Date();
  var days=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  var mons=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var h=d.getHours(), ap=h>=12?'pm':'am'; h=h%12; if(h===0) h=12;
  var mm=(d.getMinutes()<10?'0':'')+d.getMinutes();
  var txt='Server time: '+days[d.getDay()]+' '+d.getDate()+' '+mons[d.getMonth()]+', '+h+':'+mm+' '+ap;
  document.querySelectorAll('.hd-time').forEach(function(e){ e.textContent=txt; });
}
tickServerTime();
setInterval(tickServerTime, 1000);

/* ================= MUSIC PLAYER ================= */
var bgm=document.getElementById('bgm');
var MUS={idx:0,playing:false,want:true};   /* want = user intent, survives autoplay blocking */
var DEFAULT_VOL=0.15;                      /* fixed 15% — no user control */

function musSave(){ try{
  sessionStorage.setItem('nero_mus',JSON.stringify({i:MUS.idx,t:bgm.currentTime,w:MUS.want}));
}catch(e){} }
function musLoad(){ try{ return JSON.parse(sessionStorage.getItem('nero_mus')||'null'); }catch(e){ return null; } }
function musIcon(){
  var b=document.getElementById('mus-toggle'); if(!b) return;
  b.innerHTML = MUS.playing ? '<i class="ti ti-player-pause"></i>' : '<i class="ti ti-player-play"></i>';
}
function musLabel(){
  var t=document.getElementById('mus-track');
  if(t) t.textContent = TRACKS.length ? TRACKS[MUS.idx].title : 'No track';
  document.querySelectorAll('.mus-item').forEach(function(e){ e.classList.toggle('on',+e.dataset.i===MUS.idx); });
}
function musLoadTrack(i,autoplay,seek){
  if(!TRACKS.length) return;
  MUS.idx=(i+TRACKS.length)%TRACKS.length;
  bgm.src=ROOT+TRACKS[MUS.idx].file;
  bgm.volume=DEFAULT_VOL;
  if(seek){ try{ bgm.currentTime=seek; }catch(e){} }
  musLabel();
  if(autoplay) musPlay();
}
function musPlay(){
  if(!bgm) return;
  var p=bgm.play();
  if(p && p.then){
    p.then(function(){ MUS.playing=true; musIcon(); })
     .catch(function(){ MUS.playing=false; musIcon(); });   /* blocked: keep want=true, retry on interaction */
  } else { MUS.playing=true; musIcon(); }
}
function musPause(){ bgm.pause(); MUS.playing=false; musIcon(); }
function musToggle(){
  MUS.want=!MUS.playing;
  if(MUS.want) musPlay(); else musPause();
  musSave();
}
function musNext(){ MUS.want=true; musLoadTrack(MUS.idx+1,true); musSave(); }
function musPick(i){ MUS.want=true; musLoadTrack(i,true); musSave();
  var p=document.getElementById('mus-panel'); if(p) p.classList.remove('show'); }
function musBuildList(){
  var p=document.getElementById('mus-panel'); if(!p) return;
  p.innerHTML='<div class="mus-title">Playlist</div>'+TRACKS.map(function(t,i){
    return '<div class="mus-item'+(i===MUS.idx?' on':'')+'" data-i="'+i+'" onclick="musPick('+i+')">'+
      '<i class="ti ti-music"></i>'+t.title+'</div>';}).join('');
}
(function initMusic(){
  if(!bgm) return;
  var saved=musLoad();
  bgm.volume=DEFAULT_VOL;                      /* always 15%, not adjustable */
  MUS.want = saved ? saved.w!==false : true;   /* on by default */

  musBuildList();
  musLoadTrack(saved?saved.i:0,false,saved?saved.t:0);
  bgm.addEventListener('ended',function(){ musNext(); });
  bgm.addEventListener('play', function(){ MUS.playing=true;  musIcon(); });
  bgm.addEventListener('pause',function(){ MUS.playing=false; musIcon(); });
  var tick=0;
  bgm.addEventListener('timeupdate',function(){ if(++tick%20===0) musSave(); });

  var tg=document.getElementById('mus-toggle'); if(tg) tg.addEventListener('click',musToggle);
  var nx=document.getElementById('mus-next');   if(nx) nx.addEventListener('click',musNext);
  var lb=document.getElementById('mus-list-btn');
  if(lb) lb.addEventListener('click',function(e){ e.stopPropagation();
    document.getElementById('mus-panel').classList.toggle('show'); });
  document.addEventListener('click',function(){ var p=document.getElementById('mus-panel'); if(p)p.classList.remove('show'); });

  /* try immediately; if the browser blocks audio, start on the very first user gesture */
  if(MUS.want){
    musPlay();
    var evts=['pointerdown','mousedown','mousemove','keydown','touchstart','scroll','wheel'];
    var kick=function(){
      if(MUS.want && bgm.paused){ musPlay(); }
      if(!bgm.paused){ evts.forEach(function(e){ document.removeEventListener(e,kick,true); }); }
    };
    evts.forEach(function(e){ document.addEventListener(e,kick,true); });
    document.addEventListener('visibilitychange',function(){
      if(!document.hidden && MUS.want && bgm.paused) musPlay();
    });
  }
  musIcon();
})();

/* ================= WIKI DRAWER (mobile) ================= */
function wikiNav(open){
  var side=document.getElementById('wiki-side');
  var scrim=document.getElementById('wk-scrim');
  if(!side) return;
  if(open){ side.classList.add('open'); if(scrim) scrim.classList.add('show'); document.body.style.overflow='hidden'; }
  else    { side.classList.remove('open'); if(scrim) scrim.classList.remove('show'); document.body.style.overflow=''; }
}

/* ================= WIKI SEARCH ================= */
function esc(t){ return t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); }
function wikiSearch(){
  var box=document.getElementById('wikisearch'); if(!box||typeof WIKI_INDEX==='undefined') return;
  var q=(box.value||'').trim().toLowerCase();
  var res=document.getElementById('wk-results');
  var nav=document.getElementById('wk-nav');
  if(q.length<2){ res.classList.remove('show'); res.innerHTML=''; nav.classList.remove('hidden'); return; }
  nav.classList.add('hidden'); res.classList.add('show');
  var hits=[];
  WIKI_INDEX.forEach(function(p){
    var t=p.t.toLowerCase(), x=p.x.toLowerCase();
    var score=0, pos=-1;
    if(t.indexOf(q)>-1) score+=100;
    pos=x.indexOf(q);
    if(pos>-1) score+=20;
    if(score>0) hits.push({p:p,score:score,pos:pos});
  });
  hits.sort(function(a,b){return b.score-a.score;});
  if(!hits.length){ res.innerHTML='<div class="wk-none">No pages found for "'+q+'"</div>'; return; }
  var re=new RegExp('('+esc(q)+')','ig');
  res.innerHTML=hits.slice(0,12).map(function(h){
    var snip='';
    if(h.pos>-1){
      var st=Math.max(0,h.pos-40);
      snip=h.p.x.substr(st,120).replace(re,'<mark>$1</mark>');
      snip=(st>0?'…':'')+snip+'…';
    }
    return '<a class="wk-res" href="'+ROOT+h.p.u+'">'+
      '<div class="rt">'+h.p.t.replace(re,'<mark>$1</mark>')+'</div>'+
      '<div class="rs">'+h.p.s+'</div>'+
      (snip?'<div class="rx">'+snip+'</div>':'')+'</a>';
  }).join('');
}

function regPwHint(){
  var pw=(document.getElementById('reg-pw')||{}).value||'';
  var id=(document.getElementById('reg-id')||{}).value||'';
  pwPaintRules('reg-rules',pw,id);
}
function pwHint(){
  var pw=(document.getElementById('pw-new')||{}).value||'';
  pwPaintRules('pw-rules',pw,Auth.user());
}

/* ================= ACCOUNT PAGE ================= */
const JOB_NAMES={0:'Novice',1:'Swordman',2:'Mage',3:'Archer',4:'Acolyte',5:'Merchant',6:'Thief',
 7:'Knight',8:'Priest',9:'Wizard',10:'Blacksmith',11:'Hunter',12:'Assassin',14:'Crusader',
 15:'Monk',16:'Sage',17:'Rogue',18:'Alchemist',19:'Bard',20:'Dancer',23:'Super Novice',
 24:'Gunslinger',25:'Ninja',4001:'Novice High',4002:'Swordman High',4003:'Mage High',
 4004:'Archer High',4005:'Acolyte High',4006:'Merchant High',4007:'Thief High',
 4008:'Lord Knight',4009:'High Priest',4010:'High Wizard',4011:'Whitesmith',4012:'Sniper',
 4013:'Assassin Cross',4015:'Paladin',4016:'Champion',4017:'Professor',4018:'Stalker',
 4019:'Creator',4020:'Clown',4021:'Gypsy'};
function jobName(c){ return JOB_NAMES[c] || ('Class '+c); }

function acctTab(name, btn){
  document.querySelectorAll('.atab').forEach(function(b){ b.classList.remove('on'); });
  if(btn) btn.classList.add('on');
  document.querySelectorAll('.atab-panel').forEach(function(p){ p.classList.remove('show'); });
  var el=document.getElementById('tab-'+name);
  if(el) el.classList.add('show');
  try{ sessionStorage.setItem('nero_acct_tab',name); }catch(e){}
}

async function loadAccountPage(){
  var guard=document.getElementById('acct-guard');
  var content=document.getElementById('acct-content');
  if(!guard||!content) return;
  if(!Auth.loggedIn){ guard.style.display=''; content.style.display='none'; return; }
  guard.style.display='none'; content.style.display='';

  /* restore the last tab the user was on */
  var want=null;
  try{ want=sessionStorage.getItem('nero_acct_tab'); }catch(e){}
  if(want){
    var b=document.querySelector('.atab[data-t="'+want+'"]');
    if(b) acctTab(want,b);
  }

  var set=function(id,v){ var e=document.getElementById(id); if(e) e.textContent=v; };
  var val=function(id,v){ var e=document.getElementById(id); if(e) e.value=v; };

  var d = await NeroAPI.get('me');
  var demo = !d;

  var name = (d && d.account && d.account.userid) || Auth.user() || 'Adventurer';
  var mail = (d && d.account && d.account.email) || (demo ? 'not connected' : '—');

  set('ac-avatar', name.charAt(0).toUpperCase());
  set('ac-user', name);
  set('ac-mail', mail);
  val('mail-cur', mail);
  set('ac-id', (d && d.account && d.account.account_id) || '—');
  set('ac-last', (d && d.account && d.account.lastlogin) || '—');
  set('ac-since', (d && d.account && d.account.registered) || '—');
  set('ac-sex', (d && d.account && d.account.sex==='F') ? 'Female' : 'Male');
  set('ac-group', (d && d.account && d.account.group_id > 0) ? 'Staff' : 'Player');

  var stEl=document.getElementById('ac-state');
  if(stEl){
    var active = demo ? true : (d.account && Number(d.account.state)===0);
    stEl.textContent = demo ? 'Demo mode' : (active ? 'Active' : 'Restricted');
    stEl.className = 'pbadge' + (active ? '' : ' alt');
  }

  /* ---- characters ---- */
  var chars=(d&&d.characters)||[];
  var totalZeny=0;
  chars.forEach(function(c){ totalZeny += Number(c.zeny)||0; });
  set('ac-nchar', demo ? '—' : chars.length);
  set('ac-zeny',  demo ? '—' : fmtNum(totalZeny));

  var cb=document.querySelector('#ac-chars tbody');
  if(cb){
    if(chars.length){
      cb.innerHTML=chars.map(function(c){
        var online = Number(c.online)===1;
        var dis = online ? 'disabled title="Character must be offline"' : '';
        return '<tr>'+
          '<td><b>'+c.name+'</b></td>'+
          '<td>'+jobName(Number(c.class))+'</td>'+
          '<td class="rank">'+c.base_level+'</td>'+
          '<td>'+c.job_level+'</td>'+
          '<td>'+fmtNum(c.zeny)+'</td>'+
          '<td>'+(c.guild||'—')+'</td>'+
          '<td><span class="pill '+(online?'on':'off')+'">'+(online?'Online':'Offline')+'</span></td>'+
          '<td><div class="row-actions">'+
            '<button class="act-btn" '+dis+' onclick="doResetLook('+c.char_id+',this)">Reset Look</button>'+
            '<button class="act-btn" '+dis+' onclick="doResetPos('+c.char_id+',this)">Unstuck</button>'+
            '<button class="act-btn" '+dis+' onclick="doChangeSlot('+c.char_id+','+c.char_num+',this)">Change Slot</button>'+
          '</div></td>'+
        '</tr>';
      }).join('');
    }else{
      cb.innerHTML='<tr><td colspan="8" class="norow">'+
        (demo ? 'Connect the backend to see your characters.' : 'No characters on this account yet.')+
        '</td></tr>';
    }
  }

  /* ---- cash point + donations ---- */
  var cp = (d && d.account && d.account.cash_point!=null) ? fmtNum(d.account.cash_point) : (demo?'—':'0');
  set('ac-cp', cp); set('ac-cp2', cp==='—' ? '— CP' : cp+' CP');

  var dons=(d&&d.donations)||[];
  var db=document.querySelector('#ac-don tbody');
  if(db){
    if(dons.length){
      db.innerHTML=dons.map(function(x){
        var st=(x.status||'pending').toLowerCase();
        var cls = st==='paid' ? 'paid' : (st==='pending' ? 'pending' : 'failed');
        var support = [x.streamer, x.guild].filter(Boolean).join(' / ') || '—';
        return '<tr>'+
          '<td>'+x.created+'</td>'+
          '<td><code>'+x.ref+'</code></td>'+
          '<td>'+fmtRp(Number(x.amount_rp))+'</td>'+
          '<td>'+fmtNum(x.credit_cp)+'</td>'+
          '<td>'+(Number(x.bonus_cp)>0?'+'+fmtNum(x.bonus_cp):'—')+'</td>'+
          '<td>'+support+'</td>'+
          '<td><span class="pill '+cls+'">'+st.charAt(0).toUpperCase()+st.slice(1)+'</span></td>'+
        '</tr>';
      }).join('');
    }else{
      db.innerHTML='<tr><td colspan="7" class="norow">'+
        (demo ? 'Connect the backend to see your donation history.' : 'No donations yet.')+
        '</td></tr>';
    }
  }
}

/* ---- Character management (mirrors FluxCP: reset look / unstuck / change slot) ---- */
async function doResetLook(charId, btn){
  if(btn){ btn.disabled=true; }
  var res=await NeroAPI.post('/character.php',{action:'resetlook',char_id:charId});
  if(btn){ btn.disabled=false; }
  alert((res&&res.ok) ? (res.data&&res.data.message||'Look reset.') : ((res&&res.error)||'Could not reset look.'));
  if(res&&res.ok) loadAccountPage();
}
async function doResetPos(charId, btn){
  if(btn){ btn.disabled=true; }
  var res=await NeroAPI.post('/character.php',{action:'resetpos',char_id:charId});
  if(btn){ btn.disabled=false; }
  alert((res&&res.ok) ? (res.data&&res.data.message||'Location reset.') : ((res&&res.error)||'Could not reset location.'));
  if(res&&res.ok) loadAccountPage();
}
async function doChangeSlot(charId, currentNum, btn){
  var slot=prompt('Move to which slot number? (1-9, currently #'+(currentNum+1)+')');
  if(slot===null) return;
  slot=parseInt(slot,10);
  if(!slot||slot<1) return alert('Enter a valid slot number.');
  if(btn){ btn.disabled=true; }
  var res=await NeroAPI.post('/character.php',{action:'changeslot',char_id:charId,slot:slot});
  if(btn){ btn.disabled=false; }
  alert((res&&res.ok) ? (res.data&&res.data.message||'Slot changed.') : ((res&&res.error)||'Could not change slot.'));
  if(res&&res.ok) loadAccountPage();
}

async function doChangePassword(){
  var oldpw=(document.getElementById('pw-old')||{}).value||'';
  var np=(document.getElementById('pw-new')||{}).value||'';
  var np2=(document.getElementById('pw-new2')||{}).value||'';
  if(!oldpw) return panelMsg('pw-msg','Enter your current password.',false);
  var err=pwFirstError(np,Auth.user());
  if(err)  return panelMsg('pw-msg',err,false);
  if(np!==np2) return panelMsg('pw-msg','New passwords do not match.',false);

  var b=document.getElementById('pw-btn'); b.disabled=true; b.textContent='Updating...';
  var res=await NeroAPI.post('/account.php',{action:'changepw',current:oldpw,password:np});
  b.disabled=false; b.textContent='Update password';
  if(res&&res.ok){
    panelMsg('pw-msg','Password updated.',true);
    ['pw-old','pw-new','pw-new2'].forEach(function(i){ document.getElementById(i).value=''; });
    pwHint();
  }else panelMsg('pw-msg',(res&&res.error)||'Could not update the password.',false);
}

async function doChangeEmail(){
  var mail=(document.getElementById('mail-new')||{}).value.trim();
  var pw=(document.getElementById('mail-pw')||{}).value||'';
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) return panelMsg('mail-msg','Enter a valid email.',false);
  if(!pw) return panelMsg('mail-msg','Confirm with your password.',false);
  var b=document.getElementById('mail-btn'); b.disabled=true; b.textContent='Updating...';
  var res=await NeroAPI.post('/account.php',{action:'changeemail',email:mail,current:pw});
  b.disabled=false; b.textContent='Update email';
  if(res&&res.ok){ panelMsg('mail-msg','Email updated.',true); loadAccountPage(); }
  else panelMsg('mail-msg',(res&&res.error)||'Could not update the email.',false);
}

/* ================= LIVE STAT TABLES ================= */
function tdRow(cells){
  return '<tr>'+cells.map(function(c,i){
    return '<td class="'+(i===0?'rank':'')+'">'+c+'</td>';
  }).join('')+'</tr>';
}
function noDataRow(cols,msg){
  return '<tr class="norow-row"><td class="norow" colspan="'+cols+'">'+msg+'</td></tr>';
}
async function hydrateTable(){
  var tbl=document.getElementById('stbl');
  if(!tbl) return;
  var key=tbl.getAttribute('data-api');
  if(!key) return;
  var cols=tbl.rows[0].cells.length;

  if(!NeroAPI.enabled()){
    tbl.tBodies[0].innerHTML = noDataRow(cols,'Backend not connected yet.');
    return;
  }
  var d=await NeroAPI.get(key);
  if(!d){
    tbl.tBodies[0].innerHTML = noDataRow(cols,'Could not load data — try again shortly.');
    return;
  }
  var rows=[], i=1;

  if(key==='zeny' && Array.isArray(d)){
    d.forEach(function(r){
      rows.push(tdRow([i++, r.name, fmtNum(r.zeny), r.base_level, r.guild||'—']));
    });
    tbl.tBodies[0].innerHTML = rows.length ? rows.join('')
      : noDataRow(cols,'No characters tracked yet — check back once players have started playing.');
  } else if(key==='woe' && d.guilds){
    d.guilds.forEach(function(g){
      rows.push(tdRow([i++, g.name, g.castles, g.average_lv, g.connect_member+' / '+g.max_member]));
    });
    tbl.tBodies[0].innerHTML = rows.length ? rows.join('')
      : noDataRow(cols,'No guilds have been created yet — check back once guilds start forming.');
  } else if(key==='mvp'){
    if(!d.available) return;                      /* keep the honest "no tracking" row already in the HTML */
    d.rows.forEach(function(r){
      rows.push(tdRow([i++, r.name, fmtNum(r.kills), '—', fmtNum(r.kills*2)]));
    });
    if(rows.length) tbl.tBodies[0].innerHTML=rows.join('');
  } else if(key==='pvp'){
    if(!d.available) return;                      /* keep the honest "no tracking" row already in the HTML */
    d.rows.forEach(function(r){
      rows.push(tdRow([i++, r.name, fmtNum(r.kills), fmtNum(r.deaths), r.kd, fmtNum(r.points)]));
    });
    if(rows.length) tbl.tBodies[0].innerHTML=rows.join('');
  }
}

/* ================= SPA ROUTER ================= */
function afterPageLoad(){
  renderAcct();
  paintOnline();
  /* mobile: close the wiki contents drawer after navigating */
  wikiNav(false);
  curF='all';                       /* reset marketplace filter state */
  selAmt=null;
  hydrateTable();                   /* pull live rows if the API is on */
  loadAccountPage();                /* account page, if we're on it */
}

(function router(){
  if(!window.history || !window.fetch) return;

  var bar=document.createElement('div');
  bar.id='nav-progress'; document.body.appendChild(bar);
  function start(){ bar.classList.add('go'); bar.style.width='70%'; }
  function done(){ bar.style.width='100%';
    setTimeout(function(){ bar.classList.remove('go'); bar.style.width='0'; },260); }

  function samePage(a,b){ return a.split('#')[0]===b.split('#')[0]; }

  function swap(url,push){
    start();
    fetch(url,{credentials:'same-origin'}).then(function(r){
      if(!r.ok) throw new Error('http '+r.status);
      return r.text();
    }).then(function(html){
      var doc=new DOMParser().parseFromString(html,'text/html');
      var fresh=doc.getElementById('app');
      if(!fresh) throw new Error('no #app');
      /* push state BEFORE inserting so relative URLs resolve against the new path */
      if(push) history.pushState({spa:1},'',url);
      document.body.className=doc.body.className;
      var imported=document.importNode(fresh,true);   /* node comes from another document */
      document.getElementById('app').replaceWith(imported);
      var t=doc.querySelector('title');
      if(t) document.title=t.textContent;
      window.scrollTo(0,0);
      afterPageLoad();
      done();
    }).catch(function(){ location.href=url; });   /* any problem -> normal navigation */
  }

  document.addEventListener('click',function(e){
    if(e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey) return;
    var a=e.target.closest && e.target.closest('a[href]');
    if(!a) return;
    if(a.target && a.target!=='' && a.target!=='_self') return;
    if(a.hasAttribute('download')) return;
    var href=a.getAttribute('href');
    if(!href||href.charAt(0)==='#'||/^(mailto:|tel:|javascript:)/i.test(href)) return;
    var url;
    try{ url=new URL(href,location.href); }catch(err){ return; }
    if(url.origin!==location.origin) return;
    if(!/\.html$|\/$/.test(url.pathname)) return;
    if(samePage(url.href,location.href)){ e.preventDefault(); return; }
    e.preventDefault();
    closePanel();
    wikiNav(false);
    swap(url.href,true);
  });

  window.addEventListener('popstate',function(){ swap(location.href,false); });
})();

afterPageLoad();


/* ================= WIKI SPA ROUTER =================
   Keeps one shell and swaps only the article, so navigating the wiki
   never reloads the page (music, scroll chrome and state persist).
   Each page still exists as a real .html file, so direct links,
   refresh, and no-JS browsers all continue to work. */
(function(){
  var main=document.getElementById('wiki-main');
  if(!main || !window.history || !window.fetch || !window.DOMParser) return;

  function norm(u){
    try{ var x=new URL(u, location.href);
         return (x.origin+x.pathname).replace(/index\.html$/,''); }
    catch(e){ return String(u); }
  }
  var WIKI_BASE=norm(ROOT+'wiki/');

  /* freeze persistent chrome links as absolute URLs */
  document.querySelectorAll('.wiki-side a, .sitehead a, .homebar a').forEach(function(a){
    a.setAttribute('href', a.href);
  });

  function setActive(){
    var cur=norm(location.href);
    document.querySelectorAll('.wiki-side .wk-nav a').forEach(function(a){
      a.classList.toggle('active', norm(a.href)===cur);
    });
  }

  function absolutize(node, base){
    node.querySelectorAll('a[href]').forEach(function(a){
      var r=a.getAttribute('href');
      if(!r || /^(https?:|mailto:|tel:|#)/i.test(r)) return;
      try{ a.setAttribute('href', new URL(r, base).href); }catch(e){}
    });
    node.querySelectorAll('img[src]').forEach(function(i){
      var r=i.getAttribute('src');
      if(!r || /^(https?:|data:)/i.test(r)) return;
      try{ i.setAttribute('src', new URL(r, base).href); }catch(e){}
    });
  }

  var bar=document.createElement('div');
  bar.className='wk-progress';
  document.body.appendChild(bar);

  function go(url, push){
    bar.classList.add('on');
    fetch(url,{credentials:'same-origin'})
      .then(function(r){ if(!r.ok) throw new Error(r.status); return r.text(); })
      .then(function(html){
        var doc=new DOMParser().parseFromString(html,'text/html');
        var nm=doc.getElementById('wiki-main');
        if(!nm) throw new Error('no content');
        absolutize(nm,url);
        main.innerHTML=nm.innerHTML;
        var t=doc.querySelector('title');
        if(t) document.title=t.textContent;
        if(push) history.pushState({spa:1},'',url);
        setActive();
        /* replay the fade */
        main.classList.remove('swap'); void main.offsetWidth; main.classList.add('swap');
        window.scrollTo(0,0);
        var sb=document.querySelector('.wiki-side'); if(sb) sb.classList.remove('open');
        var q=document.getElementById('wikisearch');
        if(q && q.value){ q.value=''; wikiSearch(); }
        bar.classList.remove('on');
      })
      .catch(function(){ bar.classList.remove('on'); location.href=url; });
  }

  document.addEventListener('click',function(e){
    if(e.metaKey||e.ctrlKey||e.shiftKey||e.altKey||e.button!==0) return;
    var a=e.target && e.target.closest ? e.target.closest('a') : null;
    if(!a) return;
    if(a.hasAttribute('download')) return;
    if(a.target && a.target!=='_self') return;
    var raw=a.getAttribute('href');
    if(!raw || raw.charAt(0)==='#') return;
    var url;
    try{ url=new URL(a.href, location.href); }catch(err){ return; }
    if(url.origin!==location.origin) return;
    if(norm(url.href).indexOf(WIKI_BASE)!==0) return;      /* wiki pages only */
    e.preventDefault();
    if(norm(url.href)===norm(location.href)){ window.scrollTo(0,0); return; }
    go(url.href,true);
  });

  window.addEventListener('popstate',function(){ go(location.href,false); });
  setActive();
})();
