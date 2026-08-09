window.Player = (function () {
  'use strict';

  var root = document.getElementById('player');
  if (!root) return { open: function () {} };

  var stage = document.getElementById('player-stage');
  var video = document.getElementById('html5');
  var ytmount = document.getElementById('ytmount');
  var spinner = document.getElementById('player-spinner');
  var bigplay = document.getElementById('bigplay');
  var playerUI = document.getElementById('player-ui');
  var meta = root.querySelector('.player-meta');

  var scrub = document.getElementById('scrub');
  var sFill = document.getElementById('scrub-fill');
  var sBuf = document.getElementById('scrub-buf');
  var sTip = document.getElementById('scrub-tip');

  var btnPlay = document.getElementById('btn-play');
  var btnBack = document.getElementById('btn-back');
  var btnFwd = document.getElementById('btn-fwd');
  var btnMute = document.getElementById('btn-mute');
  var btnPip = document.getElementById('btn-pip');
  var btnFull = document.getElementById('btn-full');
  var btnSpd = document.getElementById('btn-speed');
  var spdLbl = document.getElementById('speed-label');
  var spdMenu = document.getElementById('speed-menu');
  var vol = document.getElementById('vol');

  var tNow = document.getElementById('t-now');
  var tEnd = document.getElementById('t-end');
  var pTitle = document.getElementById('player-title');
  var pDesc = document.getElementById('player-desc');
  var flashB = document.getElementById('flash-back');
  var flashF = document.getElementById('flash-fwd');

  var OFFLINE_ORIGIN = location.protocol !== 'http:' && location.protocol !== 'https:';

  var back = null;
  var raf = null;
  var open = false;
  var scrubbing = false;
  var lastVol = 1;

  var hit = document.createElement('div');
  hit.className = 'player-hit';
  stage.insertBefore(hit, spinner);

  function clock(s) {
    s = Math.max(0, Math.floor(s || 0));
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
    return h
      ? h + ':' + String(m).padStart(2, '0') + ':' + String(x).padStart(2, '0')
      : m + ':' + String(x).padStart(2, '0');
  }

  function flash(node, text) {
    if (text) node.textContent = text;
    node.classList.remove('show');
    void node.offsetWidth;
    node.classList.add('show');
  }

  function Html5(item) {
    this.kind = 'file';
    this.rates = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4];
    video.hidden = false;
    ytmount.hidden = true;
    video.src = item.src;
    if (item.poster) video.poster = item.poster;
    video.load();
  }
  Html5.prototype.ready = function (cb) {
    if (video.readyState >= 1) cb();
    else video.addEventListener('loadedmetadata', cb, { once: true });
  };
  Html5.prototype.play     = function () { var p = video.play(); if (p) p.catch(function () {}); };
  Html5.prototype.pause    = function () { video.pause(); };
  Html5.prototype.playing  = function () { return !video.paused && !video.ended; };
  Html5.prototype.time     = function () { return video.currentTime || 0; };
  Html5.prototype.duration = function () { return isFinite(video.duration) ? video.duration : 0; };
  Html5.prototype.seek     = function (t) { video.currentTime = t; };
  Html5.prototype.rate     = function (r) { if (r == null) return video.playbackRate; video.playbackRate = r; };
  Html5.prototype.volume   = function (v) { if (v == null) return video.volume; video.volume = v; };
  Html5.prototype.muted    = function (m) { if (m == null) return video.muted; video.muted = m; };
  Html5.prototype.buffered = function () {
    var d = this.duration();
    if (!d || !video.buffered.length) return 0;
    return video.buffered.end(video.buffered.length - 1) / d;
  };
  Html5.prototype.stalled = function () { return video.readyState < 3 && !video.paused; };
  Html5.prototype.destroy = function () {
    video.pause();
    video.removeAttribute('src');
    video.removeAttribute('poster');
    video.load();
    video.hidden = true;
  };

  var ytApi = null;
  function loadYT() {
    if (window.YT && window.YT.Player) return Promise.resolve();
    if (ytApi) return ytApi;
    ytApi = new Promise(function (res, rej) {
      var prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = function () { if (prev) prev(); res(); };
      var s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api';
      function drop(why) {
        ytApi = null;
        if (s.parentNode) s.parentNode.removeChild(s);
        rej(new Error(why));
      }
      s.onerror = function () { drop('blocked'); };
      document.head.appendChild(s);
      setTimeout(function () {
        if (!(window.YT && window.YT.Player)) drop('timeout');
      }, 4500);
    });
    return ytApi;
  }

  function Yt(item) {
    this.kind = 'youtube';
    this.rates = [0.25, 0.5, 1, 1.5, 2];
    this.p = null;
    this.ok = false;
    this.plainMode = false;
    this.state = -1;
    this.item = item;
    video.hidden = true;
    ytmount.hidden = false;
    ytmount.innerHTML = '<div id="yt-target"></div>';
  }

  function quiet() {
    spinner.hidden = true;
    bigplay.hidden = true;
    hit.classList.add('off');
    playerUI.classList.add('off');
    var keys = meta.querySelector('.player-keys');
    if (keys) keys.hidden = true;
  }

  Yt.prototype.plain = function (why) {
    if (this.plainMode) return;
    this.plainMode = true;
    this.ok = false;

    try { if (this.p && this.p.destroy) this.p.destroy(); } catch (e) {}
    this.p = null;

    ytmount.innerHTML = '';

    var frame = document.createElement('iframe');
    frame.src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(this.item.id) +
                '?rel=0&modestbranding=1&playsinline=1&autoplay=1';
    frame.title = this.item.title || 'Video';
    frame.allow = 'autoplay; fullscreen; encrypted-media; picture-in-picture';
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    frame.allowFullscreen = true;
    ytmount.appendChild(frame);

    quiet();
    addNote(why);
  };

  Yt.prototype.card = function (line) {
    if (this.plainMode) return;
    this.plainMode = true;
    this.ok = false;

    try { if (this.p && this.p.destroy) this.p.destroy(); } catch (e) {}
    this.p = null;

    ytmount.innerHTML = '';
    ytmount.hidden = false;

    var box = document.createElement('div');
    box.className = 'yt-card';

    var shade = document.createElement('img');
    shade.className = 'yt-card-bg';
    shade.alt = '';
    shade.src = 'https://img.youtube.com/vi/' + encodeURIComponent(this.item.id) + '/hqdefault.jpg';
    shade.addEventListener('error', function () { shade.remove(); });
    box.appendChild(shade);

    var inner = document.createElement('div');
    inner.className = 'yt-card-in';

    var head = document.createElement('strong');
    head.textContent = this.item.title || 'YouTube video';
    inner.appendChild(head);

    var note = document.createElement('p');
    note.textContent = line;
    inner.appendChild(note);

    var link = document.createElement('a');
    link.href = 'https://www.youtube.com/watch?v=' + encodeURIComponent(this.item.id);
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = 'Watch on YouTube';
    inner.appendChild(link);

    box.appendChild(inner);
    ytmount.appendChild(box);

    quiet();
  };

  Yt.prototype.ready = function (cb) {
    var self = this;

    if (OFFLINE_ORIGIN) {
      this.card('This page is open as a local file, and YouTube refuses to play inside one. ' +
                'Put the folder on a server (or run a local one) and it plays right here.');
      return;
    }

    loadYT().then(function () {
      self.p = new YT.Player('yt-target', {
        videoId: self.item.id,
        host: 'https://www.youtube-nocookie.com',
        playerVars: {
          controls: 0, modestbranding: 1, rel: 0, iv_load_policy: 3,
          playsinline: 1, disablekb: 1, fs: 0, enablejsapi: 1,
          origin: location.origin
        },
        events: {
          onReady: function () {
            self.ok = true;
            var r = self.p.getAvailablePlaybackRates && self.p.getAvailablePlaybackRates();
            if (r && r.length) self.rates = r;
            cb();
          },
          onStateChange: function (e) { self.state = e.data; syncPlayBtn(); },
          onError: function (e) {
            var code = e && e.data;
            if (code === 101 || code === 150) {
              self.card('The owner turned off embedding for this video, so it only plays on YouTube.');
            } else if (code === 2 || code === 100) {
              self.card('That video ID does not resolve. It may be private, deleted, or mistyped.');
            } else {
              self.card('YouTube would not start this one inside the page.');
            }
          }
        }
      });
    }).catch(function () {
      self.plain('Could not load the YouTube API. Using YouTube\'s own player instead.');
    });
  };

  Yt.prototype.play     = function () { if (this.ok) this.p.playVideo(); };
  Yt.prototype.pause    = function () { if (this.ok) this.p.pauseVideo(); };
  Yt.prototype.playing  = function () { return this.state === 1; };
  Yt.prototype.time     = function () { return this.ok ? this.p.getCurrentTime() || 0 : 0; };
  Yt.prototype.duration = function () { return this.ok ? this.p.getDuration() || 0 : 0; };
  Yt.prototype.seek     = function (t) { if (this.ok) this.p.seekTo(t, true); };
  Yt.prototype.rate = function (r) {
    if (!this.ok) return 1;
    if (r == null) return this.p.getPlaybackRate();
    this.p.setPlaybackRate(r);
  };
  Yt.prototype.volume = function (v) {
    if (!this.ok) return 1;
    if (v == null) return this.p.getVolume() / 100;
    this.p.setVolume(Math.round(v * 100));
  };
  Yt.prototype.muted = function (m) {
    if (!this.ok) return false;
    if (m == null) return this.p.isMuted();
    m ? this.p.mute() : this.p.unMute();
  };
  Yt.prototype.buffered = function () { return this.ok ? this.p.getVideoLoadedFraction() || 0 : 0; };
  Yt.prototype.stalled  = function () { return this.plainMode ? false : (!this.ok || this.state === 3); };
  Yt.prototype.destroy  = function () {
    this.ok = false;
    try { if (this.p && this.p.destroy) this.p.destroy(); } catch (e) {}
    this.p = null;
    ytmount.innerHTML = '';
    ytmount.hidden = true;
  };

  function addNote(text) {
    var old = meta.querySelector('.player-note');
    if (old) old.remove();
    var p = document.createElement('p');
    p.className = 'player-note';
    p.textContent = text;
    meta.appendChild(p);
  }

  function fail(msg, url) {
    spinner.hidden = true;
    bigplay.hidden = true;
    var box = document.createElement('div');
    box.className = 'player-fail';
    var t = document.createElement('span');
    t.textContent = msg;
    box.appendChild(t);
    if (url) {
      var a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = 'Watch on YouTube';
      box.appendChild(a);
    }
    stage.appendChild(box);
  }

  function syncPlayBtn() {
    var on = back && back.playing();
    root.classList.toggle('playing', !!on);
    if (!(back && back.plainMode)) bigplay.hidden = !!on;
  }

  function buildSpeedMenu() {
    spdMenu.innerHTML = '';
    var cur = back ? back.rate() : 1;
    back.rates.forEach(function (r) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = (r === 1 ? 'Normal' : r + '×');
      b.className = Math.abs(r - cur) < 0.001 ? 'on' : '';
      b.addEventListener('click', function () {
        setRate(r);
        spdMenu.hidden = true;
        btnSpd.setAttribute('aria-expanded', 'false');
      });
      spdMenu.appendChild(b);
    });
  }

  function setRate(r) {
    if (!back) return;
    back.rate(r);
    spdLbl.innerHTML = (r === 1 ? '1' : String(r)) + '&times;';
    buildSpeedMenu();
  }

  function stepRate(dir) {
    if (!back || back.plainMode) return;
    var list = back.rates;
    var cur = back.rate();
    var i = 0, best = 1e9;
    list.forEach(function (r, k) { var d = Math.abs(r - cur); if (d < best) { best = d; i = k; } });
    var next = Math.max(0, Math.min(list.length - 1, i + dir));
    setRate(list[next]);
    flash(dir > 0 ? flashF : flashB, list[next] + '×');
  }

  function skip(sec) {
    if (!back || back.plainMode) return;
    var d = back.duration();
    back.seek(Math.max(0, Math.min(d || 1e9, back.time() + sec)));
    flash(sec < 0 ? flashB : flashF, (sec < 0 ? '−' : '+') + Math.abs(sec) + 's');
  }

  function toggle() {
    if (!back || back.plainMode) return;
    back.playing() ? back.pause() : back.play();
    setTimeout(syncPlayBtn, 60);
  }

  function loop() {
    if (!open) return;
    if (back && !back.plainMode) {
      var d = back.duration(), t = back.time();
      var pct = d ? (t / d) * 100 : 0;

      if (!scrubbing) {
        sFill.style.width = pct.toFixed(3) + '%';
        scrub.setAttribute('aria-valuenow', Math.round(pct));
      }
      sBuf.style.width = (back.buffered() * 100).toFixed(2) + '%';
      tNow.textContent = clock(t);
      tEnd.textContent = clock(d);

      spinner.hidden = !back.stalled();
      syncPlayBtn();
    }
    raf = requestAnimationFrame(loop);
  }

  function ratioFrom(e) {
    var r = scrub.getBoundingClientRect();
    return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
  }

  scrub.addEventListener('pointerdown', function (e) {
    if (!back) return;
    scrubbing = true;
    scrub.setPointerCapture(e.pointerId);
    var p = ratioFrom(e);
    sFill.style.width = (p * 100) + '%';
    back.seek(p * back.duration());
  });
  scrub.addEventListener('pointermove', function (e) {
    if (!back) return;
    var p = ratioFrom(e);
    sTip.textContent = clock(p * back.duration());
    sTip.style.left = (p * 100) + '%';
    if (scrubbing) {
      sFill.style.width = (p * 100) + '%';
      back.seek(p * back.duration());
    }
  });
  ['pointerup', 'pointercancel'].forEach(function (ev) {
    scrub.addEventListener(ev, function (e) {
      if (!scrubbing) return;
      scrubbing = false;
      try { scrub.releasePointerCapture(e.pointerId); } catch (err) {}
    });
  });
  scrub.addEventListener('keydown', function (e) {
    if (!back) return;
    if (e.key === 'ArrowLeft')  { skip(-5); e.preventDefault(); }
    if (e.key === 'ArrowRight') { skip(5);  e.preventDefault(); }
  });

  btnPlay.addEventListener('click', toggle);
  bigplay.addEventListener('click', toggle);
  btnBack.addEventListener('click', function () { skip(-10); });
  btnFwd.addEventListener('click', function () { skip(10); });

  btnMute.addEventListener('click', function () {
    if (!back) return;
    var m = !back.muted();
    back.muted(m);
    root.classList.toggle('muted', m);
    vol.value = m ? 0 : (lastVol || 1);
  });

  vol.addEventListener('input', function () {
    if (!back) return;
    var v = Number(vol.value);
    lastVol = v || lastVol;
    back.volume(v);
    back.muted(v === 0);
    root.classList.toggle('muted', v === 0);
  });

  btnSpd.addEventListener('click', function (e) {
    e.stopPropagation();
    var hide = !spdMenu.hidden;
    spdMenu.hidden = hide;
    btnSpd.setAttribute('aria-expanded', String(!hide));
    if (!hide) buildSpeedMenu();
  });
  document.addEventListener('click', function () {
    if (!spdMenu.hidden) { spdMenu.hidden = true; btnSpd.setAttribute('aria-expanded', 'false'); }
  });

  btnPip.addEventListener('click', function () {
    if (!back || back.kind !== 'file') return;
    if (document.pictureInPictureElement) document.exitPictureInPicture();
    else video.requestPictureInPicture && video.requestPictureInPicture().catch(function () {});
  });

  btnFull.addEventListener('click', function () {
    var box = root.querySelector('.player-box');
    var go = box.requestFullscreen || box.webkitRequestFullscreen;
    if (document.fullscreenElement) document.exitFullscreen();
    else if (go) { try { go.call(box); } catch (e) {} }
  });

  var clickTimer = null;
  hit.addEventListener('click', function (e) {
    clearTimeout(clickTimer);
    clickTimer = setTimeout(toggle, 190);
    e.stopPropagation();
  });
  hit.addEventListener('dblclick', function (e) {
    clearTimeout(clickTimer);
    var r = stage.getBoundingClientRect();
    var x = (e.clientX - r.left) / r.width;
    if (x < 0.32) skip(-10);
    else if (x > 0.68) skip(10);
    else btnFull.click();
    e.stopPropagation();
  });

  function close() {
    if (!open) return;
    open = false;
    if (raf) cancelAnimationFrame(raf);
    if (back) { back.destroy(); back = null; }

    var f = stage.querySelector('.player-fail');
    if (f) f.remove();
    var n = meta.querySelector('.player-note');
    if (n) n.remove();

    hit.classList.remove('off');
    playerUI.classList.remove('off');
    var keys = meta.querySelector('.player-keys');
    if (keys) keys.hidden = false;
    root.hidden = true;
    root.classList.remove('playing');
    document.body.classList.remove('locked');
    if (document.fullscreenElement) document.exitFullscreen().catch(function () {});
    spdMenu.hidden = true;
  }

  Array.prototype.forEach.call(root.querySelectorAll('[data-close]'), function (n) {
    n.addEventListener('click', close);
  });

  document.addEventListener('keydown', function (e) {
    if (!open) return;
    var tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea') return;
    if (e.key === 'Escape') { close(); return; }
    if (back && back.plainMode) return;

    switch (e.key) {
      case ' ':
      case 'k': case 'K': toggle(); e.preventDefault(); break;
      case 'j': case 'J': skip(-10); break;
      case 'l': case 'L': skip(10); break;
      case 'ArrowLeft':  skip(-5); e.preventDefault(); break;
      case 'ArrowRight': skip(5);  e.preventDefault(); break;
      case 'ArrowUp':    vol.value = Math.min(1, Number(vol.value) + .1); vol.dispatchEvent(new Event('input')); e.preventDefault(); break;
      case 'ArrowDown':  vol.value = Math.max(0, Number(vol.value) - .1); vol.dispatchEvent(new Event('input')); e.preventDefault(); break;
      case 'm': case 'M': btnMute.click(); break;
      case 'f': case 'F': btnFull.click(); break;
      case '>': case '.': stepRate(1); break;
      case '<': case ',': stepRate(-1); break;
      default:
        if (/^[0-9]$/.test(e.key) && back) back.seek(back.duration() * (Number(e.key) / 10));
    }
  });

  function openItem(item) {
    close();
    open = true;
    root.hidden = false;
    document.body.classList.add('locked');

    pTitle.textContent = item.title || '';
    pDesc.textContent  = item.desc || '';

    btnPip.disabled = item.kind !== 'file';
    spinner.hidden = false;
    bigplay.hidden = true;

    back = item.kind === 'youtube' ? new Yt(item) : new Html5(item);

    if (item.kind === 'file') {
      video.addEventListener('error', function () {
        fail('Could not load "' + item.src + '". Is the file in that folder?');
      }, { once: true });
    }

    back.ready(function () {
      spinner.hidden = true;
      bigplay.hidden = false;
      setRate(1);
      back.volume(lastVol);
      root.classList.remove('muted');
      vol.value = lastVol;
      buildSpeedMenu();
      back.play();
      setTimeout(syncPlayBtn, 120);
    });

    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }

  return { open: openItem, close: close };
})();
