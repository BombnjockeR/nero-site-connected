/* =================================================================
   BACKEND
   Bridge API running alongside FluxCP on the VPS.
   Set API_BASE to "" to fall back to mock/demo data.
   ================================================================= */
const API_BASE = "https://srv.newera-ro.com";

const NeroAPI = {
  enabled(){ return typeof API_BASE === "string" && API_BASE.length > 0; },
  authHeaders(){
    var t = Auth.token();
    return t ? {"Authorization": "Bearer " + t} : {};
  },
  async post(path, body){
    if(!this.enabled()) return {ok:false, error:"Backend not connected yet (demo mode)"};
    try{
      const ctl=new AbortController();
      const t=setTimeout(()=>ctl.abort(), 12000);
      const r=await fetch(API_BASE+path,{
        method:"POST", signal:ctl.signal, credentials:"omit",
        headers:Object.assign({"Content-Type":"application/json"}, this.authHeaders()),
        body:JSON.stringify(body)
      });
      clearTimeout(t);
      const j=await r.json().catch(()=>null);
      if(!j) return {ok:false, error:"Server did not respond properly"};
      return j;
    }catch(e){ return {ok:false, error:"Could not reach the server"}; }
  },
  /* Fetch a binary response (the QR image) with the auth header attached.
     An <img src> cannot carry an Authorization header, and putting the token
     in the query string would write a credential into logs and history — so
     the bytes are fetched here and handed to the <img> as an object URL.
     Returns null on anything unexpected; the caller falls back. */
  async blob(path){
    if(!this.enabled()) return null;
    try{
      const ctl=new AbortController();
      const t=setTimeout(()=>ctl.abort(), 15000);
      const r=await fetch(API_BASE+path,
                          {signal:ctl.signal, credentials:"omit", headers:this.authHeaders()});
      clearTimeout(t);
      if(!r.ok) return null;
      const b=await r.blob();
      /* On failure the bridge answers JSON, not an image. Rendering that would
         give a broken <img> with no explanation. */
      return (b && b.type && b.type.indexOf("image/")===0) ? b : null;
    }catch(e){ return null; }
  },
  async get(type, extra){
    if(!this.enabled()) return null;
    try{
      const ctl = new AbortController();
      const t = setTimeout(()=>ctl.abort(), 6000);       /* never hang the UI */
      var qs = "?type=" + encodeURIComponent(type);
      if(extra) for(var k in extra) qs += "&" + encodeURIComponent(k) + "=" + encodeURIComponent(extra[k]);
      const r = await fetch(API_BASE + "/stats.php" + qs,
                            {signal: ctl.signal, credentials: "omit", headers:this.authHeaders()});
      clearTimeout(t);
      if(!r.ok) return null;
      const j = await r.json();
      return (j && j.ok) ? j.data : null;
    }catch(e){ return null; }                            /* fall back silently */
  }
};

/* ================= SITE DATA =================
   These three are DEFAULTS only. NeroConfig.load() overwrites them at boot
   from stats.php?type=config, whose source of truth is bridge/_config.php.
   They stay declared with `var` for exactly that reason — and they keep
   working unchanged if the bridge is unreachable.
   ============================================================== */
var STREAMERS = [
  {name:"Hatred",     code:"311"},
  {name:"JuneGaming", code:"108"},
  {name:"PEA",        code:"449"}
];
const GUILDS    = [];   /* guild royalty referral — not enabled yet */

/* Donation: CP and Rupiah are 1 : 1. Default only — NeroConfig.load() replaces
   this with bridge/_config.php [QRIS][TiersRp], which is what the bridge
   actually enforces on a donation. */
var DONATE_AMOUNTS = [
  {cp:100000},{cp:250000},{cp:500000},{cp:1000000},{cp:5000000}
];
/* Master switch for the automatic QRIS flow. false falls back to the "static QR
   + Discord ticket" path, and the donation panel then skips the API call
   entirely instead of showing a Generate button that can only fail.

   true does NOT mean every donor gets it. The bridge decides per account, and
   the panel asks it (qrisRefreshAvailability -> qris.php?action=availability)
   before offering the button. That gate exists because the gateway is still
   NusaPay's SANDBOX: a QR it mints cannot be paid from a real banking app, so
   only the accounts in bridge/_config.php QRIS.TestAccountIds may reach it.
   Everyone else keeps the manual path and is credited by an admin.

   Verified end to end against the sandbox on 2026-09-08: generate, query and
   cancel all return 2xx. Set this back to false to kill the flow for everyone
   without touching the server. */
const QRIS_LIVE = true;
const QRIS_POLL_MS = 4000;       /* how often the donation page asks /status */
const QRIS_EXPIRE_S = 300;        /* NusaPay unpaid QR validity (5 min) */

var SERVER_INFO = {base:"x30", job:"x30", drop:"x30", maxbase:"99", maxjob:"70", episode:"10.3 (Abyss Lake)"};

/* Pull STREAMERS / DONATE_AMOUNTS / SERVER_INFO from the bridge so the site
   and bridge/_config.php cannot disagree — the donation tiers especially,
   since the bridge REJECTS an amount that is not in its own TiersRp and a
   stale preset here would just produce a failing donation.

   Everything is optional and validated: a missing, empty or malformed field
   leaves the default above in place. Returns true when something changed, so
   the caller can repaint a panel that is already on screen. */
const NeroConfig = {
  loaded: false,
  async load(){
    var d = await NeroAPI.get('config');
    if(!d) return false;                       /* offline / older bridge: keep defaults */
    var changed = false;

    if(Array.isArray(d.tiers)){
      var tiers = d.tiers
        .map(function(t){ return {cp: Number(t && t.cp)}; })
        .filter(function(t){ return isFinite(t.cp) && t.cp > 0; });
      if(tiers.length){ DONATE_AMOUNTS = tiers; changed = true; }
    }

    if(Array.isArray(d.streamers)){
      var st = d.streamers
        .filter(function(s){ return s && s.name && s.code; })
        .map(function(s){ return {name: String(s.name), code: String(s.code)}; });
      /* an empty list is a legitimate answer here — "no streamers right now" */
      STREAMERS = st; changed = true;
    }

    if(d.server && typeof d.server === 'object'){
      var keys = ['base','job','drop','maxbase','maxjob','episode'], si = {};
      for(var k in SERVER_INFO) si[k] = SERVER_INFO[k];
      keys.forEach(function(k){
        if(typeof d.server[k] === 'string' && d.server[k]) si[k] = d.server[k];
      });
      SERVER_INFO = si; changed = true;
    }

    this.loaded = true;
    return changed;
  }
};

/* Music playlist — add more tracks here as you upload them */
const TRACKS = [
  {title:"Theme of Prontera",      file:"assets/08.mp3"},
  {title:"The Place We Call Home", file:"assets/place_we_call_home.mp3"}
];

/* Discord invite — replace with your real server invite link */
const DISCORD_URL = "https://discord.gg/sXRqykzN3G";
const DOWNLOAD_URL = "https://drive.google.com/drive/folders/1ST05UgDOSsT2Zvr3D8NG9hsgrxnw_8_r?usp=drive_link";

/* Session auth — token issued by /account.php on login, sent as a Bearer header */
const Auth = {
  get loggedIn(){ return sessionStorage.getItem("nero_login")==="1"; },
  set loggedIn(v){ sessionStorage.setItem("nero_login", v?"1":"0"); },
  user(){ return sessionStorage.getItem("nero_user")||""; },
  setUser(n){ sessionStorage.setItem("nero_user",n); },
  token(){ return sessionStorage.getItem("nero_token")||""; },
  setToken(t){ if(t) sessionStorage.setItem("nero_token",t); else sessionStorage.removeItem("nero_token"); },
  logout(){ sessionStorage.removeItem("nero_login"); sessionStorage.removeItem("nero_user"); sessionStorage.removeItem("nero_token"); }
};
function fmtRp(n){ return "Rp " + n.toLocaleString("id-ID"); }
/* Tolerates a missing field: a table column can go live before the bridge that
   feeds it is redeployed, and n.toLocaleString() on undefined would throw and
   leave the whole table stuck on "Loading...". */
function fmtNum(n){ return (n===null||n===undefined||isNaN(n)) ? "0" : Number(n).toLocaleString("en-US"); }
