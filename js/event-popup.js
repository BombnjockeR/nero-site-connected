/* =====================================================================
   Event popup (homepage overlay)
   ---------------------------------------------------------------------
   Self-contained: injects its own styles and markup. To show it on a
   page, add ONE line before </body>:
       <script src="js/event-popup.js"></script>
   Edit TITLE / SLIDES below to change the content.
   Closes on: the X button, a click outside the box, or the Esc key.
   ===================================================================== */
(function () {
  var TITLE = 'October Event';

  // Asset paths are resolved relative to this script (js/ -> site root),
  // so the popup works from any page depth.
  var ROOT = (function () {
    var s = document.currentScript && document.currentScript.src;
    return s ? s.replace(/js\/event-popup\.js(\?.*)?$/, '') : '';
  })();

  var SLIDES = [
    { type: 'image', src: 'assets/event-oct-battlepass-s2.jpg', alt: 'Battle Pass Season 2' },
    { type: 'mvp', title: 'World Boss', items: [
      { src: 'assets/mvp/1373.gif', name: 'Lord of Death' },
      { src: 'assets/mvp/1685.gif', name: 'Vesper' }
    ] }
  ];

  var css = '' +
    '.evp-overlay{position:fixed;inset:0;z-index:200;display:flex;align-items:center;justify-content:center;padding:16px;' +
      'background:rgba(4,7,13,.5);opacity:0;transition:opacity .22s ease}' +
    '.evp-overlay.on{opacity:1}' +
    '.evp-box{position:relative;width:min(920px,100%);max-height:calc(100vh - 32px);display:flex;flex-direction:column;' +
      'background:transparent;border:1px solid var(--line,rgba(228,184,75,.45));border-radius:16px;' +
      'box-shadow:0 24px 70px rgba(0,0,0,.6);overflow:hidden;transform:translateY(10px) scale(.98);transition:transform .22s ease}' +
    '.evp-overlay.on .evp-box{transform:none}' +
    '.evp-head{display:flex;align-items:center;justify-content:center;padding:14px 56px 12px;' +
      'border-bottom:1px solid rgba(228,184,75,.25);background:linear-gradient(180deg,#1d2230,#0d1522)}' +
    '.evp-title{margin:0;color:var(--gold,#E4B84B);font-size:22px;font-weight:800;letter-spacing:.6px;text-transform:uppercase}' +
    '.evp-close{position:absolute;top:9px;right:10px;width:38px;height:38px;border-radius:10px;border:1px solid rgba(255,255,255,.18);' +
      'background:rgba(255,255,255,.06);color:#e7ecf5;font-size:22px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:.15s;z-index:3}' +
    '.evp-close:hover{background:rgba(255,255,255,.14);color:#fff}' +
    '.evp-viewport{position:relative;overflow:hidden;background:transparent}' +
    '.evp-track{display:flex;transition:transform .38s ease}' +
    '.evp-slide{flex:0 0 100%;aspect-ratio:1446/1088;max-height:calc(100vh - 160px);display:flex;align-items:center;justify-content:center}' +
    '.evp-slide.evp-img{background:rgba(128,128,128,.5)}.evp-slide img.evp-full{opacity:.5;width:100%;height:100%;object-fit:contain;display:block;user-select:none;-webkit-user-drag:none}' +
    '.evp-mvp{width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;' +
      'background:rgba(128,128,128,.5)}' +
    '.evp-mvp-title{margin:0 0 4%;color:#fff;font-size:34px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;' +
      'text-shadow:0 3px 10px rgba(0,0,0,.75),0 0 18px rgba(228,184,75,.45)}' +
    '.evp-mvp-row{width:100%;height:62%;display:flex;align-items:flex-end;justify-content:center;gap:6%}' +
    '.evp-mvp figure{margin:0;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:12px}' +
    '.evp-mvp img{height:100%;width:auto;max-width:38vw;object-fit:contain;filter:drop-shadow(0 10px 18px rgba(0,0,0,.45))}' +
    '.evp-mvp figcaption{color:#fff;font-weight:700;font-size:15px;letter-spacing:.3px;text-shadow:0 2px 6px rgba(0,0,0,.7)}' +
    '.evp-nav{position:absolute;top:50%;transform:translateY(-50%);width:42px;height:42px;border-radius:50%;border:1px solid rgba(255,255,255,.25);' +
      'background:rgba(7,11,18,.62);color:#fff;font-size:22px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:.15s;z-index:2}' +
    '.evp-nav:hover{background:rgba(228,184,75,.85);color:#241a07}' +
    '.evp-prev{left:10px}.evp-next{right:10px}' +
    '.evp-dots{display:flex;justify-content:center;gap:8px;padding:11px 0 13px;background:#0d1522}' +
    '.evp-dot{width:9px;height:9px;border-radius:50%;border:none;padding:0;background:rgba(255,255,255,.28);cursor:pointer;transition:.15s}' +
    '.evp-dot.on{background:var(--gold,#E4B84B);width:22px;border-radius:5px}' +
    '@media (max-width:600px){.evp-title{font-size:18px}.evp-nav{width:34px;height:34px;font-size:18px}' +
      '.evp-mvp figcaption{font-size:12.5px}.evp-mvp-title{font-size:20px}.evp-head{padding:12px 50px 10px}}';

  function build() {
    var style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    var slidesHtml = SLIDES.map(function (s) {
      if (s.type === 'image') {
        return '<div class="evp-slide evp-img"><img class="evp-full" src="' + ROOT + s.src + '" alt="' + s.alt + '"></div>';
      }
      return '<div class="evp-slide"><div class="evp-mvp">' +
        (s.title ? '<h3 class="evp-mvp-title">' + s.title + '</h3>' : '') +
        '<div class="evp-mvp-row">' + s.items.map(function (m) {
          return '<figure><img src="' + ROOT + m.src + '" alt="' + m.name + '"><figcaption>' + m.name + '</figcaption></figure>';
        }).join('') + '</div></div></div>';
    }).join('');

    var dotsHtml = SLIDES.map(function (_, i) {
      return '<button class="evp-dot" type="button" aria-label="Slide ' + (i + 1) + '" data-i="' + i + '"></button>';
    }).join('');

    var ov = document.createElement('div');
    ov.className = 'evp-overlay';
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-modal', 'true');
    ov.setAttribute('aria-label', TITLE);
    ov.innerHTML =
      '<div class="evp-box">' +
        '<button class="evp-close" type="button" aria-label="Close">&times;</button>' +
        '<div class="evp-head"><h2 class="evp-title">' + TITLE + '</h2></div>' +
        '<div class="evp-viewport">' +
          '<div class="evp-track">' + slidesHtml + '</div>' +
          (SLIDES.length > 1 ? '<button class="evp-nav evp-prev" type="button" aria-label="Previous">&#8249;</button>' +
                               '<button class="evp-nav evp-next" type="button" aria-label="Next">&#8250;</button>' : '') +
        '</div>' +
        (SLIDES.length > 1 ? '<div class="evp-dots">' + dotsHtml + '</div>' : '') +
      '</div>';
    document.body.appendChild(ov);

    var box = ov.querySelector('.evp-box');
    var track = ov.querySelector('.evp-track');
    var dots = ov.querySelectorAll('.evp-dot');
    var cur = 0;

    function go(i) {
      cur = (i + SLIDES.length) % SLIDES.length;
      track.style.transform = 'translateX(' + (-100 * cur) + '%)';
      for (var d = 0; d < dots.length; d++) dots[d].classList.toggle('on', d === cur);
    }
    function close() {
      ov.classList.remove('on');
      document.removeEventListener('keydown', onKey);
      setTimeout(function () { if (ov.parentNode) ov.parentNode.removeChild(ov); }, 230);
    }
    function onKey(e) {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight') go(cur + 1);
      else if (e.key === 'ArrowLeft') go(cur - 1);
    }

    ov.querySelector('.evp-close').addEventListener('click', close);
    // Click outside the box closes it.
    ov.addEventListener('click', function (e) { if (!box.contains(e.target)) close(); });
    var prev = ov.querySelector('.evp-prev'), next = ov.querySelector('.evp-next');
    if (prev) prev.addEventListener('click', function () { go(cur - 1); });
    if (next) next.addEventListener('click', function () { go(cur + 1); });
    for (var d = 0; d < dots.length; d++) dots[d].addEventListener('click', function () { go(+this.getAttribute('data-i')); });
    document.addEventListener('keydown', onKey);

    // Swipe on touch screens.
    var x0 = null;
    track.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    track.addEventListener('touchend', function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0; x0 = null;
      if (Math.abs(dx) > 40) go(cur + (dx < 0 ? 1 : -1));
    });

    go(0);
    requestAnimationFrame(function () { ov.classList.add('on'); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();
