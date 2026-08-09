(function () {
  'use strict';

  var cfg  = (window.CONFIG && CONFIG.games) || [];
  var opts = (window.CONFIG && CONFIG.options) || {};

  var entries = cfg.filter(function (g) { return g && g.id && !g.hide; });

  var stage = document.getElementById('games-stage');
  var layer = document.getElementById('globe-layer');
  var grid = document.getElementById('games-grid');
  var errBox = document.getElementById('games-error');
  var totals = document.getElementById('totals');
  var syncNote = document.getElementById('games-sync');
  var hint = document.getElementById('globe-hint');
  var toggle = document.querySelector('.view-toggle');

  if (!stage || !grid) return;

  var cards = {};
  var globe = null;
  var view  = 'globe';
  var lastFetch = 0;

  function compact(n) {
    n = Number(n) || 0;
    if (n >= 1e9) return trim(n / 1e9) + 'B';
    if (n >= 1e6) return trim(n / 1e6) + 'M';
    if (n >= 1e3) return trim(n / 1e3) + 'K';
    return String(n);
  }
  function trim(v) {
    return (v >= 100 ? Math.round(v) : v >= 10 ? v.toFixed(1) : v.toFixed(2))
      .toString().replace(/\.?0+$/, '');
  }
  function full(n) { return (Number(n) || 0).toLocaleString('en-US'); }

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  var ARROW = '<svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true">' +
    '<path d="M5.5 10.5l5-5M6.5 5.5h4v4" fill="none" stroke="currentColor" ' +
    'stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  var PLAYERS = '<svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true">' +
    '<path fill="currentColor" d="M6 7.6a2.4 2.4 0 1 0 0-4.8 2.4 2.4 0 0 0 0 4.8Z"/>' +
    '<path fill="currentColor" d="M6 8.8c-2.1 0-3.8 1.2-3.8 2.7v1.1h7.6v-1.1c0-1.5-1.7-2.7-3.8-2.7Z"/>' +
    '<path fill="currentColor" d="M11.4 7.4a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/>' +
    '<path fill="currentColor" d="M11.6 8.6c-.45 0-.87.05-1.25.15.72.6 1.15 1.4 1.15 2.35v1.5h3.3v-1.2c0-1.4-1.43-2.8-3.2-2.8Z"/>' +
    '</svg>';

  function makeCard(entry) {
    var a = el('a', 'card is-loading');
    a.href = entry.url || '#';
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.dataset.id = entry.id;

    var top = el('div', 'card-top is-blank');
    top.appendChild(el('span', null, 'loading'));
    top.appendChild(el('div', 'card-fade'));
    a.appendChild(top);

    a.appendChild(el('span', 'card-open', ARROW));

    var body = el('div', 'card-body');
    body.appendChild(el('h3', 'card-title', 'Universe ' + entry.id));
    if (entry.role) body.appendChild(el('p', 'card-role', entry.role));

    var stats = el('div', 'card-stats');
    stats.innerHTML =
      '<div class="stat"><b data-visits>—</b><span>visits</span></div>' +
      '<div class="stat is-live"><b data-playing>—</b><span>playing</span></div>';
    body.appendChild(stats);

    a.appendChild(body);
    return a;
  }

  function fillCard(a, entry, g) {
    a.classList.remove('is-loading');

    if (!g) {
      a.classList.add('is-dead');
      a.querySelector('.card-title').textContent = 'Universe ' + entry.id;
      var blank = a.querySelector('.card-top span');
      if (blank) blank.textContent = 'unavailable';
      return;
    }
    a.classList.remove('is-dead');

    if (!entry.url && g.rootPlaceId) a.href = Roblox.placeUrl(g.rootPlaceId);

    a.querySelector('.card-title').textContent = g.name || ('Universe ' + entry.id);
    a.title = (g.name || '') + (g.creator ? '  ·  by ' + g.creator : '');

    var top = a.querySelector('.card-top');
    var have = top.querySelector('img');
    if (g.icon && (!have || have.src !== g.icon)) {
      top.classList.remove('is-blank');
      top.innerHTML = '';
      var img = new Image();
      img.src = g.icon;
      img.alt = g.name || '';
      img.loading = 'lazy';
      img.decoding = 'async';
      top.appendChild(img);
      top.appendChild(el('div', 'card-fade'));
    } else if (!g.icon && !have) {
      var ph = top.querySelector('span');
      if (ph) ph.textContent = 'no icon';
    }

    var oldLive = top.querySelector('.card-live');
    if (oldLive) oldLive.remove();
    if (g.playing > 0) {
      top.appendChild(el('span', 'card-live', PLAYERS + full(g.playing)));
    }

    var v = a.querySelector('[data-visits]');
    var p = a.querySelector('[data-playing]');
    v.textContent = compact(g.visits);
    v.parentElement.title = full(g.visits) + ' visits';
    p.textContent = compact(g.playing);
    p.parentElement.title = full(g.playing) + ' playing now';

    if (g.votes && g.votes.pct != null) {
      var stats = a.querySelector('.card-stats');
      var rb = stats.querySelector('[data-rating]');
      if (!rb) {
        var r = el('div', 'stat', '<b data-rating>' + g.votes.pct + '%</b><span>rating</span>');
        stats.appendChild(r);
        stats.classList.add('has-rating');
        rb = r.querySelector('b');
      } else {
        rb.textContent = g.votes.pct + '%';
      }
      rb.parentElement.title = full(g.votes.up) + ' up / ' + full(g.votes.down) + ' down';
    }
  }

  function countUp(node, target, fmt) {
    var start = performance.now(), dur = 1300;
    function step(now) {
      var t = Math.min(1, (now - start) / dur);
      var e = 1 - Math.pow(2, -10 * t);
      node.textContent = fmt(Math.round(target * e));
      if (t < 1) requestAnimationFrame(step);
      else node.textContent = fmt(target);
    }
    requestAnimationFrame(step);
  }

  var totalsDone = false;
  function setTotals(list, dead) {
    var visits = 0, playing = 0;
    list.forEach(function (g) { visits += g.visits || 0; playing += g.playing || 0; });
    if (!totals) return { visits: visits, playing: playing };

    var nodes = totals.querySelectorAll('.total-num');
    totals.hidden = false;

    if (dead) {
      nodes[0].textContent = '—';
      nodes[1].textContent = '—';
      nodes[0].title = nodes[1].title = 'Roblox is not answering right now';
      return { visits: 0, playing: 0 };
    }

    nodes[0].title = full(visits) + ' visits';
    nodes[1].title = full(playing) + ' playing';

    if (!totalsDone) {
      totalsDone = true;
      countUp(nodes[0], visits, compact);
      countUp(nodes[1], playing, full);
    } else {
      nodes[0].textContent = compact(visits);
      nodes[1].textContent = full(playing);
    }
    return { visits: visits, playing: playing };
  }

  function orderByPlaying(games) {
    entries.sort(function (a, b) {
      var ga = games[a.id], gb = games[b.id];
      var pa = ga ? (ga.playing || 0) : -1;
      var pb = gb ? (gb.playing || 0) : -1;
      if (pb !== pa) return pb - pa;
      return (gb ? gb.visits || 0 : -1) - (ga ? ga.visits || 0 : -1);
    });

    var els = [];
    entries.forEach(function (e) { if (cards[e.id]) els.push(cards[e.id]); });
    if (!els.length) return;

    if (view === 'grid') {
      els.forEach(function (c) { grid.appendChild(c); });
    } else {
      els.forEach(function (c) { layer.appendChild(c); });
      if (globe) globe.setItems(els, true);
    }
  }

  function setView(next, remember) {
    view = next;

    Array.prototype.forEach.call(toggle.querySelectorAll('button'), function (b) {
      b.classList.toggle('on', b.dataset.view === next);
    });

    if (next === 'globe') {
      stage.hidden = false;
      grid.hidden = true;
      entries.forEach(function (e) {
        var c = cards[e.id];
        if (c) { c.classList.add('globe-card'); layer.appendChild(c); }
      });
      if (globe) {
        var els = [];
        entries.forEach(function (e) { if (cards[e.id]) els.push(cards[e.id]); });
        globe.setItems(els);
        globe.start();
      }
    } else {
      if (globe) globe.stop();
      stage.hidden = true;
      grid.hidden = false;
      entries.forEach(function (e) {
        var c = cards[e.id];
        if (c) {
          c.classList.remove('globe-card');
          c.style.transform = '';
          c.style.opacity = '';
          c.style.pointerEvents = '';
          grid.appendChild(c);
        }
      });
    }
    if (remember) {
      try { localStorage.setItem('pm:view', next); } catch (err) {}
    }
  }

  function render() {
    if (!entries.length) {
      stage.hidden = true;
      grid.hidden = false;
      grid.innerHTML =
        '<p class="reel-empty">Nothing listed yet.</p>';
      return;
    }

    entries.forEach(function (e) {
      var c = makeCard(e);
      cards[e.id] = c;
      layer.appendChild(c);
      c.classList.add('globe-card');
    });

    stage.tabIndex = 0;
    globe = new Globe(stage, layer, {});
    globe.setItems(entries.map(function (e) { return cards[e.id]; }));

    layer.addEventListener('click', function (ev) {
      if (view === 'globe' && globe && globe.lastWasDrag) {
        ev.preventDefault();
        ev.stopPropagation();
        globe.lastWasDrag = false;
      }
    }, true);

    stage.addEventListener('globe:drag', function () {
      if (hint) hint.classList.add('gone');
    }, { once: true });
    setTimeout(function () { if (hint) hint.classList.add('gone'); }, 7000);

    var saved = null;
    try { saved = localStorage.getItem('pm:view'); } catch (err) {}
    var start = saved || opts.defaultGameView || 'globe';
    setView(window.innerWidth < 780 ? 'grid' : start, false);

    toggle.addEventListener('click', function (ev) {
      var b = ev.target.closest('button[data-view]');
      if (b) setView(b.dataset.view, true);
    });
  }

  function load(fresh) {
    var ids = entries.map(function (e) { return e.id; });

    Roblox.load(ids, { fresh: fresh }).then(function (res) {
      lastFetch = Date.now();

      if (res.failed) {
        errBox.hidden = false;
        errBox.textContent =
          'Could not reach Roblox through any proxy (' +
          (opts.proxies || []).join(', ') + '). ' +
          'Cards are showing without live numbers. That is usually the proxy ' +
          'being down for a minute, not your config.';
        entries.forEach(function (e) { fillCard(cards[e.id], e, null); });
        setTotals([], true);
        return;
      }

      errBox.hidden = true;
      var got = [];
      entries.forEach(function (e) {
        var g = res.games[e.id];
        fillCard(cards[e.id], e, g);
        if (g) got.push(g);
      });

      orderByPlaying(res.games);

      setTotals(got, false);
      if (globe) globe.measure();

      var missing = entries.length - got.length;
      if (missing > 0) {
        errBox.hidden = false;
        errBox.textContent = 'Roblox is not returning stats for ' + missing +
          ' of these right now.';
      }

      tickSync();
    });
  }

  function tickSync() {
    if (!syncNote) return;
    var n = entries.length + (entries.length === 1 ? ' experience' : ' experiences');
    if (!lastFetch) { syncNote.textContent = n; return; }
    var s = Math.round((Date.now() - lastFetch) / 1000);
    syncNote.textContent = n + ' · synced ' + (s < 5 ? 'just now' : s + 's ago');
  }

  render();
  tickSync();
  load(false);

  setInterval(tickSync, 5000);

  var every = Number(opts.refreshSeconds) || 0;
  if (every > 0) {
    setInterval(function () {
      if (!document.hidden) load(true);
    }, Math.max(20, every) * 1000);
  }
})();
