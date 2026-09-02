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
           login:'ti-login',register:'ti-user-plus',account:'ti-user-circle',forgot:'ti-lock-question'};
var TITLES={server:'Server Detail',download:'Download',donation:'Donation',
            login:'Login',register:'Create Account',account:'My Account',forgot:'Forgot Password'};

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
  if(type==='forgot') initForgotPanel();
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
  if(t==='forgot')   return forgotHTML();
  return '';
}

/* ---- Login / Register / Account ---- */
function loginHTML(){ return `
  <p class="lead">Sign in to your NeRO account to donate, trade, and track your progress.</p>
  <div id="login-msg"></div>
  <label class="fld">Account ID</label><input class="inp" id="login-id" placeholder="yourname">
  <label class="fld">Password</label><input class="inp" id="login-pw" type="password" placeholder="••••••••">
  <button class="btn-gold" id="login-btn" onclick="doLogin()">Login</button>
  <div class="rowlinks"><a href="#" onclick="openPanel('forgot');return false">Forgot password?</a>
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
    <label class="fld">Date of Birth</label>
    <input class="inp" id="reg-dob" type="date">
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

/* ---- Forgot password (userid + email + captcha) ---- */
var FG_CAPTCHA='', FG_VERIFIED=false, FG_USERID='', FG_EMAIL='';

function forgotHTML(){ return `
  <p class="lead">Reset password — verifikasi pakai User ID dan Email yang kamu daftarkan.</p>
  <div id="forgot-msg"></div>

  <div id="forgot-step1">
    <label class="fld">User ID</label>
    <input class="inp" id="fg-id" placeholder="username kamu">
    <label class="fld">Email</label>
    <input class="inp" id="fg-email" type="email" placeholder="name@email.com">
    <label class="fld">Captcha</label>
    <div class="captcha-row">
      <canvas id="fg-captcha-canvas" width="140" height="46"></canvas>
      <button type="button" class="captcha-refresh" onclick="drawCaptcha()" title="Refresh captcha"><i class="ti ti-refresh"></i></button>
    </div>
    <input class="inp" id="fg-captcha-input" placeholder="Ketik kode di atas" style="margin-top:8px" maxlength="6" autocomplete="off">
    <button class="btn-gold" id="fg-verify-btn" onclick="doVerifyIdentity()">Continue</button>
    <div class="rowlinks"><span></span><a href="#" onclick="openPanel('login');return false">Back to Sign In</a></div>
  </div>

  <div id="forgot-step2" style="display:none">
    <p class="lead">Identitas terverifikasi. Masukkan password baru kamu.</p>
    <label class="fld">New password</label>
    <input class="inp" id="fg-pw" type="password" placeholder="8-31 characters" maxlength="31" autocomplete="new-password" oninput="fgPwHint()">
    <ul class="pw-rules" id="fg-rules">
      <li data-r="len"><i class="ti ti-circle"></i> 8 to 31 characters</li>
      <li data-r="upper"><i class="ti ti-circle"></i> At least 1 uppercase letter</li>
      <li data-r="lower"><i class="ti ti-circle"></i> At least 1 lowercase letter</li>
      <li data-r="digit"><i class="ti ti-circle"></i> At least 1 number</li>
      <li data-r="name"><i class="ti ti-circle"></i> Cannot contain your username</li>
    </ul>
    <label class="fld">Confirm new password</label>
    <input class="inp" id="fg-pw2" type="password" placeholder="repeat password" maxlength="31" autocomplete="new-password">
    <button class="btn-gold" id="fg-reset-btn" onclick="doResetNoEmail()">Confirm</button>
  </div>`;
}

function initForgotPanel(){
  FG_VERIFIED=false; FG_USERID=''; FG_EMAIL='';
  var s1=document.getElementById('forgot-step1'), s2=document.getElementById('forgot-step2');
  if(s1) s1.style.display=''; if(s2) s2.style.display='none';
  drawCaptcha();
}
function randCaptchaCode(len){
  var chars='ABCDEFGHJKMNPQRSTUVWXYZ23456789';   /* no ambiguous I/L/O/0/1 */
  var s=''; for(var i=0;i<len;i++) s+=chars.charAt(Math.floor(Math.random()*chars.length));
  return s;
}
function drawCaptcha(){
  FG_CAPTCHA=randCaptchaCode(5);
  var c=document.getElementById('fg-captcha-canvas'); if(!c) return;
  var ctx=c.getContext('2d');
  ctx.clearRect(0,0,c.width,c.height);
  ctx.fillStyle='#101a2c'; ctx.fillRect(0,0,c.width,c.height);
  for(var i=0;i<5;i++){
    ctx.strokeStyle='rgba(228,184,75,'+(0.15+Math.random()*0.25)+')';
    ctx.beginPath();
    ctx.moveTo(Math.random()*c.width, Math.random()*c.height);
    ctx.lineTo(Math.random()*c.width, Math.random()*c.height);
    ctx.stroke();
  }
  var gap=c.width/(FG_CAPTCHA.length+1);
  for(var j=0;j<FG_CAPTCHA.length;j++){
    ctx.save();
    var x=gap*(j+1), y=c.height/2+(Math.random()*10-5);
    ctx.translate(x,y);
    ctx.rotate(Math.random()*0.5-0.25);
    ctx.fillStyle = Math.random()>0.5 ? '#E4B84B' : '#f2cf6e';
    ctx.font='bold 24px monospace';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(FG_CAPTCHA[j],0,0);
    ctx.restore();
  }
  var input=document.getElementById('fg-captcha-input'); if(input) input.value='';
}
async function doVerifyIdentity(){
  var id=(document.getElementById('fg-id').value||'').trim();
  var email=(document.getElementById('fg-email').value||'').trim();
  var cap=(document.getElementById('fg-captcha-input').value||'').trim().toUpperCase();

  if(!id)    return panelMsg('forgot-msg','Masukkan User ID kamu.',false);
  if(!email) return panelMsg('forgot-msg','Masukkan email kamu.',false);
  if(!cap||cap!==FG_CAPTCHA){ drawCaptcha(); return panelMsg('forgot-msg','Kode captcha salah, coba lagi.',false); }

  var btn=document.getElementById('fg-verify-btn'); btn.disabled=true; btn.textContent='Memeriksa...';
  var res=await NeroAPI.post('/account.php',{action:'verify_reset',userid:id,email:email});
  btn.disabled=false; btn.textContent='Continue';

  if(res&&res.ok){
    FG_VERIFIED=true; FG_USERID=id; FG_EMAIL=email;
    document.getElementById('forgot-step1').style.display='none';
    document.getElementById('forgot-step2').style.display='';
    document.getElementById('forgot-msg').innerHTML='';
  }else{
    drawCaptcha();
    panelMsg('forgot-msg',(res&&res.error)||'User ID atau email tidak cocok.',false);
  }
}
function fgPwHint(){
  var pw=(document.getElementById('fg-pw')||{}).value||'';
  pwPaintRules('fg-rules',pw,FG_USERID);
}
async function doResetNoEmail(){
  if(!FG_VERIFIED) return;
  var pw=document.getElementById('fg-pw').value||'';
  var pw2=document.getElementById('fg-pw2').value||'';
  var err=pwFirstError(pw,FG_USERID);
  if(err) return panelMsg('forgot-msg',err,false);
  if(pw!==pw2) return panelMsg('forgot-msg','Password tidak sama.',false);

  var btn=document.getElementById('fg-reset-btn'); btn.disabled=true; btn.textContent='Menyimpan...';
  var res=await NeroAPI.post('/account.php',{action:'reset_noemail',userid:FG_USERID,email:FG_EMAIL,password:pw});
  btn.disabled=false; btn.textContent='Confirm';

  if(res&&res.ok){
    panelMsg('forgot-msg','Password berhasil diubah. Silakan login dengan password baru.',true);
    setTimeout(function(){ openPanel('login'); },1600);
  }else{
    panelMsg('forgot-msg',(res&&res.error)||'Gagal mengubah password.',false);
  }
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
  var dob=document.getElementById('reg-dob').value||'';
  var pw=document.getElementById('reg-pw').value||'';
  var pw2=document.getElementById('reg-pw2').value||'';
  var sex=document.getElementById('reg-sex').value||'M';

  if(id.length<4)  return panelMsg('reg-msg','Username must be at least 4 characters.',false);
  if(!/^[A-Za-z0-9_]+$/.test(id)) return panelMsg('reg-msg','Username can only use letters, numbers and underscore.',false);
  if(!dob) return panelMsg('reg-msg','Please select your date of birth.',false);
  var pwErr=pwFirstError(pw,id);
  if(pwErr)        return panelMsg('reg-msg',pwErr,false);
  if(pw!==pw2)     return panelMsg('reg-msg','Passwords do not match.',false);
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) return panelMsg('reg-msg','Please enter a valid email.',false);

  var btn=document.getElementById('reg-btn');
  btn.disabled=true; btn.textContent='Creating...';
  var res=await NeroAPI.post('/account.php',
    {action:'register', userid:id, password:pw, email:mail, sex:sex, birthdate:dob});
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
  var amts=DONATE_AMOUNTS.map(function(a,i){
    return '<button class="amt" data-i="'+i+'" onclick="pickAmt('+i+')">'+fmtRp(a.cp)+'</button>';
  }).join('');
  var streamerOpts='<option value="">None</option>'+STREAMERS.map(function(s){
    return '<option value="'+s+'">'+s+'</option>';
  }).join('');
  return `
  <p class="lead">Support NeRO and get Cash Points to spend in the Item Mall. <b>1 CP = Rp 1.</b></p>
  <div id="don-msg"></div>

  <label class="fld">1 · Choose an amount</label>
  <div class="amt-grid">`+amts+`</div>

  <label class="fld">2 · Referral code <span class="fld-opt">(optional — adds bonus CP)</span></label>
  <select class="inp" id="don-streamer" onchange="updateSummary()">`+streamerOpts+`</select>
  <div class="don-guildrow">
    <select class="inp" id="don-guild" disabled>
      <option>Guild royalty — coming soon</option>
    </select>
  </div>

  <div class="don-summary" id="don-summary">Select an amount to see your total.</div>

  <div class="don-pay" id="don-pay" style="display:none">
    <label class="fld">3 · Scan &amp; pay with QRIS</label>
    <p class="don-hint">Open any QRIS-supported app (GoPay, OVO, DANA, ShopeePay, bank apps…), scan the code, and enter <b id="don-payamt">the exact amount</b>.</p>
    <div class="qris-card"><img src="`+ROOT+`assets/qris-newera.png" alt="NewEraRO QRIS payment code" loading="lazy"></div>
    <div class="don-steps">
      <p><b>After paying:</b></p>
      <ol>
        <li>Screenshot your payment receipt.</li>
        <li>Note your account name: <b>`+ (Auth.user()||'your account') +`</b></li>
        <li>Submit the receipt in our <a href="`+DISCORD_URL+`" target="_blank" rel="noopener">Discord</a> <b>#top-up</b> channel to get your CP credited.</li>
      </ol>
      <p class="don-note"><i class="ti ti-info-circle"></i> Cash Points are credited manually after we verify your payment (usually within a few hours). This keeps top-ups secure.</p>
    </div>
  </div>`;
}

function pickAmt(i){ selAmt=i;
  document.querySelectorAll('.amt').forEach(function(e){e.classList.toggle('sel',+e.dataset.i===i);});
  updateSummary();
}
function updateSummary(){
  var box=document.getElementById('don-summary'); if(!box) return;
  var pay=document.getElementById('don-pay');
  if(selAmt===null){ box.innerHTML='Select an amount to see your total.'; if(pay)pay.style.display='none'; return; }
  var cp=DONATE_AMOUNTS[selAmt].cp;
  var streamer=document.getElementById('don-streamer').value;
  var bonus=streamer?Math.round(cp*0.20):0;
  box.innerHTML='Base: <b>'+fmtNum(cp)+' CP</b><br>'+
    (streamer?'Streamer bonus (+20%): <b>+'+fmtNum(bonus)+' CP</b> → '+streamer+'<br>':'')+
    '<hr class="don-hr">'+
    'You receive: <b class="don-total">'+fmtNum(cp+bonus)+' CP</b><br>You pay: <b>'+fmtRp(cp)+'</b>';
  if(pay){
    pay.style.display='';
    var pa=document.getElementById('don-payamt');
    if(pa) pa.textContent=fmtRp(cp);
  }
}

/* ================= TABLE / GRID SEARCH ================= */
function filterTable(){
  var q=(document.getElementById('tblsearch').value||'').toLowerCase();
  /* Search the table inside whichever WoE tab is currently open. */
  var panel=document.querySelector('.atab-panel.show');
  var tbl=panel && panel.querySelector('table.stat');
  if(!tbl){ tbl=document.getElementById('stbl'); }
  if(!tbl) return;
  var rows=tbl.tBodies[0].rows, shown=0;
  for(var i=0;i<rows.length;i++){
    if(rows[i].classList.contains('norow-row')) continue;
    var hit=rows[i].textContent.toLowerCase().indexOf(q)>-1;
    rows[i].style.display=hit?'':'none'; if(hit)shown++;
  }
  var hits=document.getElementById('hits');
  if(hits) hits.textContent=q?shown+' result'+(shown===1?'':'s'):'';
  /* manage a "no results" placeholder, but only for a live query so we don't
     fight the table's own loading/empty row */
  var typed=q.length>0;
  var placeholder=tbl.querySelector('.norow-row.search-empty');
  if(typed && shown===0){
    if(!placeholder){ var r=tbl.tBodies[0].insertRow(); r.className='norow-row search-empty';
      var c=r.insertCell(); c.colSpan=tbl.rows[0].cells.length; c.className='norow'; c.textContent='No results found.'; }
  } else if(placeholder){ placeholder.remove(); }
}
/* Reset the shared search box when moving between tabs so a query typed on one
   tab doesn't silently hide rows on the next. */
function resetTableSearch(){
  var box=document.getElementById('tblsearch');
  if(box) box.value='';
  var hits=document.getElementById('hits');
  if(hits) hits.textContent='';
  document.querySelectorAll('.atab-panel table.stat tr.search-empty').forEach(function(r){ r.remove(); });
  document.querySelectorAll('.atab-panel table.stat tbody tr').forEach(function(r){ r.style.display=''; });
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

/* ================= WIKI SIDEBAR GROUP TOGGLE ================= */
function wkToggleGroup(btn){
  var grp=btn.closest('.wk-group');
  if(grp) grp.classList.toggle('open');
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

/* WoE stats page: same tab look as acctTab(), but its own tiny switcher
   (no sessionStorage) since "castles"/"players"/etc. don't belong in the
   Account page's remembered-tab state. */
function woeTab(name, btn){
  var root=btn && btn.closest('.acct-tabs');
  (root || document).querySelectorAll('.atab').forEach(function(b){ b.classList.remove('on'); });
  if(btn) btn.classList.add('on');
  ['castles','players','guildkills','kills','me'].forEach(function(n){
    var el=document.getElementById('woe-'+n);
    if(el) el.classList.toggle('show', n===name);
  });
  resetTableSearch();
}
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
  var accZeny=(d&&d.account&&Number(d.account.zeny))||0;   /* zeny is account-wide on this server */
  set('ac-nchar', demo ? '—' : chars.length);
  set('ac-zeny',  demo ? '—' : fmtNum(accZeny));

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
/* The game server only writes woe_stats.score/role_label at WoE end; when it
   hasn't, the bridge derives both from the raw counters and flags the payload
   as estimated. Surface that instead of silently passing an estimate off as
   the server's own score. */
function woeEstNote(id,on){
  var el=document.getElementById(id);
  if(el) el.style.display = on ? '' : 'none';
}
/* ---- Top Players paging ----
   The board lists every character who scored this month, so it's paged
   (20 rows a page) rather than cut off at a top-N. Page state lives here
   and is reset on every SPA navigation, same as the marketplace filter. */
var WOE_PLAYERS_PER_PAGE=20;
var woePlayersPage=1;

/* Per-table query string for the paged endpoints. */
function tableParams(key){
  if(key==='woe_players') return {page:woePlayersPage, per_page:WOE_PLAYERS_PER_PAGE};
  return null;
}

/* Windowed page list: 1 … 4 5 [6] 7 8 … 20 */
function pagerNumbers(cur,last){
  var out=[], span=2, i;
  for(i=1;i<=last;i++){
    if(i===1 || i===last || (i>=cur-span && i<=cur+span)) out.push(i);
    else if(out[out.length-1]!=='…') out.push('…');
  }
  return out;
}
function renderPager(id,meta,goFn,noun){
  var el=document.getElementById(id);
  if(!el) return;
  var total=Number(meta.total)||0, per=Number(meta.per_page)||WOE_PLAYERS_PER_PAGE;
  var last=Math.max(1,Number(meta.pages)||1), cur=Math.min(Math.max(1,Number(meta.page)||1),last);
  if(total<=per){ el.innerHTML=''; el.style.display='none'; return; }
  el.style.display='';

  var from=(cur-1)*per+1, to=Math.min(cur*per,total);
  var btn=function(label,page,cls){
    if(page===null) return '<span class="pg-gap">'+label+'</span>';
    var dis=(page<1||page>last||page===cur);
    return '<button class="pg-btn'+(cls?' '+cls:'')+(page===cur?' on':'')+'"'+
           (dis?' disabled':'')+' onclick="'+goFn+'('+page+')">'+label+'</button>';
  };
  var mid=pagerNumbers(cur,last).map(function(p){
    return p==='…' ? btn('…',null) : btn(p,p);
  }).join('');

  el.innerHTML='<div class="pg-count">Showing <b>'+fmtNum(from)+'</b>–<b>'+fmtNum(to)+
      '</b> of <b>'+fmtNum(total)+'</b> '+noun+'</div>'+
    '<div class="pg-btns">'+
      btn('<i class="ti ti-chevron-left"></i>',cur-1,'pg-nav')+mid+
      btn('<i class="ti ti-chevron-right"></i>',cur+1,'pg-nav')+
    '</div>';
}
async function goWoePlayersPage(n){
  var tbl=document.querySelector('table.stat[data-api="woe_players"]');
  if(!tbl) return;
  woePlayersPage=Math.max(1,parseInt(n,10)||1);
  /* A new page arrives in the server's own score order, so drop any
     click-to-sort arrow still lit on a header — leaving it would claim a
     sort that no longer applies to the rows on screen. */
  if(tbl.tHead && tbl.tHead.rows.length){
    var hc=tbl.tHead.rows[0].cells;
    for(var c=0;c<hc.length;c++){ hc[c].classList.remove('sort-asc','sort-desc'); }
  }
  tbl.tBodies[0].innerHTML=noDataRow(tbl.rows[0].cells.length,'Loading…');
  await hydrateOneTable(tbl);
  var panel=document.getElementById('woe-players');
  if(panel && panel.scrollIntoView) panel.scrollIntoView({behavior:'smooth',block:'start'});
}
function woeNameLink(charId,name){
  return charId ? '<a href="#" onclick="openWoePlayerDetail('+parseInt(charId,10)+');return false">'+name+'</a>' : name;
}
function fmtWoeTime(t){
  if(!t) return '—';
  var d=new Date((''+t).replace(' ','T'));
  if(isNaN(d)) return t;
  var mons=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var h=d.getHours(), ap=h>=12?'pm':'am'; h=h%12; if(h===0) h=12;
  var mm=(d.getMinutes()<10?'0':'')+d.getMinutes();
  return d.getDate()+' '+mons[d.getMonth()]+' '+h+':'+mm+ap;
}
/* A player counts as having participated in WoE if any of their activity
   counters is non-zero. Used to keep no-shows (all zeros) out of the public
   Top Players ranking. Deliberately covers offensive, defensive and support
   activity so e.g. a pure healer who dealt no damage still counts. */
function woeParticipated(r){
  var keys=['kills','deaths','assists','damage','damage_taken','emperium_damage',
            'barricade_damage','skill_casts','support_skills_used',
            'acid_demonstration_used','healing_done','sp_used','healing_items','score'];
  for(var k=0;k<keys.length;k++){
    var v=Number(r[keys[k]]);
    if(!isNaN(v) && v>0) return true;
  }
  return false;
}
async function hydrateOneTable(tbl){
  var key=tbl.getAttribute('data-api');
  if(!key) return;
  var cols=tbl.rows[0].cells.length;

  if(!NeroAPI.enabled()){
    tbl.tBodies[0].innerHTML = noDataRow(cols,'Backend not connected yet.');
    return;
  }
  var d=await NeroAPI.get(key,tableParams(key));
  if(!d){
    tbl.tBodies[0].innerHTML = noDataRow(cols,'Could not load data — try again shortly.');
    return;
  }
  /* paged endpoints number their rows from where the page starts, so #21 on
     page 2 stays #21 rather than restarting at #1 */
  var rows=[], i=(Number(d.offset)||0)+1;
  tbl.dataset.rankStart=i;          /* remember the page's first # so a later client-side sort keeps 21,22,23… */

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
  } else if(key==='woe_players' && d.rows){
    woeEstNote('woeplayers-est', !!d.estimated && d.rows.length>0);
    /* the bridge clamps a page number past the end back to the last real
       page — follow it, so the next click counts from what's on screen */
    if(d.page) woePlayersPage=Number(d.page);
    renderPager('woeplayers-pager', d, 'goWoePlayersPage', 'players');
    /* Hide non-participants: a player with every combat counter at zero never
       actually showed up to WoE, so they'd just be noise in the rankings. This
       is a display filter only — the data itself is untouched. (With the paged
       bridge this is belt-and-braces: it only ever returns rows scoring above
       zero, so nothing here is actually dropped and the pager's "of N" count
       stays true to what's listed.) */
    d.rows.filter(woeParticipated).forEach(function(r){
      rows.push(tdRow([i++, woeNameLink(r.char_id,r.name), r.guild||'—', jobName(r.class||0),
        fmtNum(r.kills), fmtNum(r.deaths), fmtNum(r.assists), fmtNum(r.damage), fmtNum(r.damage_taken),
        fmtNum(r.emperium_damage), fmtNum(r.barricade_damage),
        fmtNum(r.skill_casts), fmtNum(r.support_skills_used), fmtNum(r.acid_demonstration_used),
        fmtNum(r.healing_done), fmtNum(r.sp_used), fmtNum(r.healing_items),
        r.role||'—', fmtNum(r.score)]));
    });
    tbl.tBodies[0].innerHTML = rows.length ? rows.join('')
      : noDataRow(cols,'No WoE combat data recorded yet this month.');
  } else if(key==='woe_guild_kills' && d.rows){
    d.rows.forEach(function(r){
      rows.push(tdRow([i++, r.name, fmtNum(r.kills), fmtNum(r.deaths)]));
    });
    tbl.tBodies[0].innerHTML = rows.length ? rows.join('')
      : noDataRow(cols,'No guild WoE kills recorded yet this month.');
  } else if(key==='woe_kills' && d.rows){
    d.rows.forEach(function(r){
      rows.push(tdRow([fmtWoeTime(r.time), r.killer, r.killed, r.map||'—']));
    });
    tbl.tBodies[0].innerHTML = rows.length ? rows.join('')
      : noDataRow(cols,'No kills logged yet this WoE.');
  } else if(key==='mvp'){
    if(!d.available) return;                      /* keep the honest "no tracking" row already in the HTML */
    d.rows.forEach(function(r){
      rows.push(tdRow([i++, r.name, fmtNum(r.kills), r.favorite||'—', fmtNum(r.kills*2)]));
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
async function hydrateTable(){
  var tables=document.querySelectorAll('table.stat[data-api]');
  for(var t=0;t<tables.length;t++){ await hydrateOneTable(tables[t]); }
}

/* ================= SORTABLE STAT TABLES ================= */
/* Click a column header to sort A-Z (numeric columns sort low-high); click
   again to reverse. Purely a display reorder — never touches the data source. */
function sortTableRows(table, colIdx, dir){
  var tbody = table.tBodies[0];
  if(!tbody) return;
  var rows = Array.prototype.slice.call(tbody.rows);
  if(!rows.length || rows[0].classList.contains('norow-row')) return;   /* nothing loaded yet */
  rows.sort(function(a,b){
    var ca = a.cells[colIdx], cb = b.cells[colIdx];
    var ta = ca ? ca.textContent.trim() : '';
    var tb = cb ? cb.textContent.trim() : '';
    var na = parseFloat(ta.replace(/[,%]/g,''));
    var nb = parseFloat(tb.replace(/[,%]/g,''));
    var isNum = ta!=='' && tb!=='' && !isNaN(na) && !isNaN(nb) &&
                /^-?[\d.,%\s]+$/.test(ta) && /^-?[\d.,%\s]+$/.test(tb);
    var cmp = isNum ? (na-nb) : ta.localeCompare(tb, undefined, {sensitivity:'base', numeric:true});
    return dir==='asc' ? cmp : -cmp;
  });
  rows.forEach(function(r){ tbody.appendChild(r); });
  renumberRankColumn(table);          /* keep the # column in order after the reorder */
}
/* The "#" column is a fixed position marker, not data — so after a client-side
   reorder it must re-count in order instead of moving with its row. On a paged
   table it resumes from the page's global offset (page 2 keeps #21, #22 …),
   read from the first row's original number so no page state is needed here. */
function renumberRankColumn(table){
  var thead=table.tHead;
  if(!thead||!thead.rows.length) return;
  if(thead.rows[0].cells[0].textContent.trim()!=='#') return;   /* only tables that lead with # */
  var tbody=table.tBodies[0];
  if(!tbody) return;
  var start=1;
  var first=tbody.querySelector('tr:not(.norow-row) td');
  if(first){ var v=parseInt((table.dataset.rankStart||first.textContent),10); if(!isNaN(v)) start=v; }
  var n=start;
  Array.prototype.forEach.call(tbody.rows,function(row){
    if(row.classList.contains('norow-row')) return;
    if(row.cells[0]) row.cells[0].textContent = (n++);
  });
}
function enableSortableTables(){
  document.querySelectorAll('table.stat').forEach(function(table){
    var thead = table.tHead;
    if(!thead || !thead.rows.length) return;
    var headRow = thead.rows[0];
    var ths = headRow.cells;
    for(var i=0;i<ths.length;i++){
      var th = ths[i];
      if(th.textContent.trim()==='#') continue;   /* # is a positional marker, not sortable */
      if(th.dataset.sortBound) continue;      /* avoid double-binding across SPA nav */
      th.dataset.sortBound = '1';
      th.classList.add('sortable');
      (function(idx, th){
        th.addEventListener('click', function(){
          var dir = th.classList.contains('sort-asc') ? 'desc' : 'asc';
          for(var j=0;j<headRow.cells.length;j++){ headRow.cells[j].classList.remove('sort-asc','sort-desc'); }
          th.classList.add(dir==='asc' ? 'sort-asc' : 'sort-desc');
          sortTableRows(table, idx, dir);
        });
      })(i, th);
    }
  });
}

/* ================= WOE PLAYER DETAIL PANEL ================= */
function statRow(label,value){
  return '<div class="info-item"><span>'+label+'</span><b>'+value+'</b></div>';
}
function renderWoePlayerDetail(d){
  var c=d.combat||{}, o=d.objectives||{}, s=d.support||{}, r=d.resources||{};
  return '<p class="lead">'+jobName(d.class||0)+(d.guild?(' · <b>'+d.guild+'</b>'):'')+' — '+(d.role||'No WoE activity')+
      (d.days_played?' · '+d.days_played+' WoE day'+(d.days_played===1?'':'s')+' this month':'')+'</p>'+
    '<h2 class="sec-title" style="margin-top:18px"><i class="ti ti-target-arrow"></i> Combat</h2>'+
    '<div class="info-row">'+
      statRow('Score',fmtNum(d.score||0)+(d.estimated?' <em style="opacity:.65;font-size:.82em">est.</em>':''))+statRow('Kills',fmtNum(c.kills||0))+statRow('Deaths',fmtNum(c.deaths||0))+statRow('Assists',fmtNum(c.assists||0))+
      statRow('Damage Dealt',fmtNum(c.damage_dealt||0))+statRow('Damage Taken',fmtNum(c.damage_taken||0))+statRow('Biggest Hit',fmtNum(c.top_damage||0))+
    '</div>'+
    '<h2 class="sec-title" style="margin-top:18px"><i class="ti ti-flag"></i> Objectives</h2>'+
    '<div class="info-row">'+
      statRow('Emperium Dmg',fmtNum(o.emperium_damage||0))+statRow('Emperium Kills',fmtNum(o.emperium_kill||0))+
      statRow('Guardian Dmg',fmtNum(o.guardian_damage||0))+statRow('Guardian Kills',fmtNum(o.guardian_kill||0))+
      statRow('Barricade Dmg',fmtNum(o.barricade_damage||0))+statRow('Barricade Kills',fmtNum(o.barricade_kill||0))+
    '</div>'+
    '<h2 class="sec-title" style="margin-top:18px"><i class="ti ti-heart-plus"></i> Support &amp; Skills</h2>'+
    '<div class="info-row">'+
      statRow('Skill Casts',fmtNum(s.skill_casts||0))+statRow('Resurrects',fmtNum(s.resurrects||0))+
      statRow('Support Casts',fmtNum(s.support_skills_used||0))+statRow('...On an Enemy',fmtNum(s.wrong_support_skills_used||0))+
      statRow('Healing Done',fmtNum(s.healing_done||0))+statRow('...Wrong Target',fmtNum(s.wrong_healing_done||0))+
      statRow('Acid Demonstration',fmtNum(s.acid_demonstration_used||0))+
    '</div>'+
    '<h2 class="sec-title" style="margin-top:18px"><i class="ti ti-flask"></i> Resources Used</h2>'+
    '<div class="info-row">'+
      statRow('SP Used',fmtNum(r.sp_used||0))+statRow('Spiritballs',fmtNum(r.spiritball_used||0))+
      statRow('HP Potions',fmtNum(r.hp_heal_potions||0))+statRow('SP Potions',fmtNum(r.sp_heal_potions||0))+
      statRow('Yellow Gems',fmtNum(r.yellow_gemstones||0))+statRow('Red Gems',fmtNum(r.red_gemstones||0))+statRow('Blue Gems',fmtNum(r.blue_gemstones||0))+
      statRow('Poison Bottles',fmtNum(r.poison_bottles||0))+statRow('Ammo Used',fmtNum(r.ammo_used||0))+
    '</div>';
}
async function openWoePlayerDetail(charId){
  var panel=$panel(), backdrop=$backdrop();
  if(!panel) return;
  document.getElementById('pnl-icon').className='ti ti-swords';
  document.getElementById('pnl-title').textContent='Loading…';
  document.getElementById('pnl-body').innerHTML='<p class="lead">Loading player stats…</p>';
  panel.classList.add('show'); backdrop.classList.add('show');

  var d=await NeroAPI.get('woe_player',{char_id:charId});
  if(!d){
    document.getElementById('pnl-body').innerHTML='<p class="lead">Could not load this player’s WoE stats.</p>';
    return;
  }
  document.getElementById('pnl-title').textContent=d.name||'Player';
  document.getElementById('pnl-body').innerHTML=renderWoePlayerDetail(d);
}

/* ================= WOE "MY STATUS" TAB ================= */
async function loadWoeMePage(){
  var guard=document.getElementById('woeme-guard');
  var content=document.getElementById('woeme-content');
  if(!guard||!content) return;                     /* not on the WoE page */
  if(!Auth.loggedIn){ guard.style.display=''; content.style.display='none'; return; }
  guard.style.display='none'; content.style.display='';

  var tbl=document.getElementById('woeme-tbl');
  if(!tbl) return;
  var cols=tbl.rows[0].cells.length;
  var d=await NeroAPI.get('woe_me');
  if(!d){ tbl.tBodies[0].innerHTML=noDataRow(cols,'Could not load your characters — try again shortly.'); return; }
  woeEstNote('woeme-est', !!d.estimated);
  var rows=d.rows.map(function(r){
    return tdRow([
      woeNameLink(r.char_id,r.name), r.guild||'—', jobName(r.class||0), fmtNum(r.days_played),
      fmtNum(r.kills), fmtNum(r.deaths), fmtNum(r.assists),
      fmtNum(r.damage), fmtNum(r.damage_taken), fmtNum(r.top_damage),
      fmtNum(r.emperium_damage), fmtNum(r.emperium_kill), fmtNum(r.guardian_damage), fmtNum(r.guardian_kill), fmtNum(r.barricade_damage), fmtNum(r.barricade_kill),
      fmtNum(r.skill_casts), fmtNum(r.resurrects), fmtNum(r.acid_demonstration_used),
      fmtNum(r.support_skills_used), fmtNum(r.wrong_support_skills_used), fmtNum(r.healing_done), fmtNum(r.wrong_healing_done),
      fmtNum(r.sp_used), fmtNum(r.spiritball_used), fmtNum(r.hp_heal_potions), fmtNum(r.sp_heal_potions),
      fmtNum(r.yellow_gemstones), fmtNum(r.red_gemstones), fmtNum(r.blue_gemstones), fmtNum(r.poison_bottles), fmtNum(r.ammo_used),
      r.role||'—', fmtNum(r.score)
    ]);
  });
  tbl.tBodies[0].innerHTML = rows.length ? rows.join('')
    : noDataRow(cols,'No characters found on this account.');
}

/* ================= SPA ROUTER ================= */
function afterPageLoad(){
  renderAcct();
  paintOnline();
  tickServerTime();                 /* avoid a flash of the static "—" placeholder after SPA nav */
  /* mobile: close the wiki contents drawer after navigating */
  wikiNav(false);
  curF='all';                       /* reset marketplace filter state */
  woePlayersPage=1;                 /* ...and the WoE Top Players page */
  selAmt=null;
  hydrateTable();                   /* pull live rows if the API is on */
  loadAccountPage();                /* account page, if we're on it */
  loadWoeMePage();                  /* WoE "My Status" tab, if we're on it */
  enableSortableTables();           /* click-to-sort headers on any stat table present */

  /* pages like pages/register.html carry data-open-panel so a direct link
     (or a SPA nav to it) opens straight into that panel */
  var app=document.getElementById('app');
  var wantPanel=app && app.getAttribute('data-open-panel');
  if(wantPanel) openPanel(wantPanel);
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
    /* the sidebar DOM isn't rebuilt on SPA nav (only #wiki-main is swapped),
       so make sure whichever group now contains the active link is opened —
       otherwise the highlighted page could be hidden inside a collapsed dropdown. */
    document.querySelectorAll('.wiki-side .wk-group').forEach(function(g){
      if(g.querySelector('a.active')) g.classList.add('open');
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
