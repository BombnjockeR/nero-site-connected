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

/* ================= MOCK DATA — used until API_BASE is set ================= */
const STREAMERS = [
  {name:"Hatred",     code:"311"},
  {name:"JuneGaming", code:"108"},
  {name:"PEA",        code:"449"}
];
const GUILDS    = [];   /* guild royalty referral — not enabled yet */

/* Donation: CP and Rupiah are 1 : 1. Tiers must mirror bridge/_config.php [QRIS][TiersRp]. */
const DONATE_AMOUNTS = [
  {cp:100000},{cp:250000},{cp:500000},{cp:1000000},{cp:5000000}
];
/* Whether the QRIS endpoint should be used (set false to fall back to the
   old "static QR + Discord ticket" flow). Wire to true on the VPS once the
   NusaPay dev environment is provisioned. */
const QRIS_LIVE = false;
const QRIS_POLL_MS = 4000;       /* how often the donation page asks /status */
const QRIS_EXPIRE_S = 300;        /* NusaPay unpaid QR validity (5 min) */

const SERVER_INFO = {base:"x30", job:"x30", drop:"x30", maxbase:"99", maxjob:"70", episode:"10.3 (Abyss Lake)"};

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
