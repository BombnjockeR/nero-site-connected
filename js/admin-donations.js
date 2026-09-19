/* Admin donation dashboard — pages/admin-donations.html only.
   Kept out of app.js because every other page loads that file and none of them
   need this. */

var ADM = {rows: [], totals: {}, streamers: []};

/* Rupiah with no decimals; fmtRp in data.js already does the grouping. */
function admRp(n){ return fmtRp(Math.round(Number(n) || 0)); }
function admNum(n){ return fmtNum(Math.round(Number(n) || 0)); }
function admPlural(n, word){
  n = Math.round(Number(n) || 0);
  return admNum(n) + ' ' + word + (n === 1 ? '' : 's');
}

/* "2026-09-08 13:42:07" -> "8 Sep, 13:42". Parsed by hand because the bridge
   sends MySQL DATETIME, which Safari refuses to give to new Date(). */
function admWhen(s){
  if(!s) return '—';
  var m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if(!m) return escHtml(s);
  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return (+m[3]) + ' ' + months[(+m[2]) - 1] + ', ' + m[4] + ':' + m[5];
}

var ADM_STATUS = {
  paid:        {label: 'Paid',        cls: 'ok'},
  unconfirmed: {label: 'Waiting',     cls: 'warn'},
  pending:     {label: 'QR unpaid',   cls: 'muted'},
  cancelled:   {label: 'Cancelled',   cls: 'muted'},
  expired:     {label: 'Expired',     cls: 'muted'},
  failed:      {label: 'Rejected',    cls: 'bad'},
  refunded:    {label: 'Refunded',    cls: 'bad'}
};

function admBadge(status){
  var s = ADM_STATUS[status] || {label: status || '—', cls: 'muted'};
  return '<span class="adm-badge ' + s.cls + '">' + escHtml(s.label) + '</span>';
}

/* --- access ------------------------------------------------------------- */

/* The bridge is the authority on who is staff — this only decides what to draw.
   A player who opens the URL gets the notice; the API would refuse them anyway. */
async function admInit(){
  var gate = document.getElementById('adm-gate');
  var msg  = document.getElementById('adm-gate-msg');
  var main = document.getElementById('adm-main');

  if(!Auth.loggedIn){
    gate.style.display = '';
    msg.innerHTML = 'Sign in with a staff account to view this page. ' +
                    '<a href="#" onclick="openPanel(\'login\');return false;">Sign in</a>';
    return;
  }

  var res = await NeroAPI.post('/qris.php?action=donations&days=30', {});
  if(res && res.ok){
    gate.style.display = 'none';
    /* Clear the "Loading…" text, or the watchdog below keeps restarting the
       whole dashboard every 1.5s - re-rendering every table and wiping any
       inline Delete/Confirm step the GM has just opened. */
    msg.textContent = '';
    main.style.display = '';
    admRender(res.data);
    smLoad();
    gmLoad();
    admRestoreTab();
    return;
  }

  gate.style.display = '';
  main.style.display = 'none';
  /* 403 is the ordinary case (a player opened the link), not a fault. */
  msg.textContent = /admins only/i.test((res && res.error) || '')
    ? 'This page is for staff accounts only.'
    : qrisErrorText(res);
}

async function admLoad(){
  var qs = '?action=donations' +
           '&status=' + encodeURIComponent(document.getElementById('f-status').value) +
           '&source=' + encodeURIComponent(document.getElementById('f-source').value) +
           '&days='   + encodeURIComponent(document.getElementById('f-days').value);
  admMsg('');
  var res = await NeroAPI.post('/qris.php' + qs, {});
  if(!res || !res.ok) return admMsg(qrisErrorText(res), 'bad');
  admRender(res.data);
}

function admMsg(text, kind){
  var el = document.getElementById('adm-msg');
  if(!el) return;
  el.innerHTML = text
    ? '<p class="don-note ' + (kind === 'bad' ? 'bad' : '') + '">' + escHtml(text) + '</p>'
    : '';
}

/* --- rendering ---------------------------------------------------------- */

function admRender(d){
  ADM = d || {};
  admTiles(d.totals || {});
  admTable(d.rows || [], Number(d.ever_any || 0) === 0);
  admStreamers(d.streamers || []);
  admGuildStats(d.guilds || []);
  if(d.truncated) admMsg('Showing the newest ' + (d.filters && d.filters.limit) +
                         ' only — narrow the period to see the rest.');
}

function admTiles(t){
  /* Money in is PAID only. Counting an unpaid QR as income would overstate
     takings, so "waiting" is shown as its own tile rather than folded in. */
  var tiles = [
    {label: 'Received',        value: admRp(t.paid_rp),     sub: admPlural(t.paid_count, 'donation'), tone: 'gold'},
    {label: 'CP credited',     value: admNum(t.paid_cp),    sub: 'to ' + admPlural(t.paying_accounts, 'account')},
    {label: 'Waiting on you',  value: admNum(t.unconfirmed_count), sub: admRp(t.waiting_rp) + ' claimed', tone: (+t.unconfirmed_count > 0 ? 'warn' : '')},
    {label: 'QR not yet paid', value: admNum(t.pending_count), sub: 'automatic flow'}
  ];
  document.getElementById('adm-tiles').innerHTML = tiles.map(function(x){
    return '<div class="adm-tile ' + (x.tone || '') + '">' +
             '<div class="adm-tile-lbl">' + escHtml(x.label) + '</div>' +
             '<div class="adm-tile-val">' + x.value + '</div>' +
             '<div class="adm-tile-sub">' + x.sub + '</div>' +
           '</div>';
  }).join('');
}

function admTable(rows, neverAny){
  var tb = document.querySelector('#adm-tbl tbody');
  if(!rows.length){
    /* "No match" on a server that has never had a donation reads like a bug.
       Say which of the two it actually is. */
    var why = neverAny
      ? 'No donations yet. The first one will appear here as soon as a player donates.'
      : 'No donations match these filters.';
    tb.innerHTML = '<tr class="norow-row"><td class="norow" colspan="8">' + escHtml(why) + '</td></tr>';
    return;
  }
  tb.innerHTML = rows.map(function(r){
    var cp    = (+r.credit_cp || 0) + (+r.bonus_cp || 0) + (+r.guild_bonus_cp || 0);
    var who   = r.userid ? escHtml(r.userid) : ('account ' + escHtml(String(r.account_id)));
    var ref   = escHtml(r.partner_reference_no);
    var proof = r.proof_url
      ? ' <a class="adm-proof" href="' + escHtml(r.proof_url) + '" target="_blank" rel="noopener noreferrer">receipt</a>'
      : '';

    var action = '—';
    if(r.status === 'unconfirmed'){
      action = '<button class="adm-btn ok"  onclick="admAsk(\'' + ref + '\',\'confirm\')">Confirm</button>' +
               '<button class="adm-btn bad" onclick="admAsk(\'' + ref + '\',\'reject\')">Reject</button>';
    } else if(r.status === 'paid' && r.confirmed_by_userid){
      action = '<span class="adm-by">by ' + escHtml(r.confirmed_by_userid) + '</span>';
    }

    return '<tr>' +
      '<td>' + admWhen(r.created_at) + '</td>' +
      '<td>' + who + '<div class="adm-ref" title="' + ref + '">' + ref.slice(0, 8) + '…</div></td>' +
      '<td>' + (r.source === 'manual' ? 'Manual' : 'QRIS') + proof + '</td>' +
      '<td>' + admRp(r.amount_rp) + '</td>' +
      '<td>' + admNum(cp) + '</td>' +
      '<td>' + ([r.streamer_code, r.guild_name ? 'Guild: ' + r.guild_name : ''].filter(Boolean).map(escHtml).join('<br>') || '—') + '</td>' +
      '<td>' + admBadge(r.status) + '</td>' +
      '<td class="adm-act" id="act-' + ref + '">' + action + '</td>' +
    '</tr>';
  }).join('');
}

function admStreamers(list){
  var el = document.getElementById('adm-streamers');
  if(!list.length){
    el.innerHTML = '<h2 class="adm-h2"><i class="ti ti-chart-bar"></i> Referral performance</h2>' +
      '<p class="subtitle">No paid donations with a referral code in the period picked on the Donations tab.</p>';
    return;
  }
  el.innerHTML = '<h2 class="adm-h2"><i class="ti ti-chart-bar"></i> Referral performance</h2>' +
    '<p class="subtitle" style="margin:0 0 10px">Paid donations per code, for the period picked on the Donations tab.</p>' +
    '<div class="tbl-wrap"><table class="stat"><thead><tr>' +
    '<th>Code</th><th>Streamer</th><th>Paid donations</th><th>Total</th>' +
    '</tr></thead><tbody>' +
    list.map(function(s){
      var name = '—';
      for(var i = 0; i < STREAMERS.length; i++){
        if(STREAMERS[i].code === s.streamer_code){ name = STREAMERS[i].name; break; }
      }
      return '<tr><td>' + escHtml(s.streamer_code) + '</td><td>' + escHtml(name) +
             '</td><td>' + admNum(s.n) + '</td><td>' + admRp(s.rp) + '</td></tr>';
    }).join('') + '</tbody></table></div>';
}

/* --- actions ------------------------------------------------------------ */

/* Confirming credits CP and cannot be undone from this page, so it is a
   two-step action. The second step is drawn inline in the row rather than as a
   window.confirm(): a native dialog blocks the whole page, hides the receipt
   link the GM is meant to be checking, and would need a second prompt() for the
   note. Inline, the GM can still see the row they are acting on. */

function admAsk(ref, mode){
  var row  = admFind(ref);
  var cell = document.getElementById('act-' + ref);
  if(!row || !cell) return;

  var cp  = (+row.credit_cp || 0) + (+row.bonus_cp || 0) + (+row.guild_bonus_cp || 0);
  var who = row.userid || ('account ' + row.account_id);

  var question = mode === 'confirm'
    ? 'Credit <b>' + admNum(cp) + ' CP</b> to <b>' + escHtml(who) + '</b>?'
    : 'Reject this claim? No CP is credited.';
  var hint = mode === 'confirm' ? 'Ticket no. (optional)' : 'Reason (kept for the record)';
  var go   = mode === 'confirm'
    ? '<button class="adm-btn ok" onclick="admDo(\'' + ref + '\',\'confirm\')">Yes, credit</button>'
    : '<button class="adm-btn bad" onclick="admDo(\'' + ref + '\',\'reject\')">Yes, reject</button>';

  cell.innerHTML =
    '<div class="adm-ask">' +
      '<div class="adm-ask-q">' + question + '</div>' +
      '<input class="adm-note" id="note-' + ref + '" maxlength="255" placeholder="' + hint + '">' +
      go +
      '<button class="adm-btn" onclick="admTable(ADM.rows, Number(ADM.ever_any||0)===0)">Cancel</button>' +
    '</div>';

  var input = document.getElementById('note-' + ref);
  if(input) input.focus();
}

async function admDo(ref, mode){
  var row  = admFind(ref);
  var cp   = row ? (+row.credit_cp || 0) + (+row.bonus_cp || 0) + (+row.guild_bonus_cp || 0) : 0;
  var who  = (row && row.userid) || ('account ' + (row && row.account_id));
  var el   = document.getElementById('note-' + ref);
  var note = el ? el.value : '';

  var cell = document.getElementById('act-' + ref);
  if(cell) cell.innerHTML = '<span class="adm-by">Working...</span>';

  var res = await NeroAPI.post('/qris.php', {action: mode, ref: ref, note: note});
  if(!res || !res.ok){
    await admLoad();
    return admMsg(qrisErrorText(res), 'bad');
  }
  /* Reload FIRST. admLoad() clears the message area on the way in, so setting
     the outcome before it means the GM never sees whether the CP landed. */
  await admLoad();
  admMsg(mode === 'confirm'
    ? ((res.data && res.data.credited)
        ? 'Credited ' + admNum(cp) + ' CP to ' + who + '.'
        : 'Already credited - nothing was added twice.')
    : 'Claim rejected. No CP was credited.');
}

function admFind(ref){
  var rows = ADM.rows || [];
  for(var i = 0; i < rows.length; i++) if(rows[i].partner_reference_no === ref) return rows[i];
  return null;
}

/* Start the dashboard. Guarded so the several things that may ask for it (DOM
   ready, the SPA router, sign-in, the watchdog below) never run two at once.
   It does not depend on anything new in app.js, so a browser still holding an
   older cached app.js starts it too. */
var admBusy = false;
function admStart(){
  if(admBusy || !document.getElementById('adm-gate')) return;
  admBusy = true;
  admInit().catch(function(e){
    try{ console.error('[admin-donations]', e); }catch(_){}
    var msg = document.getElementById('adm-gate-msg');
    if(msg) msg.textContent = 'Could not load the dashboard. Check your connection and try again.';
  }).then(function(){ admBusy = false; });
}

if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', admStart);
else admStart();

/* Watchdog: if the page is ever showing the untouched "Loading…" gate with
   nothing in flight — however it got there — start it. */
setInterval(function(){
  var gate = document.getElementById('adm-gate');
  var msg  = document.getElementById('adm-gate-msg');
  if(gate && gate.style.display !== 'none' && msg && msg.textContent === 'Loading…' && !admBusy) admStart();
}, 1500);


/* --- GM: manage streamers (qris.php streamers / streamer_save) ---------- */

var smRows = [];

async function smLoad(){
  var tb = document.querySelector('#sm-tbl tbody');
  var res = await NeroAPI.post('/qris.php?action=streamers', {});
  if(!res || !res.ok){
    tb.innerHTML = '<tr><td class="norow" colspan="5">' + escHtml(qrisErrorText(res)) + '</td></tr>';
    return;
  }
  smRows = res.data.streamers || [];
  tb.innerHTML = smRows.length ? smRows.map(function(s){
    return '<tr>' +
      '<td><b>' + escHtml(s.code) + '</b>' + (s.old_codes || []).map(function(o){
        return '<br><span class="adm-ref">was ' + escHtml(o.code) + ' · works until ' + escHtml(String(o.expires_at).slice(0, 10)) + '</span>';
      }).join('') + '</td>' +
      '<td>' + escHtml(s.name) + '</td>' +
      '<td>' + (s.account_id ? escHtml(String(s.account_id)) + (s.userid ? ' <span class="adm-ref">' + escHtml(s.userid) + '</span>' : '') : '<span class="adm-ref">not linked</span>') + '</td>' +
      '<td>' + (s.active ? '<span class="adm-badge ok">Active</span>' : '<span class="adm-badge muted">Inactive</span>') + '</td>' +
      '<td id="sm-act-' + s.id + '">' + smButtons(s) + '</td>' +
    '</tr>';
  }).join('') : '<tr><td class="norow" colspan="5">No streamers yet. Register one above.</td></tr>';
}

function smButtons(s){
  return '<button class="btn-ghost sm-row-btn" onclick="smEdit(' + s.id + ')"><i class="ti ti-pencil"></i> Edit</button>' +
    '<button class="btn-ghost sm-row-btn" onclick="smToggle(' + s.id + ')">' + (s.active ? 'Deactivate' : 'Activate') + '</button>' +
    '<button class="btn-ghost sm-row-btn" onclick="smAskDelete(' + s.id + ')"><i class="ti ti-trash"></i> Delete</button>';
}

/* Deleting cannot be undone from this page, so it is two-step and drawn inline
   in the row - same reasoning as admAsk() above. */
function smAskDelete(id){
  var s = smFind(id);
  var cell = document.getElementById('sm-act-' + id);
  if(!s || !cell) return;
  cell.innerHTML =
    '<div class="adm-ask">' +
      '<div class="adm-ask-q">Delete <b>' + escHtml(s.name) + '</b> (code <b>' + escHtml(s.code) + '</b>)? ' +
        'The code stops working at once. Past donations keep their record.</div>' +
      '<button class="adm-btn bad" onclick="smDelete(' + id + ')">Yes, delete</button>' +
      '<button class="adm-btn" onclick="smCancelDelete(' + id + ')">Cancel</button>' +
    '</div>';
}

function smCancelDelete(id){
  var s = smFind(id);
  var cell = document.getElementById('sm-act-' + id);
  if(s && cell) cell.innerHTML = smButtons(s);
}

async function smDelete(id){
  var cell = document.getElementById('sm-act-' + id);
  if(cell) cell.innerHTML = '<span class="adm-by">Working...</span>';
  var res = await NeroAPI.post('/qris.php', {action: 'streamer_delete', id: id});
  if(!res || !res.ok){
    /* Show the failure IN the row that was clicked - reloading the table would
       wipe it and look like the button did nothing. */
    var s = smFind(id);
    if(cell) cell.innerHTML = '<span class="adm-by" style="color:#f0a3a3">Delete failed: ' +
      escHtml(qrisErrorText(res)) + '</span><br>' + (s ? smButtons(s) : '');
    return;
  }
  await smLoad();
  if(Number(document.getElementById('sm-id').value) === id) smReset();
  smMsg(res.data.name + ' (code ' + res.data.code + ') deleted.', true);
}

function smMsg(text, ok){
  var el = document.getElementById('sm-msg');
  el.innerHTML = text ? '<p class="hintline" style="color:' + (ok ? '#8ce0b4' : '#f0a3a3') + '">' + escHtml(text) + '</p>' : '';
}

function smReset(){
  ['sm-id', 'sm-aid', 'sm-name', 'sm-code'].forEach(function(id){ document.getElementById(id).value = ''; });
  document.getElementById('sm-active').value = '1';
  document.getElementById('sm-save').innerHTML = '<i class="ti ti-user-plus"></i> Register streamer';
  document.getElementById('sm-cancel').style.display = 'none';
}

function smFind(id){
  for(var i = 0; i < smRows.length; i++) if(smRows[i].id === id) return smRows[i];
  return null;
}

function smEdit(id){
  var s = smFind(id); if(!s) return;
  document.getElementById('sm-id').value = s.id;
  document.getElementById('sm-aid').value = s.account_id || '';
  document.getElementById('sm-name').value = s.name;
  document.getElementById('sm-code').value = s.code;
  document.getElementById('sm-active').value = s.active ? '1' : '0';
  document.getElementById('sm-save').innerHTML = '<i class="ti ti-device-floppy"></i> Save changes';
  document.getElementById('sm-cancel').style.display = '';
  smMsg('', true);
  document.getElementById('sm-aid').focus();
}

async function smSend(payload, btn){
  if(btn) btn.disabled = true;
  var res = await NeroAPI.post('/qris.php', Object.assign({action: 'streamer_save'}, payload));
  if(btn) btn.disabled = false;
  if(!res || !res.ok){ smMsg((res && res.error) || 'Could not save the streamer.', false); return false; }
  var d = res.data;
  smMsg(d.name + ' (code ' + d.code + ') saved' +
        (d.account_id ? ' — linked to account ' + d.account_id + (d.userid ? ' (' + d.userid + ')' : '') : '') +
        (d.active ? '.' : ', inactive.') +
        (d.history_moved ? ' ' + d.history_moved + ' past donation(s) moved to the new code.' : '') +
        (d.old_code ? (d.old_code_days
          ? ' Old code ' + d.old_code + ' keeps working for ' + d.old_code_days + ' days — tell the streamer to switch.'
          : ' Old code ' + d.old_code + ' stopped working.') : ''), true);
  await smLoad();
  return true;
}

async function smSave(){
  var payload = {
    id:         Number(document.getElementById('sm-id').value) || 0,
    account_id: document.getElementById('sm-aid').value.trim(),
    name:       document.getElementById('sm-name').value.trim(),
    code:       document.getElementById('sm-code').value.trim(),
    active:     document.getElementById('sm-active').value === '1'
  };
  if(await smSend(payload, document.getElementById('sm-save'))) smReset();
}

async function smToggle(id){
  var s = smFind(id); if(!s) return;
  await smSend({id: s.id, account_id: s.account_id ? String(s.account_id) : '', name: s.name, code: s.code, active: !s.active});
}


/* --- tabs (same look as the WoE page) ----------------------------------- */

function admTab(name, btn){
  document.querySelectorAll('#adm-main .atab').forEach(function(b){ b.classList.toggle('on', b === btn); });
  document.querySelectorAll('#adm-main .atab-panel').forEach(function(p){ p.classList.remove('show'); });
  var el = document.getElementById('adm-tab-' + name);
  if(el) el.classList.add('show');
  try{ sessionStorage.setItem('nero_adm_tab', name); }catch(e){}
}

function admRestoreTab(){
  var want = null;
  try{ want = sessionStorage.getItem('nero_adm_tab'); }catch(e){}
  var btn = want && document.querySelector('#adm-main .atab[data-t="' + want + '"]');
  if(btn) admTab(want, btn);
}


/* --- GM: manage guild referrals (qris.php guilds / guild_save / guild_delete) ---
   A guild is registered by its LEADER's game account (account ID or login
   name, e.g. dev_1); the bridge finds the guild whose master character is on
   that account. Donors pick it on the donation page ("Guild royalty"). The
   pick gives NO bonus CP (owner, 2026-09-19); it only records which guild the
   donation supports, and GMs hand out guild rewards by hand from that count.
   The leader account gets a Guild Referral tab on My Account. */

var gmRows = [];

async function gmLoad(){
  var tb = document.querySelector('#gm-tbl tbody');
  if(!tb) return;
  var res = await NeroAPI.post('/qris.php?action=guilds', {});
  if(!res || !res.ok){
    tb.innerHTML = '<tr><td class="norow" colspan="5">' + escHtml(qrisErrorText(res)) + '</td></tr>';
    return;
  }
  gmRows = res.data.guilds || [];
  tb.innerHTML = gmRows.length ? gmRows.map(function(g){
    var ingame = g.guild_name
      ? (g.guild_name !== g.name ? '<br><span class="adm-ref">in game: ' + escHtml(g.guild_name) + '</span>' : '')
      : '<br><span class="adm-ref">guild no longer exists</span>';
    return '<tr>' +
      '<td><b>' + escHtml(g.name) + '</b>' + ingame + '</td>' +
      '<td>' + escHtml(String(g.account_id)) + (g.userid ? ' <span class="adm-ref">' + escHtml(g.userid) + '</span>' : '') + '</td>' +
      '<td>' + (g.guild_id ? escHtml(String(g.guild_id)) : '—') + '</td>' +
      '<td>' + (g.active ? '<span class="adm-badge ok">Active</span>' : '<span class="adm-badge muted">Inactive</span>') + '</td>' +
      '<td id="gm-act-' + g.id + '">' + gmButtons(g) + '</td>' +
    '</tr>';
  }).join('') : '<tr><td class="norow" colspan="5">No guilds yet. Register one above.</td></tr>';
}

function gmButtons(g){
  return '<button class="btn-ghost sm-row-btn" onclick="gmEdit(' + g.id + ')"><i class="ti ti-pencil"></i> Edit</button>' +
    '<button class="btn-ghost sm-row-btn" onclick="gmToggle(' + g.id + ')">' + (g.active ? 'Deactivate' : 'Activate') + '</button>' +
    '<button class="btn-ghost sm-row-btn" onclick="gmAskDelete(' + g.id + ')"><i class="ti ti-trash"></i> Delete</button>';
}

function gmFind(id){
  for(var i = 0; i < gmRows.length; i++) if(gmRows[i].id === id) return gmRows[i];
  return null;
}

function gmMsg(text, ok){
  var el = document.getElementById('gm-msg');
  el.innerHTML = text ? '<p class="hintline" style="color:' + (ok ? '#8ce0b4' : '#f0a3a3') + '">' + escHtml(text) + '</p>' : '';
}

function gmReset(){
  ['gm-id', 'gm-leader', 'gm-name'].forEach(function(id){ document.getElementById(id).value = ''; });
  document.getElementById('gm-active').value = '1';
  document.getElementById('gm-save').innerHTML = '<i class="ti ti-shield-plus"></i> Register guild';
  document.getElementById('gm-cancel').style.display = 'none';
}

function gmEdit(id){
  var g = gmFind(id); if(!g) return;
  document.getElementById('gm-id').value = g.id;
  document.getElementById('gm-leader').value = g.userid || g.account_id;
  document.getElementById('gm-name').value = g.name;
  document.getElementById('gm-active').value = g.active ? '1' : '0';
  document.getElementById('gm-save').innerHTML = '<i class="ti ti-device-floppy"></i> Save changes';
  document.getElementById('gm-cancel').style.display = '';
  gmMsg('', true);
  document.getElementById('gm-leader').focus();
}

async function gmSend(payload, btn){
  if(btn) btn.disabled = true;
  var res = await NeroAPI.post('/qris.php', Object.assign({action: 'guild_save'}, payload));
  if(btn) btn.disabled = false;
  if(!res || !res.ok){ gmMsg((res && res.error) || 'Could not save the guild.', false); return false; }
  var d = res.data;
  gmMsg(d.name + ' saved — guild ' + d.guild_name + ' (master ' + d.master + '), leader account ' +
        d.account_id + (d.userid ? ' (' + d.userid + ')' : '') + (d.active ? '.' : ', inactive.'), true);
  await gmLoad();
  return true;
}

async function gmSave(){
  var payload = {
    id:     Number(document.getElementById('gm-id').value) || 0,
    leader: document.getElementById('gm-leader').value.trim(),
    name:   document.getElementById('gm-name').value.trim(),
    active: document.getElementById('gm-active').value === '1'
  };
  if(await gmSend(payload, document.getElementById('gm-save'))) gmReset();
}

async function gmToggle(id){
  var g = gmFind(id); if(!g) return;
  await gmSend({id: g.id, leader: String(g.account_id), name: g.name, active: !g.active});
}

/* Two-step, inline in the row - same reasoning as admAsk(). */
function gmAskDelete(id){
  var g = gmFind(id);
  var cell = document.getElementById('gm-act-' + id);
  if(!g || !cell) return;
  cell.innerHTML =
    '<div class="adm-ask">' +
      '<div class="adm-ask-q">Delete guild <b>' + escHtml(g.name) + '</b>? Donors can no longer pick it. ' +
        'Past donations keep their record.</div>' +
      '<button class="adm-btn bad" onclick="gmDelete(' + id + ')">Yes, delete</button>' +
      '<button class="adm-btn" onclick="gmCancelDelete(' + id + ')">Cancel</button>' +
    '</div>';
}

function gmCancelDelete(id){
  var g = gmFind(id);
  var cell = document.getElementById('gm-act-' + id);
  if(g && cell) cell.innerHTML = gmButtons(g);
}

async function gmDelete(id){
  var cell = document.getElementById('gm-act-' + id);
  if(cell) cell.innerHTML = '<span class="adm-by">Working...</span>';
  var res = await NeroAPI.post('/qris.php', {action: 'guild_delete', id: id});
  if(!res || !res.ok){
    var g = gmFind(id);
    if(cell) cell.innerHTML = '<span class="adm-by" style="color:#f0a3a3">Delete failed: ' +
      escHtml(qrisErrorText(res)) + '</span><br>' + (g ? gmButtons(g) : '');
    return;
  }
  await gmLoad();
  if(Number(document.getElementById('gm-id').value) === id) gmReset();
  gmMsg(res.data.name + ' deleted.', true);
}

/* Paid donations per guild for the period picked on the Donations tab. */
function admGuildStats(list){
  var el = document.getElementById('adm-guilds');
  if(!el) return;
  el.innerHTML = '<h2 class="adm-h2"><i class="ti ti-chart-bar"></i> Guild referral performance</h2>' +
    (list.length
      ? '<p class="subtitle" style="margin:0 0 10px">Paid donations per guild, for the period picked on the Donations tab.</p>' +
        '<div class="tbl-wrap"><table class="stat"><thead><tr><th>Guild</th><th>Paid donations</th><th>Total</th></tr></thead><tbody>' +
        list.map(function(g){
          return '<tr><td>' + escHtml(g.guild_name || ('#' + g.guild_ref_id)) + '</td><td>' + admNum(g.n) +
                 '</td><td>' + admRp(g.rp) + '</td></tr>';
        }).join('') + '</tbody></table></div>'
      : '<p class="subtitle">No paid donations with a guild picked in the period picked on the Donations tab.</p>');
}
