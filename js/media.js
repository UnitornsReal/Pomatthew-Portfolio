(function () {
  'use strict';

  var list = ((window.CONFIG && CONFIG.videos) || []).filter(function (v) { return v && !v.hide; });

  function ytId(raw) {
    var s = String(raw || '').trim();
    var m = s.match(/(?:youtu\.be\/|\/embed\/|\/shorts\/|\/live\/|[?&]v=)([A-Za-z0-9_-]{11})/);
    if (m) return m[1];
    m = s.match(/^[A-Za-z0-9_-]{11}(?![A-Za-z0-9_-])/);
    return m ? m[0] : s.split(/[?&#]/)[0];
  }

  list.forEach(function (v) {
    if (v.kind === 'youtube' && v.id) v.id = ytId(v.id);
  });
  var grid = document.getElementById('reel-grid');
  var count = document.getElementById('projects-count');
  if (!grid) return;

  var PLAY = '<svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true">' +
             '<path d="M8.5 5.5v13l10.5-6.5z" fill="currentColor"/></svg>';

  function clock(s) {
    s = Math.floor(s || 0);
    var m = Math.floor(s / 60), x = s % 60;
    return m + ':' + String(x).padStart(2, '0');
  }

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  function grabFrame(src, onDone) {
    var v = document.createElement('video');
    v.preload = 'metadata';
    v.muted = true;
    v.playsInline = true;
    v.src = src;

    var done = false;
    var reached = false;
    var seen = 0;

    function bail(why, dur) { if (!done) { done = true; onDone(null, dur || 0, why); } }

    v.addEventListener('error', function () { bail('missing', 0); }, { once: true });
    setTimeout(function () { bail(reached ? 'slow' : 'missing', seen); }, 6000);

    v.addEventListener('loadedmetadata', function () {
      reached = true;
      var dur = isFinite(v.duration) ? v.duration : 0;
      seen = dur;
      v.currentTime = Math.min(Math.max(1, dur * 0.12), Math.max(0.1, dur - 0.1));

      v.addEventListener('seeked', function () {
        if (done) return;
        done = true;
        try {
          var c = document.createElement('canvas');
          c.width = v.videoWidth || 640;
          c.height = v.videoHeight || 360;
          c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
          onDone(c.toDataURL('image/jpeg', 0.72), dur, null);
        } catch (e) {
          onDone(null, dur, 'blocked');
        }
      }, { once: true });
    }, { once: true });
  }

  function showMissing(thumb, msg) {
    if (thumb.querySelector('.vid-missing')) return;
    thumb.appendChild(el('span', 'vid-missing', msg));
  }

  function makeCard(item, i) {
    var b = el('button', 'vid reveal');
    b.type = 'button';
    b.style.setProperty('--d', (i % 3) * 80 + 'ms');

    var thumb = el('div', 'vid-thumb');
    thumb.appendChild(el('span', 'vid-kind', item.kind === 'youtube' ? 'YouTube' : 'Video'));
    thumb.appendChild(el('span', 'vid-play', PLAY));
    b.appendChild(thumb);

    var body = el('div', 'vid-body');
    body.appendChild(el('h3', null, item.title || 'Untitled'));
    if (item.tags && item.tags.length) {
      var tw = el('div', 'vid-tags');
      item.tags.forEach(function (t) { tw.appendChild(el('b', null, t)); });
      body.appendChild(tw);
    }
    b.appendChild(body);

    function tryFrame() {
      grabFrame(item.src, function (dataUrl, dur, why) {
        if (dataUrl) {
          var f = new Image();
          f.src = dataUrl; f.alt = '';
          thumb.insertBefore(f, thumb.firstChild);
        } else if (why === 'missing') {
          showMissing(thumb, 'file not found');
        } else {
          showMissing(thumb, 'preview unavailable');
        }
        if (dur && why !== 'missing') {
          thumb.appendChild(el('span', 'vid-kind vid-dur', clock(dur)));
        }
      });
    }

    if (item.kind === 'youtube' && item.id) {
      var SIZES = ['maxresdefault', 'hqdefault', 'mqdefault'];
      var at = 0;
      var img = new Image();
      img.loading = 'lazy';
      img.decoding = 'async';
      img.alt = '';

      function nextThumb() {
        at++;
        if (at >= SIZES.length) {
          img.remove();
          showMissing(thumb, 'no thumbnail');
          return;
        }
        img.src = 'https://img.youtube.com/vi/' + encodeURIComponent(item.id) + '/' + SIZES[at] + '.jpg';
      }

      img.addEventListener('error', nextThumb);
      img.addEventListener('load', function () {
        if (img.naturalWidth <= 130) nextThumb();
      });
      img.src = 'https://img.youtube.com/vi/' + encodeURIComponent(item.id) + '/' + SIZES[0] + '.jpg';
      thumb.insertBefore(img, thumb.firstChild);

    } else if (item.kind === 'file' && item.src) {
      if (item.poster) {
        var p = new Image();
        p.src = item.poster; p.alt = ''; p.loading = 'lazy';
        p.addEventListener('error', function () { p.remove(); tryFrame(); });
        thumb.insertBefore(p, thumb.firstChild);
      } else {
        tryFrame();
      }
    } else {
      showMissing(thumb, 'nothing configured');
    }

    b.addEventListener('click', function () { Player.open(item); });
    return b;
  }

  if (!list.length) {
    grid.appendChild(el('p', 'reel-empty', 'No clips up yet.'));
  } else {
    list.forEach(function (item, i) { grid.appendChild(makeCard(item, i)); });
  }

  if (count) count.textContent = list.length + (list.length === 1 ? ' clip' : ' clips');
})();
