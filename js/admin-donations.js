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
    main.style.display = '';
    admRender(res.data);
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
    var cp    = (+r.credit_cp || 0) + (+r.bonus_cp || 0);
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
      '<td>' + (r.streamer_code ? escHtml(r.streamer_code) : '—') + '</td>' +
      '<td>' + admBadge(r.status) + '</td>' +
      '<td class="adm-act" id="act-' + ref + '">' + action + '</td>' +
    '</tr>';
  }).join('');
}

function admStreamers(list){
  var el = document.getElementById('adm-streamers');
  if(!list.length){ el.innerHTML = ''; return; }
  el.innerHTML = '<h2 class="adm-h2">Referral codes</h2>' +
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

  var cp  = (+row.credit_cp || 0) + (+row.bonus_cp || 0);
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
  var cp   = row ? (+row.credit_cp || 0) + (+row.bonus_cp || 0) : 0;
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

document.addEventListener('DOMContentLoaded', function(){
  /* Any unexpected throw must still leave a readable page rather than the
     stuck "Loading…" the markup starts with. */
  admInit().catch(function(e){
    try{ console.error('[admin-donations]', e); }catch(_){}
    var msg = document.getElementById('adm-gate-msg');
    if(msg) msg.textContent = 'Could not load the dashboard. Reload the page, or check the browser console.';
  });
});
