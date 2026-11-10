(function () {
  'use strict';

  var list = ((window.CONFIG && CONFIG.videos) || []).filter(function (v) { return v && !v.hide; });
  var box = document.getElementById('clips');
  if (!box) return;

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

  function grabFrame(src, done) {
    var v = document.createElement('video');
    v.preload = 'metadata';
    v.muted = true;
    v.playsInline = true;
    v.src = src;
    var over = false;
    function finish(url) { if (!over) { over = true; done(url); } }
    v.addEventListener('error', function () { finish(null); }, { once: true });
    setTimeout(function () { finish(null); }, 6000);
    v.addEventListener('loadedmetadata', function () {
      var dur = isFinite(v.duration) ? v.duration : 0;
      v.currentTime = Math.min(Math.max(1, dur * 0.12), Math.max(0.1, dur - 0.1));
      v.addEventListener('seeked', function () {
        try {
          var c = document.createElement('canvas');
          c.width = v.videoWidth || 640;
          c.height = v.videoHeight || 360;
          c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
          finish(c.toDataURL('image/jpeg', 0.72));
        } catch (e) {
          finish(null);
        }
      }, { once: true });
    }, { once: true });
  }

  function thumbFor(item, img) {
    if (item.kind === 'youtube' && item.id) {
      var sizes = ['maxresdefault', 'hqdefault', 'mqdefault'];
      var at = 0;
      img.addEventListener('error', next);
      img.addEventListener('load', function () { if (img.naturalWidth <= 130) next(); });
      img.src = 'https://img.youtube.com/vi/' + encodeURIComponent(item.id) + '/' + sizes[0] + '.jpg';
      function next() {
        at++;
        if (at < sizes.length) img.src = 'https://img.youtube.com/vi/' + encodeURIComponent(item.id) + '/' + sizes[at] + '.jpg';
      }
      return;
    }
    if (item.kind === 'file' && item.src) {
      if (item.poster) {
        img.addEventListener('error', function () { grabFrame(item.src, function (u) { if (u) img.src = u; }); }, { once: true });
        img.src = item.poster;
        return;
      }
      grabFrame(item.src, function (u) { if (u) img.src = u; });
    }
  }

  list.forEach(function (item) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'clip';
    b.innerHTML = '<div class="shot"><img alt="" loading="lazy" decoding="async"></div><h3></h3><p></p>';
    b.querySelector('h3').textContent = item.title || 'Untitled';
    b.querySelector('p').textContent = item.desc || '';
    thumbFor(item, b.querySelector('img'));
    b.addEventListener('click', function () { Player.open(item); });
    box.appendChild(b);
  });

  if (!list.length) document.getElementById('projects').hidden = true;
})();
