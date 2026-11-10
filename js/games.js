(function () {
  'use strict';

  var cfg  = (window.CONFIG && CONFIG.games) || [];
  var opts = (window.CONFIG && CONFIG.options) || {};
  var proxies = opts.proxies && opts.proxies.length ? opts.proxies : ['roproxy.com'];

  var entries = cfg.filter(function (g) { return g && g.id && !g.hide; });
  var ids = entries.map(function (g) { return Number(g.id); });

  function $(id) { return document.getElementById(id); }
  var stage = $('stage');
  var strip = $('strip');
  var errBox = $('games-error');
  if (!stage || !strip) return;

  var list = [];
  var pics = {};
  var current = 0;

  function full(n) { return (Number(n) || 0).toLocaleString('en-US'); }
  function compact(n) {
    n = Number(n) || 0;
    var units = [[1e9, 'B'], [1e6, 'M'], [1e3, 'K']];
    for (var i = 0; i < units.length; i++) {
      if (n >= units[i][0]) {
        var v = n / units[i][0];
        return (v >= 100 ? Math.round(v) : v.toFixed(1).replace(/\.0$/, '')) + units[i][1];
      }
    }
    return String(n);
  }

  function screenshots() {
    var path = '/v1/games/multiget/thumbnails?universeIds=' + ids.join(',') +
      '&countPerUniverse=1&defaults=true&size=768x432&format=Png&isCircular=false';
    return proxies.reduce(function (chain, host) {
      return chain.catch(function () {
        return fetch('https://thumbnails.' + host + path).then(function (r) {
          if (!r.ok) throw new Error(r.status);
          return r.json();
        });
      });
    }, Promise.reject()).then(function (j) {
      var out = {};
      (j.data || []).forEach(function (d) {
        if (d.thumbnails && d.thumbnails[0] && d.thumbnails[0].imageUrl) out[d.universeId] = d.thumbnails[0].imageUrl;
      });
      return out;
    }).catch(function () { return {}; });
  }

  function merge(games) {
    return entries.map(function (g) {
      var d = games[g.id];
      if (!d) return null;
      return {
        id: g.id,
        role: g.role || '',
        name: d.name,
        visits: d.visits,
        playing: d.playing,
        icon: d.icon,
        url: Roblox.placeUrl(d.rootPlaceId)
      };
    }).filter(Boolean);
  }

  function totals() {
    var v = 0, p = 0;
    list.forEach(function (g) { v += g.visits; p += g.playing; });
    $('visits').textContent = full(v);
    $('playing').textContent = full(p);
  }

  function image(g) { return pics[g.id] || g.icon || ''; }

  function fill() {
    var g = list[current];
    if (!g) return;
    $('st-img').src = image(g);
    $('st-shot').href = g.url;
    $('st-play').href = g.url;
    $('st-name').textContent = g.name;
    $('st-visits').textContent = full(g.visits);
    $('st-on').textContent = full(g.playing);
    $('st-on-box').hidden = !g.playing;
    $('st-role').textContent = g.role;
    stage.classList.remove('swap');
  }

  function show(i, instant) {
    current = i;
    strip.querySelectorAll('.pick').forEach(function (p) {
      p.classList.toggle('on', Number(p.dataset.i) === i);
    });
    if (instant) return fill();
    stage.classList.add('swap');
    setTimeout(fill, 200);
  }

  function buildStrip() {
    $('strip-count').textContent = list.length + (list.length === 1 ? ' game' : ' games');
    strip.innerHTML = '';
    list.forEach(function (g, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'pick';
      b.dataset.i = i;
      b.innerHTML = '<div class="shot"><img alt="" loading="lazy"></div><p><span></span><small></small></p>';
      b.querySelector('img').src = image(g);
      b.querySelector('p span').textContent = g.name;
      b.querySelector('small').textContent = compact(g.visits) + ' visits';
      strip.appendChild(b);
    });
    edges();
  }

  function edges() {
    $('prev').disabled = strip.scrollLeft < 4;
    $('next').disabled = strip.scrollLeft + strip.clientWidth > strip.scrollWidth - 4;
  }

  function fail(msg) {
    stage.hidden = true;
    errBox.hidden = false;
    errBox.textContent = msg;
  }

  strip.addEventListener('click', function (e) {
    var p = e.target.closest('.pick');
    if (p) show(Number(p.dataset.i));
  });
  strip.addEventListener('scroll', edges, { passive: true });
  window.addEventListener('resize', edges);
  $('prev').addEventListener('click', function () { strip.scrollBy({ left: -strip.clientWidth * 0.8 }); });
  $('next').addEventListener('click', function () { strip.scrollBy({ left: strip.clientWidth * 0.8 }); });

  if (!ids.length) {
    $('totals').hidden = true;
    document.querySelector('.strip-head').hidden = true;
    return fail('No games yet.');
  }

  Promise.all([Roblox.load(ids), screenshots()]).then(function (r) {
    pics = r[1];
    list = merge(r[0].games);
    if (!list.length) {
      $('totals').hidden = true;
      document.querySelector('.strip-head').hidden = true;
      return fail("Couldn't reach Roblox right now. Try again in a bit.");
    }
    totals();
    buildStrip();
    show(0, true);
  });

  var every = Number(opts.refreshSeconds) || 0;
  if (every > 0) {
    setInterval(function () {
      if (document.hidden || !list.length) return;
      Roblox.load(ids, { fresh: true }).then(function (r) {
        if (r.failed) return;
        var fresh = merge(r.games);
        if (fresh.length !== list.length) return;
        list = fresh;
        totals();
        strip.querySelectorAll('.pick small').forEach(function (s, i) {
          s.textContent = compact(list[i].visits) + ' visits';
        });
        $('st-visits').textContent = full(list[current].visits);
        $('st-on').textContent = full(list[current].playing);
        $('st-on-box').hidden = !list[current].playing;
      });
    }, Math.max(every, 15) * 1000);
  }
})();
