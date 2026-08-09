window.Roblox = (function () {
  'use strict';

  var opts = (window.CONFIG && CONFIG.options) || {};
  var PROXIES = opts.proxies && opts.proxies.length ? opts.proxies : ['roproxy.com'];

  var TIMEOUT = 9000;
  var CHUNK  = 40;
  var TTL_LIVE = 45 * 1000;
  var TTL_ICON = 24 * 3600 * 1000;

  function cacheGet(key, ttl) {
    try {
      var raw = sessionStorage.getItem('rbx:' + key);
      if (!raw) return null;
      var box = JSON.parse(raw);
      if (Date.now() - box.t > ttl) return null;
      return box.v;
    } catch (e) { return null; }
  }

  function cacheSet(key, value) {
    try {
      sessionStorage.setItem('rbx:' + key, JSON.stringify({ t: Date.now(), v: value }));
    } catch (e) {}
  }

  function withTimeout(url) {
    var ac = new AbortController();
    var timer = setTimeout(function () { ac.abort(); }, TIMEOUT);
    return fetch(url, { signal: ac.signal, mode: 'cors', credentials: 'omit' })
      .then(function (r) {
        clearTimeout(timer);
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .catch(function (e) { clearTimeout(timer); throw e; });
  }

  var goodProxy = null;

  function call(sub, path) {
    var order = goodProxy
      ? [goodProxy].concat(PROXIES.filter(function (p) { return p !== goodProxy; }))
      : PROXIES.slice();

    return order.reduce(function (chain, host) {
      return chain.catch(function () {
        return withTimeout('https://' + sub + '.' + host + path).then(function (json) {
          goodProxy = host;
          return json;
        });
      });
    }, Promise.reject());
  }

  function chunk(arr, n) {
    var out = [];
    for (var i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
    return out;
  }

  function fetchDetails(ids) {
    return Promise.all(chunk(ids, CHUNK).map(function (part) {
      return call('games', '/v1/games?universeIds=' + part.join(','));
    })).then(function (pages) {
      var out = {};
      pages.forEach(function (p) {
        (p && p.data ? p.data : []).forEach(function (g) {
          out[g.id] = {
            name:        g.name,
            playing:     g.playing || 0,
            visits:      g.visits || 0,
            favourites:  g.favoritedCount || 0,
            maxPlayers:  g.maxPlayers || 0,
            creator:     (g.creator && g.creator.name) || '',
            verified:    !!(g.creator && g.creator.hasVerifiedBadge),
            rootPlaceId: g.rootPlaceId,
            created:     g.created,
            updated:     g.updated
          };
        });
      });
      return out;
    });
  }

  function fetchIcons(ids) {
    var key = 'icons:' + ids.join('-');
    var hit = cacheGet(key, TTL_ICON);
    if (hit) return Promise.resolve(hit);

    return Promise.all(chunk(ids, CHUNK).map(function (part) {
      return call('thumbnails',
        '/v1/games/icons?universeIds=' + part.join(',') +
        '&size=512x512&format=Png&isCircular=false');
    })).then(function (pages) {
      var out = {};
      pages.forEach(function (p) {
        (p && p.data ? p.data : []).forEach(function (i) {
          if (i.state === 'Completed' && i.imageUrl) out[i.targetId] = i.imageUrl;
        });
      });
      cacheSet(key, out);
      return out;
    }).catch(function () { return {}; });
  }

  function fetchVotes(ids) {
    return Promise.all(chunk(ids, CHUNK).map(function (part) {
      return call('games', '/v1/games/votes?universeIds=' + part.join(','));
    })).then(function (pages) {
      var out = {};
      pages.forEach(function (p) {
        (p && p.data ? p.data : []).forEach(function (v) {
          var total = (v.upVotes || 0) + (v.downVotes || 0);
          out[v.id] = {
            up: v.upVotes || 0,
            down: v.downVotes || 0,
            pct: total ? Math.round((v.upVotes / total) * 100) : null
          };
        });
      });
      return out;
    }).catch(function () { return {}; });
  }

  function load(ids, opt) {
    opt = opt || {};
    ids = ids.map(Number).filter(function (n) { return n > 0; });
    if (!ids.length) return Promise.resolve({ games: {}, failed: false });

    var key = 'live:' + ids.join('-');
    if (!opt.fresh) {
      var hit = cacheGet(key, TTL_LIVE);
      if (hit) return Promise.resolve({ games: hit, failed: false, cached: true });
    }

    return fetchDetails(ids).then(function (details) {
      return Promise.all([fetchIcons(ids), fetchVotes(ids)]).then(function (rest) {
        var icons = rest[0], votes = rest[1];
        var merged = {};
        Object.keys(details).forEach(function (id) {
          merged[id] = details[id];
          merged[id].icon = icons[id] || null;
          merged[id].votes = votes[id] || null;
        });
        cacheSet(key, merged);
        return { games: merged, failed: false };
      });
    }).catch(function () {
      return { games: {}, failed: true };
    });
  }

  function placeUrl(rootPlaceId) {
    return 'https://www.roblox.com/games/' + rootPlaceId + '/';
  }

  return { load: load, placeUrl: placeUrl };
})();
