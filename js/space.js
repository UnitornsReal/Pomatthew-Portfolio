(function () {
  'use strict';

  var canvas = document.getElementById('sky');
  if (!canvas) return;

  var ctx  = canvas.getContext('2d', { alpha: false });
  var calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var W = 0, H = 0, DPR = 1;
  var stars = [], shots = [];
  var neb = null, nebCtx = null;

  var scrollY = 0, lastScroll = 0, warp = 0;

  var STAR_COUNT = (window.CONFIG && CONFIG.options && CONFIG.options.starCount) || 460;

  var CLOUDS = [
    { x: .16, y: .12, r: .60, c: [ 71,  35, 169], a: .32 },
    { x: .84, y: .07, r: .46, c: [155,  60, 211], a: .24 },
    { x: .58, y: .44, r: .72, c: [ 50,  21, 117], a: .34 },
    { x: .06, y: .64, r: .54, c: [230,  55, 125], a: .10 },
    { x: .93, y: .74, r: .50, c: [230,  55, 125], a: .05 },
    { x: .38, y: .92, r: .56, c: [ 35,  21,  87], a: .32 },
    { x: .70, y: .20, r: .34, c: [110,  95, 200], a: .13 }
  ];

  function rand(a, b) { return a + Math.random() * (b - a); }

  function buildStars() {
    stars.length = 0;
    var n = Math.round(STAR_COUNT * Math.min(2, (W * H) / (1600 * 900)));
    for (var i = 0; i < n; i++) {
      var z = Math.pow(Math.random(), 1.7);
      var roll = Math.random();
      var hue = roll < 0.08 ? rand(36, 50) : roll < 0.24 ? rand(272, 300) : rand(228, 258);
      stars.push({
        x: Math.random() * W,
        y: Math.random() * H,
        z: z,
        r: 0.35 + z * 1.45,
        drift: rand(-0.05, 0.05) * (0.3 + z),
        tw: Math.random() * Math.PI * 2,
        tws: rand(0.006, 0.03),
        hue: hue
      });
    }
  }

  function buildNebula() {
    var w = Math.max(2, Math.round(W / 3));
    var h = Math.max(2, Math.round(H / 3));

    if (!neb) { neb = document.createElement('canvas'); nebCtx = neb.getContext('2d'); }
    neb.width = w; neb.height = h;

    nebCtx.clearRect(0, 0, w, h);
    nebCtx.globalCompositeOperation = 'lighter';

    CLOUDS.forEach(function (b) {
      var cx = b.x * w, cy = b.y * h, r = b.r * Math.max(w, h) * .5;
      for (var k = -1; k <= 1; k++) {
        var y = cy + k * h;
        if (y + r < 0 || y - r > h) continue;
        var g = nebCtx.createRadialGradient(cx, y, 0, cx, y, r);
        g.addColorStop(0,   'rgba(' + b.c.join(',') + ',' + b.a + ')');
        g.addColorStop(.42, 'rgba(' + b.c.join(',') + ',' + (b.a * .34).toFixed(3) + ')');
        g.addColorStop(1,   'rgba(' + b.c.join(',') + ',0)');
        nebCtx.fillStyle = g;
        nebCtx.fillRect(0, 0, w, h);
      }
    });

    nebCtx.globalCompositeOperation = 'source-over';
  }

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width  = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    canvas.style.width  = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    buildStars();
    buildNebula();
  }

  function spawnShot() {
    shots.push({
      x: rand(-0.15, 0.85) * W,
      y: rand(-0.1, 0.35) * H,
      vx: rand(4.5, 8),
      vy: rand(2.2, 4.4),
      life: 0,
      max: rand(45, 80)
    });
  }

  function drawShots() {
    for (var i = shots.length - 1; i >= 0; i--) {
      var s = shots[i];
      s.life++;
      s.x += s.vx; s.y += s.vy;

      var p = s.life / s.max;
      if (p >= 1 || s.x > W + 200 || s.y > H + 200) { shots.splice(i, 1); continue; }

      var a = p < .18 ? p / .18 : 1 - (p - .18) / .82;
      var len = 90 + 60 * Math.sin(Math.PI * p);

      var g = ctx.createLinearGradient(s.x, s.y, s.x - s.vx * len / 8, s.y - s.vy * len / 8);
      g.addColorStop(0, 'rgba(255,245,255,' + (a * .95).toFixed(3) + ')');
      g.addColorStop(.4, 'rgba(190,150,255,' + (a * .45).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(120,60,255,0)');

      ctx.strokeStyle = g;
      ctx.lineWidth = 1.6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x - s.vx * len / 8, s.y - s.vy * len / 8);
      ctx.stroke();
    }
  }

  function frame() {
    ctx.fillStyle = '#06050e';
    ctx.fillRect(0, 0, W, H);

    if (neb) {
      var ny = -scrollY * 0.04;
      ctx.globalAlpha = 1;
      ctx.drawImage(neb, 0, ny % H - (ny % H > 0 ? H : 0), W, H);
      ctx.drawImage(neb, 0, (ny % H) + (ny % H > 0 ? -H : 0) + H, W, H);
    }

    var dv = scrollY - lastScroll;
    lastScroll = scrollY;
    warp += (Math.min(Math.abs(dv), 90) - warp) * 0.14;
    var dir = dv >= 0 ? 1 : -1;

    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];

      if (!calm) {
        s.x += s.drift;
        s.tw += s.tws;
        if (s.x < -4) s.x = W + 4; else if (s.x > W + 4) s.x = -4;
      }

      var par = 0.06 + s.z * 0.85;
      var y = s.y - scrollY * par;
      y = ((y % H) + H) % H;

      var tw = calm ? 0.85 : 0.62 + 0.38 * Math.sin(s.tw);
      var a  = (0.20 + s.z * 0.8) * tw;
      var streak = calm ? 0 : warp * par * 0.55;

      if (streak > 1.5) {
        ctx.strokeStyle = 'hsla(' + s.hue + ',82%,88%,' + a.toFixed(3) + ')';
        ctx.lineWidth = s.r * 1.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(s.x, y);
        ctx.lineTo(s.x, y + streak * dir);
        ctx.stroke();
      } else {
        ctx.fillStyle = 'hsla(' + s.hue + ',82%,90%,' + a.toFixed(3) + ')';
        ctx.beginPath();
        ctx.arc(s.x, y, s.r, 0, 6.2832);
        ctx.fill();
      }

      if (s.z > 0.86 && !calm) {
        ctx.fillStyle = 'hsla(' + s.hue + ',95%,80%,' + (a * 0.10).toFixed(3) + ')';
        ctx.beginPath();
        ctx.arc(s.x, y, s.r * 5.5, 0, 6.2832);
        ctx.fill();
      }
    }

    if (!calm) {
      if (Math.random() < 0.0022 && shots.length < 3) spawnShot();
      drawShots();
    }

    requestAnimationFrame(frame);
  }

  var rt;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(resize, 160);
  });

  window.addEventListener('scroll', function () {
    scrollY = window.scrollY || window.pageYOffset || 0;
  }, { passive: true });

  resize();
  scrollY = lastScroll = window.scrollY || 0;
  requestAnimationFrame(frame);
})();
