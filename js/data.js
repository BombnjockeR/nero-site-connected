/* =================================================================
   BACKEND
   Set API_BASE to your live API to switch from placeholder data.
   Leave it "" to keep using the mock data below.
   Example: "https://api.newera-ro.com/api"
   ================================================================= */
const API_BASE = "";

const NeroAPI = {
  enabled(){ return typeof API_BASE === "string" && API_BASE.length > 0; },
  async post(path, body){
    if(!this.enabled()) return {ok:false, error:"Backend not connected yet (demo mode)"};
    try{
      const ctl=new AbortController();
      const t=setTimeout(()=>ctl.abort(), 12000);
      const r=await fetch(API_BASE+path,{
        method:"POST", signal:ctl.signal, credentials:"omit",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify(body)
      });
      clearTimeout(t);
      const j=await r.json().catch(()=>null);
      if(!j) return {ok:false, error:"Server did not respond properly"};
      return j;
    }catch(e){ return {ok:false, error:"Could not reach the server"}; }
  },
  async get(type){
    if(!this.enabled()) return null;
    try{
      const ctl = new AbortController();
      const t = setTimeout(()=>ctl.abort(), 6000);       /* never hang the UI */
      const r = await fetch(API_BASE + "/stats.php?type=" + encodeURIComponent(type),
                            {signal: ctl.signal, credentials: "omit"});
      clearTimeout(t);
      if(!r.ok) return null;
      const j = await r.json();
      return (j && j.ok) ? j.data : null;
    }catch(e){ return null; }                            /* fall back silently */
  }
};

/* ================= MOCK DATA — used until API_BASE is set ================= */
const STREAMERS = ["AsuraLive","PoringTV","ValkyrieVODs","MidgardMaster","BraninRO"];
const GUILDS    = ["Valhalla","Nidhogg","Ragnarok Elite","Prontera Knights","Shadow Covenant"];

/* Donation: CP and Rupiah are 1 : 1 */
const DONATE_AMOUNTS = [
  {cp:100000},{cp:250000},{cp:500000},{cp:1000000},{cp:5000000}
];

const SERVER_INFO = {base:"x30", job:"x30", drop:"x30", maxbase:"99", maxjob:"70", episode:"10.3 (Abyss Lake)"};

/* Music playlist — add more tracks here as you upload them */
const TRACKS = [
  {title:"The Place We Call Home", file:"assets/place_we_call_home.mp3"},
  {title:"Theme of Prontera",      file:"assets/08.mp3"}
];

/* Discord invite — replace with your real server invite link */
const DISCORD_URL = "https://discord.gg/sXRqykzN3G";
const DOWNLOAD_URL = "https://drive.google.com/drive/folders/1ST05UgDOSsT2Zvr3D8NG9hsgrxnw_8_r?usp=drive_link";

/* Session auth (demo only) */
const Auth = {
  get loggedIn(){ return sessionStorage.getItem("nero_login")==="1"; },
  set loggedIn(v){ sessionStorage.setItem("nero_login", v?"1":"0"); },
  user(){ return sessionStorage.getItem("nero_user")||""; },
  setUser(n){ sessionStorage.setItem("nero_user",n); },
  logout(){ sessionStorage.removeItem("nero_login"); sessionStorage.removeItem("nero_user"); }
};
function fmtRp(n){ return "Rp " + n.toLocaleString("id-ID"); }
function fmtNum(n){ return n.toLocaleString("en-US"); }
