/* GM Player Monitor — pages/admin-players.html only.
   Data comes from bridge/gm.php, which refuses anyone below GM; hiding the page
   from players is a convenience, not the access control. */

var PM = {watch: null, map: 'all', timer: null, busy: false};

function pmNum(n){ return fmtNum(Math.round(Number(n) || 0)); }

/* "2026-09-24 13:42:07" -> "24 Sep, 13:42:07". Parsed by hand: Safari will
   not give a MySQL DATETIME to new Date(). */
function pmWhen(s){
  var m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if(!m) return escHtml(s || '—');
  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return (+m[3]) + ' ' + months[(+m[2]) - 1] + ', ' + m[4] + ':' + m[5] + ':' + m[6];
}

function pmMsg(id, text, bad){
  var el = document.getElementById(id);
  if(el) el.innerHTML = text ? '<p class="don-note ' + (bad ? 'bad' : '') + '">' + escHtml(text) + '</p>' : '';
}

function pmQs(obj){
  return Object.keys(obj).map(function(k){ return k + '=' + encodeURIComponent(obj[k]); }).join('&');
}

function pmGet(action, params){
  return NeroAPI.post('/gm.php?' + pmQs(Object.assign({action: action}, params || {})), {});
}

/* A character name that opens its Item Log - the usual next step from any row. */
function pmCharLink(name, id){
  if(!name && !id) return '<span class="adm-by">—</span>';
  var label = name ? escHtml(name) : ('#' + escHtml(String(id)));
  var key = name || String(id);
  return '<a class="pm-link" onclick="pmLookup(\'items\',' + escHtml(JSON.stringify(key)) + ')">' + label + '</a>';
}

function pmItem(items, id, refine){
  var n = items && items[id];
  return (refine > 0 ? '+' + refine + ' ' : '') + (n ? escHtml(n) : 'Item') +
         ' <span class="adm-ref">#' + escHtml(String(id)) + '</span>';
}

/* --- access / start ----------------------------------------------------- */

async function pmInit(){
  var gate = document.getElementById('pm-gate');
  var msg  = document.getElementById('pm-gate-msg');
  var main = document.getElementById('pm-main');

  if(!Auth.loggedIn){
    msg.innerHTML = 'Sign in with a staff account to view this page. ' +
                    '<a href="#" onclick="openPanel(\'login\');return false;">Sign in</a>';
    return;
  }
  var res = await pmGet('watcher');
  if(res && res.ok){
    gate.style.display = 'none';
    msg.textContent = '';          /* stop the watchdog from restarting us */
    main.style.display = '';
    pwRender(res.data);
    pmRestoreTab();
    pwAuto();
    return;
  }
  main.style.display = 'none';
  msg.textContent = /admins only/i.test((res && res.error) || '')
    ? 'This page is for staff accounts only.'
    : qrisErrorText(res);
}

function pmStart(){
  if(PM.busy || !document.getElementById('pm-gate')) return;
  PM.busy = true;
  pmInit().catch(function(e){
    try{ console.error('[admin-players]', e); }catch(_){}
    var msg = document.getElementById('pm-gate-msg');
    if(msg) msg.textContent = 'Could not load the dashboard. Check your connection and try again.';
  }).then(function(){ PM.busy = false; });
}

if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pmStart);
else pmStart();

/* Same watchdog as the donation dashboard: an untouched "Loading…" gate with
   nothing in flight (SPA arrival, sign-in) gets started. */
setInterval(function(){
  var gate = document.getElementById('pm-gate');
  var msg  = document.getElementById('pm-gate-msg');
  if(gate && gate.style.display !== 'none' && msg && msg.textContent === 'Loading…' && !PM.busy) pmStart();
}, 1500);

function pmTab(name, btn){
  document.querySelectorAll('#pm-main .atab').forEach(function(b){ b.classList.toggle('on', b === btn); });
  document.querySelectorAll('#pm-main .atab-panel').forEach(function(p){ p.classList.remove('show'); });
  var el = document.getElementById('pm-tab-' + name);
  if(el) el.classList.add('show');
  try{ sessionStorage.setItem('nero_pm_tab', name); }catch(e){}
}

function pmRestoreTab(){
  var want = null;
  try{ want = sessionStorage.getItem('nero_pm_tab'); }catch(e){}
  var btn = want && document.querySelector('#pm-main .atab[data-t="' + want + '"]');
  if(btn) pmTab(want, btn);
}

/* Jump to a log tab with the character filled in and run it. */
function pmLookup(tab, name){
  var btn = document.querySelector('#pm-main .atab[data-t="' + tab + '"]');
  if(btn) pmTab(tab, btn);
  var prefix = {items: 'pi', zeny: 'pz', trades: 'pt', cash: 'pc'}[tab];
  var inp = document.getElementById(prefix + '-char');
  if(inp) inp.value = name;
  if(tab === 'items'){
    document.getElementById('pi-item').value = '';
    document.getElementById('pi-uid').value = '';
    piLoad();
  } else if(tab === 'zeny') pzLoad();
  else if(tab === 'cash') pcLoad();
  else ptLoad();
  window.scrollTo(0, 0);
}

/* --- WATCHER ------------------------------------------------------------ */

var PW_STATUS = {
  playing:     {label: 'Playing',          cls: 'ok'},
  vending_afk: {label: 'AFK Vending',      cls: 'warn'},
  vending:     {label: 'Vending',          cls: 'muted'},
  buying_afk:  {label: 'AFK Buying Store', cls: 'warn'},
  buying:      {label: 'Buying Store',     cls: 'muted'}
};

async function pwLoad(){
  if(!document.getElementById('pw-tbl')) return;
  var res = await pmGet('watcher');
  if(!res || !res.ok) return pmMsg('pw-msg', qrisErrorText(res), true);
  pmMsg('pw-msg', '');
  pwRender(res.data);
}

/* Auto refresh only while this page is on screen and the Watcher tab is open. */
function pwAuto(){
  if(PM.timer){ clearInterval(PM.timer); PM.timer = null; }
  var sel = document.getElementById('pw-auto');
  var sec = sel ? Number(sel.value) : 0;
  if(!sec) return;
  PM.timer = setInterval(function(){
    var panel = document.getElementById('pm-tab-watcher');
    if(!panel){ clearInterval(PM.timer); PM.timer = null; return; }
    if(panel.classList.contains('show') && !document.hidden) pwLoad();
  }, sec * 1000);
}

function pwRender(d){
  PM.watch = d;
  var t = d.totals || {};
  var tiles = [
    {label: 'Online',        value: pmNum(t.online),  sub: pmNum(t.gm) + ' staff', tone: 'gold'},
    {label: 'Playing',       value: pmNum(t.playing), sub: 'at the keyboard'},
    {label: 'AFK vending',   value: pmNum(t.vending_afk), sub: pmNum(t.vending) + ' vending at keyboard'},
    {label: 'Buying stores', value: pmNum((+t.buying_afk || 0) + (+t.buying || 0)), sub: pmNum(t.buying_afk) + ' AFK'},
    {label: 'Maps in use',   value: pmNum((d.maps || []).length), sub: (d.maps && d.maps[0]) ? 'busiest: ' + escHtml(d.maps[0].map) : '—'}
  ];
  document.getElementById('pm-tiles').innerHTML = tiles.map(function(x){
    return '<div class="adm-tile ' + (x.tone || '') + '"><div class="adm-tile-lbl">' + escHtml(x.label) +
           '</div><div class="adm-tile-val">' + x.value + '</div><div class="adm-tile-sub">' + x.sub + '</div></div>';
  }).join('');

  /* Map dropdown + chips: keep the current pick across refreshes. */
  var sel = document.getElementById('pw-map');
  var keep = sel.value;
  sel.innerHTML = '<option value="all">All maps</option>' + (d.maps || []).map(function(m){
    return '<option value="' + escHtml(m.map) + '">' + escHtml(m.map) + ' (' + m.total + ')</option>';
  }).join('');
  sel.value = (d.maps || []).some(function(m){ return m.map === keep; }) ? keep : 'all';

  document.getElementById('pw-at').textContent = 'Updated ' + pmWhen(d.at);
  pwPaint();
}

function pwPickMap(m){
  var sel = document.getElementById('pw-map');
  sel.value = sel.value === m ? 'all' : m;
  pwPaint();
}

function pwPaint(){
  var d = PM.watch; if(!d) return;
  var q    = document.getElementById('pw-q').value.trim().toLowerCase();
  var st   = document.getElementById('pw-status').value;
  var map  = document.getElementById('pw-map').value;

  document.getElementById('pw-maps').innerHTML = (d.maps || []).slice(0, 16).map(function(m){
    return '<button class="pm-map' + (m.map === map ? ' on' : '') + '" onclick="pwPickMap(' +
           escHtml(JSON.stringify(m.map)) + ')" title="' + m.playing + ' playing, ' + m.shops + ' shops">' +
           escHtml(m.map) + '<b>' + m.total + '</b></button>';
  }).join('');

  var rows = (d.rows || []).filter(function(r){
    if(map !== 'all' && r.map !== map) return false;
    if(st === 'shop' && r.status === 'playing') return false;
    if(st === 'multi' && !(r.same_pc > 1 || r.same_ip > 1)) return false;
    if(st !== 'all' && st !== 'shop' && st !== 'multi' && r.status !== st) return false;
    if(q){
      var hay = [r.name, r.userid, r.map, r.guild, r.shop, String(r.account_id)].join(' ').toLowerCase();
      if(hay.indexOf(q) < 0) return false;
    }
    return true;
  });

  var tb = document.querySelector('#pw-tbl tbody');
  if(!rows.length){
    tb.innerHTML = '<tr><td class="norow" colspan="8">' +
      ((d.rows || []).length ? 'Nobody matches these filters.' : 'Nobody is online.') + '</td></tr>';
    return;
  }
  tb.innerHTML = rows.map(function(r){
    var s = PW_STATUS[r.status] || {label: r.status, cls: 'muted'};
    var multi = '';
    if(r.same_pc > 1) multi += '<span class="adm-badge warn" title="Clients on the same PC (Gepard hardware ID)">' + r.same_pc + ' on PC</span> ';
    if(r.same_ip > 1) multi += '<span class="adm-badge muted" title="' + escHtml(r.ip) + '">' + r.same_ip + ' on IP</span>';
    return '<tr>' +
      '<td>' + pmCharLink(r.name, r.char_id) + (r.gm ? ' <span class="adm-badge bad">GM</span>' : '') + '</td>' +
      '<td>' + escHtml(r.userid) + '<span class="pm-sub">#' + r.account_id + '</span></td>' +
      '<td>' + escHtml(jobName(r.class)) + '<span class="pm-sub">' + r.base_level + ' / ' + r.job_level + '</span></td>' +
      '<td>' + (r.guild ? escHtml(r.guild) : '<span class="adm-by">—</span>') + '</td>' +
      '<td><a class="pm-link" onclick="pwPickMap(' + escHtml(JSON.stringify(r.map)) + ')">' + escHtml(r.map) + '</a>' +
        '<span class="pm-sub">' + r.x + ', ' + r.y + '</span></td>' +
      '<td><span class="adm-badge ' + s.cls + '">' + escHtml(s.label) + '</span>' +
        (r.shop ? '<span class="pm-shop" title="' + escHtml(r.shop) + '">' + escHtml(r.shop) + '</span>' : '') + '</td>' +
      '<td>' + (multi || '<span class="adm-by">—</span>') + '</td>' +
      '<td class="adm-act">' +
        '<button class="adm-btn" onclick="pmLookup(\'zeny\',' + escHtml(JSON.stringify(r.name)) + ')" title="Zeny log"><i class="ti ti-coins"></i></button>' +
        '<button class="adm-btn" onclick="pmLookup(\'trades\',' + escHtml(JSON.stringify(r.name)) + ')" title="Trades"><i class="ti ti-arrows-exchange"></i></button>' +
        '<button class="adm-btn" onclick="pmLookup(\'cash\',' + escHtml(JSON.stringify(r.name)) + ')" title="Cash log"><i class="ti ti-diamond"></i></button>' +
      '</td></tr>';
  }).join('');
}

/* --- ITEM LOG ----------------------------------------------------------- */

async function piLoad(){
  var p = {
    char: document.getElementById('pi-char').value.trim(),
    item: document.getElementById('pi-item').value.trim(),
    uid:  document.getElementById('pi-uid').value.trim(),
    type: document.getElementById('pi-type').value,
    days: document.getElementById('pi-days').value
  };
  var tb = document.querySelector('#pi-tbl tbody');
  tb.innerHTML = '<tr><td class="norow" colspan="8">Searching…</td></tr>';
  pmMsg('pi-msg', '');
  var res = await pmGet('itemlog', p);
  if(!res || !res.ok){
    tb.innerHTML = '<tr><td class="norow" colspan="8">—</td></tr>';
    return pmMsg('pi-msg', qrisErrorText(res), true);
  }
  var d = res.data;
  if(d.truncated) pmMsg('pi-msg', 'Showing the newest ' + d.rows.length + ' rows only — narrow the period or type.');
  if(!d.rows.length){
    tb.innerHTML = '<tr><td class="norow" colspan="8">Nothing logged for this search.</td></tr>';
    return;
  }
  tb.innerHTML = d.rows.map(function(r){
    var amt = Number(r.amount);
    var cards = [r.card0, r.card1, r.card2, r.card3].filter(function(c){ return +c > 0 && +c < 65535; });
    var other = +r.partner_id
      ? pmCharLink(d.names[r.partner_id], r.partner_id)
      : ({S: 'NPC shop', N: 'NPC script', J: 'Barter NPC', M: 'Monster', '$': 'Cash shop', A: 'GM command'}[r.type] ?
         '<span class="adm-by">' + ({S: 'NPC shop', N: 'NPC script', J: 'Barter NPC', M: 'Monster', '$': 'Cash shop', A: 'GM command'}[r.type]) + '</span>' : '<span class="adm-by">—</span>');
    return '<tr>' +
      '<td>' + pmWhen(r.time) + '</td>' +
      '<td>' + pmCharLink(d.names[r.char_id], r.char_id) + '</td>' +
      '<td>' + escHtml(d.types[r.type] || r.type) + '</td>' +
      '<td>' + pmItem(d.items, r.nameid, +r.refine) +
        (cards.length ? '<span class="pm-sub">' + cards.map(function(c){ return pmItem(d.items, c, 0); }).join(', ') + '</span>' : '') + '</td>' +
      '<td class="' + (amt < 0 ? 'pm-out' : 'pm-in') + '">' + (amt > 0 ? '+' : '') + pmNum(amt) + '</td>' +
      '<td>' + other + '</td>' +
      '<td>' + escHtml(r.map) + '</td>' +
      '<td>' + (r.unique_id && r.unique_id !== '0'
        ? '<a class="pm-link adm-ref" onclick="piTrace(\'' + escHtml(r.unique_id) + '\')" title="Follow this exact item">' + escHtml(r.unique_id) + '</a>'
        : '<span class="adm-by">—</span>') + '</td>' +
    '</tr>';
  }).join('');
}

/* Follow one item instance across every owner. */
function piTrace(uid){
  document.getElementById('pi-char').value = '';
  document.getElementById('pi-item').value = '';
  document.getElementById('pi-uid').value = uid;
  document.getElementById('pi-type').value = 'all';
  document.getElementById('pi-days').value = '90';
  piLoad();
}

/* --- ZENY LOG ----------------------------------------------------------- */

async function pzLoad(){
  var p = {
    char: document.getElementById('pz-char').value.trim(),
    type: document.getElementById('pz-type').value,
    days: document.getElementById('pz-days').value
  };
  var tb = document.querySelector('#pz-tbl tbody');
  tb.innerHTML = '<tr><td class="norow" colspan="5">Searching…</td></tr>';
  document.getElementById('pz-summary').innerHTML = '';
  pmMsg('pz-msg', '');
  var res = await pmGet('zenylog', p);
  if(!res || !res.ok){
    tb.innerHTML = '<tr><td class="norow" colspan="5">—</td></tr>';
    return pmMsg('pz-msg', qrisErrorText(res), true);
  }
  var d = res.data;
  var zin = 0, zout = 0;
  d.by_type.forEach(function(x){ zin += +x.zin; zout += +x.zout; });

  var tiles = '<div class="adm-tiles">' +
    '<div class="adm-tile gold"><div class="adm-tile-lbl">' + escHtml(d.who.name) + '</div><div class="adm-tile-val">' +
      (zin - zout >= 0 ? '+' : '') + pmNum(zin - zout) + '</div><div class="adm-tile-sub">net zeny in the period</div></div>' +
    '<div class="adm-tile"><div class="adm-tile-lbl">Zeny in</div><div class="adm-tile-val pm-in">' + pmNum(zin) + '</div></div>' +
    '<div class="adm-tile"><div class="adm-tile-lbl">Zeny out</div><div class="adm-tile-val pm-out">' + pmNum(zout) + '</div></div></div>';

  var byType = '<div><h2 class="adm-h2"><i class="ti ti-chart-pie"></i> By source</h2><div class="tbl-wrap"><table class="stat">' +
    '<thead><tr><th>Type</th><th>In</th><th>Out</th><th>Times</th></tr></thead><tbody>' +
    (d.by_type.length ? d.by_type.map(function(x){
      return '<tr><td>' + escHtml(d.types[x.type] || x.type) + '</td><td class="pm-in">' + pmNum(x.zin) +
             '</td><td class="pm-out">' + pmNum(x.zout) + '</td><td>' + pmNum(x.n) + '</td></tr>';
    }).join('') : '<tr><td class="norow" colspan="4">No zeny movement.</td></tr>') + '</tbody></table></div></div>';

  var top = '<div><h2 class="adm-h2"><i class="ti ti-users"></i> Top counterparties</h2><div class="tbl-wrap"><table class="stat">' +
    '<thead><tr><th>Player</th><th>Received from</th><th>Paid to</th><th>Times</th></tr></thead><tbody>' +
    (d.top.length ? d.top.map(function(x){
      return '<tr><td>' + pmCharLink(d.names[x.src_id], x.src_id) + '</td><td class="pm-in">' + pmNum(x.zin) +
             '</td><td class="pm-out">' + pmNum(x.zout) + '</td><td>' + pmNum(x.n) + '</td></tr>';
    }).join('') : '<tr><td class="norow" colspan="4">No player-to-player zeny.</td></tr>') + '</tbody></table></div></div>';

  document.getElementById('pz-summary').innerHTML = tiles + '<div class="pm-split">' + byType + top + '</div>';
  if(d.truncated) pmMsg('pz-msg', 'Showing the newest ' + d.rows.length + ' rows only — narrow the period or type.');

  tb.innerHTML = d.rows.length ? d.rows.map(function(r){
    var amt = Number(r.amount);
    var p2p = r.type === 'T' || r.type === 'V' || r.type === 'B';
    return '<tr><td>' + pmWhen(r.time) + '</td><td>' + escHtml(d.types[r.type] || r.type) + '</td>' +
      '<td class="' + (amt < 0 ? 'pm-out' : 'pm-in') + '">' + (amt > 0 ? '+' : '') + pmNum(amt) + '</td>' +
      '<td>' + (p2p && +r.src_id ? pmCharLink(d.names[r.src_id], r.src_id) : '<span class="adm-by">—</span>') + '</td>' +
      '<td>' + escHtml(r.map) + '</td></tr>';
  }).join('') : '<tr><td class="norow" colspan="5">No zeny movement in this period.</td></tr>';
}

/* --- TRADES ------------------------------------------------------------- */

async function ptLoad(){
  var p = {char: document.getElementById('pt-char').value.trim(), days: document.getElementById('pt-days').value};
  var tb = document.querySelector('#pt-tbl tbody');
  tb.innerHTML = '<tr><td class="norow" colspan="5">Searching…</td></tr>';
  document.getElementById('pt-summary').innerHTML = '';
  pmMsg('pt-msg', '');
  var res = await pmGet('trades', p);
  if(!res || !res.ok){
    tb.innerHTML = '<tr><td class="norow" colspan="5">—</td></tr>';
    return pmMsg('pt-msg', qrisErrorText(res), true);
  }
  var d = res.data;

  document.getElementById('pt-summary').innerHTML = d.partners.length
    ? '<h2 class="adm-h2"><i class="ti ti-users"></i> ' + escHtml(d.who.name) + ' trades with</h2><div class="tbl-wrap"><table class="stat">' +
      '<thead><tr><th>Partner</th><th>Trades</th><th>Items given</th><th>Items got</th><th>Zeny given</th><th>Zeny got</th></tr></thead><tbody>' +
      d.partners.map(function(x){
        return '<tr><td>' + pmCharLink(d.names[x.partner_id], x.partner_id) + '</td><td>' + pmNum(x.n) +
          '</td><td class="pm-out">' + pmNum(x.items_gave) + '</td><td class="pm-in">' + pmNum(x.items_got) +
          '</td><td class="pm-out">' + pmNum(x.zeny_gave) + '</td><td class="pm-in">' + pmNum(x.zeny_got) + '</td></tr>';
      }).join('') + '</tbody></table></div>'
    : '';

  var side = function(list, zeny, cls){
    var li = list.map(function(it){
      return '<li>' + pmNum(it.amount) + '× ' + pmItem(d.items, it.nameid, it.refine) +
        (it.unique_id && it.unique_id !== '0'
          ? ' <a class="pm-link adm-ref" onclick="pmTraceFromTrade(\'' + escHtml(it.unique_id) + '\')" title="Follow this exact item">⟶</a>' : '') + '</li>';
    });
    if(zeny) li.push('<li class="' + cls + '">' + pmNum(zeny) + ' zeny</li>');
    return li.length ? '<ul class="pm-items">' + li.join('') + '</ul>' : '<span class="adm-by">nothing</span>';
  };

  tb.innerHTML = d.trades.length ? d.trades.map(function(t){
    return '<tr><td>' + pmWhen(t.time) + '</td>' +
      '<td>' + (t.partner_id ? pmCharLink(d.names[t.partner_id], t.partner_id) +
        (t.exact ? ' <span class="adm-badge ok">exact</span>' : '') : '<span class="adm-by">unknown</span>') + '</td>' +
      '<td>' + side(t.gave, t.zeny_gave, 'pm-out') + '</td>' +
      '<td>' + side(t.got, t.zeny_got, 'pm-in') + '</td>' +
      '<td>' + escHtml(t.map) + '</td></tr>';
  }).join('') : '<tr><td class="norow" colspan="5">No trades in this period.</td></tr>';
}

function pmTraceFromTrade(uid){
  var btn = document.querySelector('#pm-main .atab[data-t="items"]');
  if(btn) pmTab('items', btn);
  piTrace(uid);
  window.scrollTo(0, 0);
}

/* --- CASH LOG ----------------------------------------------------------- */

var PC_CUR = {C: 'Cash Points', K: 'Kafra Points', O: 'Other'};

/* One timeline row -> {type, detail(html), text(plain, for CSV)}. */
function pcDescribe(d, r){
  if(r.kind === 'donation'){
    var parts = [pmNum(r.credit_cp) + ' base'];
    if(+r.bonus_cp) parts.push(pmNum(r.bonus_cp) + ' streamer ' + (r.streamer_code || ''));
    if(+r.guild_bonus_cp) parts.push(pmNum(r.guild_bonus_cp) + ' guild ' + (r.guild_name || ''));
    var txt = 'Rp ' + pmNum(r.amount_rp) + ' (' + r.source + ' #' + r.id + '): ' + parts.join(' + ');
    return {type: 'QRIS donation', detail: escHtml(txt), text: txt};
  }
  var type = (d.types[r.type] || r.type) + (r.cash_type !== 'C' ? ' · ' + (PC_CUR[r.cash_type] || r.cash_type) : '');
  if(r.items && r.items.length){
    var html = '<ul class="pm-items">' + r.items.map(function(it){
      return '<li>' + pmNum(it.amount) + '× ' + pmItem(d.items, it.nameid, 0) + '</li>';
    }).join('') + '</ul>';
    var text = r.items.map(function(it){
      return it.amount + 'x ' + ((d.items && d.items[it.nameid]) || 'Item') + ' #' + it.nameid;
    }).join('; ');
    return {type: type, detail: html, text: text};
  }
  if(r.gm){
    var t = 'GM ' + r.gm.by + ': ' + r.gm.command;
    return {type: type, detail: escHtml(t), text: t};
  }
  return {type: type, detail: '<span class="adm-by">—</span>', text: ''};
}

async function pcLoad(){
  var p = {
    char: document.getElementById('pc-char').value.trim(),
    days: document.getElementById('pc-days').value
  };
  var from = document.getElementById('pc-from').value;
  if(from) p.from = from;
  var tb = document.querySelector('#pc-tbl tbody');
  tb.innerHTML = '<tr><td class="norow" colspan="6">Searching…</td></tr>';
  document.getElementById('pc-summary').innerHTML = '';
  document.getElementById('pc-csv').disabled = true;
  PM.cash = null;
  pmMsg('pc-msg', '');
  var res = await pmGet('cashlog', p);
  if(!res || !res.ok){
    tb.innerHTML = '<tr><td class="norow" colspan="6">—</td></tr>';
    return pmMsg('pc-msg', qrisErrorText(res), true);
  }
  var d = res.data;
  PM.cash = d;
  document.getElementById('pc-csv').disabled = !d.rows.length;

  var cin = +d.donations_cp || 0, cout = 0;
  d.by_type.forEach(function(x){ if(x.cash_type === 'C'){ cin += +x.in; cout += +x.out; } });
  var gap = +d.recon.unlogged || 0;

  var tiles = '<div class="adm-tiles">' +
    '<div class="adm-tile gold"><div class="adm-tile-lbl">' + escHtml(d.userid) + ' · balance now</div><div class="adm-tile-val">' +
      pmNum(d.balance.cash) + '</div><div class="adm-tile-sub">Cash Points' + (+d.balance.kafra ? ' · ' + pmNum(d.balance.kafra) + ' Kafra' : '') + '</div></div>' +
    '<div class="adm-tile"><div class="adm-tile-lbl">CP in</div><div class="adm-tile-val pm-in">' + pmNum(cin) +
      '</div><div class="adm-tile-sub">' + pmNum(d.donations_cp) + ' from QRIS</div></div>' +
    '<div class="adm-tile"><div class="adm-tile-lbl">CP out</div><div class="adm-tile-val pm-out">' + pmNum(cout) +
      '</div><div class="adm-tile-sub">in this period</div></div>' +
    '<div class="adm-tile"><div class="adm-tile-lbl">Not in logs</div><div class="adm-tile-val ' + (gap ? 'pm-out' : 'pm-in') + '">' +
      (gap > 0 ? '+' : '') + pmNum(gap) + '</div><div class="adm-tile-sub" title="balance − all QRIS credits − all cashlog rows">' +
      'all time, logs since ' + pmWhen(d.recon.first_log) + '</div></div></div>';

  var bought = '<div><h2 class="adm-h2"><i class="ti ti-shopping-cart"></i> Bought in the Cash Shop</h2><div class="tbl-wrap"><table class="stat">' +
    '<thead><tr><th>Item</th><th>Qty</th><th>Purchases</th><th>CP</th></tr></thead><tbody>' +
    (d.items_bought.length ? d.items_bought.map(function(x){
      return '<tr><td>' + pmItem(d.items, x.nameid, 0) + '</td><td>' + pmNum(x.qty) + '</td><td>' + pmNum(x.buys) +
        '</td><td class="pm-out">' + pmNum(x.cp) + (+x.cart_buys ? ' <span class="adm-ref" title="Bought together with other items; that price cannot be split per item">+' + x.cart_buys + ' in a cart</span>' : '') + '</td></tr>';
    }).join('') : '<tr><td class="norow" colspan="4">Nothing bought in this period.</td></tr>') + '</tbody></table></div></div>';

  var bySrc = d.by_type.slice();
  if(+d.donations_cp) bySrc.unshift({cash_type: 'C', type: 'QRIS', in: d.donations_cp, out: 0,
    n: d.rows.filter(function(r){ return r.kind === 'donation'; }).length});
  var src = '<div><h2 class="adm-h2"><i class="ti ti-chart-pie"></i> By source</h2><div class="tbl-wrap"><table class="stat">' +
    '<thead><tr><th>Type</th><th>In</th><th>Out</th><th>Times</th></tr></thead><tbody>' +
    (bySrc.length ? bySrc.map(function(x){
      var lbl = x.type === 'QRIS' ? 'QRIS donation' : (d.types[x.type] || x.type);
      if(x.cash_type !== 'C') lbl += ' · ' + (PC_CUR[x.cash_type] || x.cash_type);
      return '<tr><td>' + escHtml(lbl) + '</td><td class="pm-in">' + pmNum(x.in) + '</td><td class="pm-out">' +
        pmNum(x.out) + '</td><td>' + pmNum(x.n) + '</td></tr>';
    }).join('') : '<tr><td class="norow" colspan="4">No Cash Point movement.</td></tr>') + '</tbody></table></div></div>';

  document.getElementById('pc-summary').innerHTML = tiles + '<div class="pm-split">' + bought + src + '</div>';
  if(d.truncated) pmMsg('pc-msg', 'Showing the newest cash log rows only — narrow the period.');

  tb.innerHTML = d.rows.length ? d.rows.map(function(r){
    var x = pcDescribe(d, r);
    var amt = Number(r.amount);
    return '<tr><td>' + pmWhen(r.time) + '</td>' +
      '<td>' + (r.char_id ? pmCharLink(d.chars[r.char_id], r.char_id) : '<span class="adm-by">account</span>') + '</td>' +
      '<td>' + escHtml(x.type) + '</td><td>' + x.detail + '</td>' +
      '<td class="' + (amt < 0 ? 'pm-out' : 'pm-in') + '">' + (amt > 0 ? '+' : '') + pmNum(amt) + '</td>' +
      '<td>' + (r.map ? escHtml(r.map) : '<span class="adm-by">—</span>') + '</td></tr>';
  }).join('') : '<tr><td class="norow" colspan="6">No Cash Point movement in this period.</td></tr>';
}

/* The timeline as CSV (UTF-8 with BOM so Excel opens it as UTF-8). */
function pcCsv(){
  var d = PM.cash; if(!d || !d.rows.length) return;
  var q = function(v){ v = String(v == null ? '' : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  var lines = [['time', 'account', 'character', 'type', 'currency', 'cp', 'detail', 'map', 'log_id'].join(',')];
  d.rows.slice().reverse().forEach(function(r){
    var x = pcDescribe(d, r);
    lines.push([r.time, d.userid, r.char_id ? (d.chars[r.char_id] || r.char_id) : '', x.type,
      PC_CUR[r.cash_type] || r.cash_type, r.amount, x.text, r.map,
      (r.kind === 'donation' ? 'qris#' : 'cashlog#') + r.id].map(q).join(','));
  });
  var blob = new Blob(['﻿' + lines.join('\r\n')], {type: 'text/csv;charset=utf-8'});
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'cashlog_' + d.userid + '_' + new Date().toISOString().slice(0, 10) + '.csv';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function(){ URL.revokeObjectURL(a.href); }, 1000);
}
