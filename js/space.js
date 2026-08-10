(function () {
  'use strict';

  var canvas = document.getElementById('sky');
  if (!canvas) return;

  var opts = (window.CONFIG && CONFIG.options) || {};
  var calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var STAR_COUNT = opts.starCount || 460;
  var DPR_CAP    = opts.maxPixelRatio || 1.5;
  var DPR_FLOOR  = 0.75;
  var WANT_NEB   = opts.nebula !== false;

  var NS = 256;
  var SPAN = 1.6;
  var S = 3.4 / NS;

  var BASE_CSS = '#06050e';
  var BASE_RGB = [0x06 / 255, 0x05 / 255, 0x0e / 255];

  var W = 0, H = 0, DPR = 1;
  var target = 0, eased = 0, prev = 0, warp = 0, dirs = 1;
  var t0 = 0, clock = 0, lastT = 0;
  var slow = 0, ticks = 0, drops = 0;
  var alive = true;

  var n = 0, pX, pY, pZ, pR, pPh, pTw, pDr, pHue;
  var shots = [];

  function rand(a, b) { return a + Math.random() * (b - a); }

  function hash2(x, y) {
    var v = Math.imul(x, 374761393) ^ Math.imul(y, 668265263);
    v = Math.imul(v ^ (v >>> 13), 1274126177);
    return ((v ^ (v >>> 16)) >>> 0) / 4294967296;
  }

  function vnoise(x, y) {
    var xi = Math.floor(x), yi = Math.floor(y);
    var xf = x - xi, yf = y - yi;
    var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    var a = hash2(xi, yi), b = hash2(xi + 1, yi);
    var c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }

  function fbm(x, y, oct) {
    var s = 0, amp = 0.5, f = 1;
    for (var i = 0; i < oct; i++) {
      s += amp * vnoise(x * f, y * f);
      f *= 2.03; amp *= 0.5;
    }
    return s;
  }

  function warped(x, y) {
    var q1 = fbm(x, y, 3);
    var q2 = fbm(x + 5.2, y + 1.3, 3);
    return fbm(x + 4 * q1 + 1.7, y + 4 * q2 + 9.2, 4);
  }

  var gas1 = null, gas2 = null, dustMap = null;
  var bakeRow = 0, baked = false, fade = 0;

  function ramp(out, d, hs) {
    if (d <= 0.34) { out[3] = 0; return; }
    var e = (d - 0.34) / 0.40;
    if (e > 1) e = 1;
    var t, r, g, b;
    if (e < 0.46)      { t = e / 0.46;          r = 30  + t * 88; g = 16 + t * 30;  b = 86  + t * 116; }
    else if (e < 0.80) { t = (e - 0.46) / 0.34; r = 118 + t * 76; g = 46 + t * 12;  b = 202 - t * 18;  }
    else               { t = (e - 0.80) / 0.20; r = 194 + t * 31; g = 58 + t * 34;  b = 184 + t * 21;  }

    r += hs * 48; g += hs * 6; b -= hs * 34;
    out[0] = r < 0 ? 0 : r > 255 ? 255 : r;
    out[1] = g < 0 ? 0 : g > 255 ? 255 : g;
    out[2] = b < 0 ? 0 : b > 255 ? 255 : b;
    out[3] = Math.pow(e, 1.9) * 138;
  }

  function initBake() {
    var c = document.createElement('canvas');
    c.width = NS; c.height = NS;
    var cx = c.getContext('2d');
    gas1 = cx.createImageData(NS, NS);
    gas2 = cx.createImageData(NS, NS);
    dustMap = cx.createImageData(NS, NS);
    bakeRow = 0;
    baked = false;
  }

  function bakeStep(rows) {
    var d1 = gas1.data, d2 = gas2.data, dd = dustMap.data;
    var out = [0, 0, 0, 0];
    var end = Math.min(NS, bakeRow + rows);

    for (var y = bakeRow; y < end; y++) {
      var f = y / NS, g = 1 - f;
      var yb = y - NS;

      for (var x = 0; x < NS; x++) {
        var i = (y * NS + x) << 2;

        var h1 = vnoise(x * S * 0.30 + 77.1, y  * S * 0.30 + 41.9);
        var h2 = vnoise(x * S * 0.30 + 77.1, yb * S * 0.30 + 41.9);
        var hs = ((h1 * g + h2 * f) - 0.5) * 2;

        ramp(out, warped(x * S, y * S) * g + warped(x * S, yb * S) * f, hs);
        if (out[3] > 0) { d1[i] = out[0]; d1[i + 1] = out[1]; d1[i + 2] = out[2]; d1[i + 3] = out[3]; }

        var ax = x * S * 1.37 + 137.7;
        ramp(out, warped(ax, y * S * 1.37 + 91.3) * g + warped(ax, yb * S * 1.37 + 91.3) * f, hs);
        if (out[3] > 0) { d2[i] = out[0]; d2[i + 1] = out[1]; d2[i + 2] = out[2]; d2[i + 3] = out[3] * 0.82; }

        var ux = x * S * 0.72 + 31.7;
        var du = fbm(ux, y * S * 0.72 + 12.3, 3) * g + fbm(ux, yb * S * 0.72 + 12.3, 3) * f;
        if (du < 0.40) {
          var k = (0.40 - du) / 0.40;
          dd[i] = 3; dd[i + 1] = 2; dd[i + 2] = 9;
          dd[i + 3] = Math.pow(k, 1.7) * 205;
        }
      }
    }

    bakeRow = end;
    if (bakeRow >= NS) baked = true;
  }

  function buildStars() {
    n = Math.round(STAR_COUNT * Math.min(2, (W * H) / (1600 * 900)));
    pX = new Float32Array(n); pY = new Float32Array(n); pZ = new Float32Array(n);
    pR = new Float32Array(n); pPh = new Float32Array(n); pTw = new Float32Array(n);
    pDr = new Float32Array(n); pHue = new Float32Array(n);

    for (var i = 0; i < n; i++) {
      var z = Math.pow(Math.random(), 1.7);
      var roll = Math.random();
      pHue[i] = roll < 0.08 ? rand(36, 50) : roll < 0.24 ? rand(272, 300) : rand(228, 258);
      pX[i] = Math.random() * W;
      pY[i] = Math.random() * H;
      pZ[i] = z;
      pR[i] = 0.35 + z * 1.45;
      pPh[i] = Math.random() * Math.PI * 2;
      pTw[i] = rand(0.006, 0.03);
      pDr[i] = rand(-0.05, 0.05) * (0.3 + z);
    }
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

  function stepShots() {
    for (var i = shots.length - 1; i >= 0; i--) {
      var s = shots[i];
      s.life++;
      s.x += s.vx; s.y += s.vy;
      var p = s.life / s.max;
      if (p >= 1 || s.x > W + 200 || s.y > H + 200) { shots.splice(i, 1); continue; }
      s.t = p;
      s.a = p < 0.18 ? p / 0.18 : 1 - (p - 0.18) / 0.82;
      s.len = 90 + 60 * Math.sin(Math.PI * p);
    }
  }

  var VS_BG =
    'attribute vec2 a;varying vec2 v;' +
    'void main(){v=a*0.5+0.5;gl_Position=vec4(a,0.0,1.0);}';

  var FS_BG =
    'precision mediump float;varying vec2 v;' +
    'uniform sampler2D g1,g2,du;uniform vec3 base;uniform float ys,fade;uniform vec3 off;' +
    'void main(){' +
    'float u=v.x;float y=v.y*ys;' +
    'vec4 c1=texture2D(g1,vec2(u,y+off.x));' +
    'vec4 c2=texture2D(g2,vec2(1.0-u,y*0.86+off.y));' +
    'vec4 c3=texture2D(du,vec2(u,y*1.13+off.z));' +
    'vec3 col=base;' +
    'col=mix(col,c1.rgb,c1.a*fade);' +
    'col=mix(col,c2.rgb,c2.a*fade);' +
    'col=mix(col,c3.rgb,c3.a*fade);' +
    'gl_FragColor=vec4(col,1.0);}';

  var VS_STAR =
    'precision highp float;' +
    'attribute vec2 corner;attribute vec2 seed;attribute vec4 star;attribute vec2 extra;' +
    'uniform vec2 size;uniform float scroll,time,warpv,dirv,still;' +
    'varying vec2 vp;varying vec3 vc;varying float va,vr,vs;' +
    'vec3 hsl(float h,float s,float l){' +
    'vec3 k=mod(vec3(0.0,8.0,4.0)+h/30.0,12.0);' +
    'return l-s*min(l,1.0-l)*clamp(min(k-3.0,9.0-k),-1.0,1.0);}' +
    'void main(){' +
    'float z=star.x;float par=0.06+z*0.85;' +
    'float x=mod(seed.x+(1.0-still)*time*extra.x*60.0,size.x);' +
    'float y=mod(seed.y-scroll*par,size.y);' +
    'float tw=mix(0.62+0.38*sin(star.z+time*star.w*60.0),0.85,still);' +
    'va=(0.20+z*0.8)*tw;' +
    'vr=star.y;' +
    'vs=(1.0-still)*warpv*par*0.275;' +
    'vp=vec2(corner.x*vr*4.0,corner.y*(vr*4.0+vs));' +
    'vec2 p=vec2(x,y+vs*dirv)+vp;' +
    'vec2 c=(p/size)*2.0-1.0;' +
    'gl_Position=vec4(c.x,-c.y,0.0,1.0);' +
    'vc=hsl(extra.y,0.82,0.90);}';

  var FS_STAR =
    'precision mediump float;' +
    'varying vec2 vp;varying vec3 vc;varying float va,vr,vs;' +
    'void main(){' +
    'float dy=max(abs(vp.y)-vs,0.0);' +
    'float d=length(vec2(vp.x,dy));' +
    'float core=1.0-smoothstep(vr-0.7,vr+0.7,d);' +
    'float glow=exp(-d/(vr*2.4))*0.13;' +
    'float a=clamp(va*(core+glow),0.0,1.0);' +
    'gl_FragColor=vec4(vc*a,a);}';

  var VS_SHOT =
    'attribute vec2 p;attribute vec2 ta;uniform vec2 size;varying float vt,vw;' +
    'void main(){vt=ta.x;vw=ta.y;vec2 c=(p/size)*2.0-1.0;' +
    'gl_Position=vec4(c.x,-c.y,0.0,1.0);}';

  var FS_SHOT =
    'precision mediump float;varying float vt,vw;uniform float alpha;' +
    'void main(){' +
    'float a=alpha*(1.0-vt)*(1.0-abs(vw));' +
    'vec3 col=mix(vec3(1.0,0.96,1.0),vec3(0.47,0.24,1.0),vt);' +
    'gl_FragColor=vec4(col*a,a);}';

  var gl = null, GL = null;

  function compile(g, type, src) {
    var sh = g.createShader(type);
    g.shaderSource(sh, src);
    g.compileShader(sh);
    if (!g.getShaderParameter(sh, g.COMPILE_STATUS)) { g.deleteShader(sh); return null; }
    return sh;
  }

  function program(g, vs, fs, attrs) {
    var v = compile(g, g.VERTEX_SHADER, vs);
    var f = compile(g, g.FRAGMENT_SHADER, fs);
    if (!v || !f) return null;
    var p = g.createProgram();
    g.attachShader(p, v); g.attachShader(p, f);
    g.linkProgram(p);
    g.deleteShader(v); g.deleteShader(f);
    if (!g.getProgramParameter(p, g.LINK_STATUS)) return null;

    var o = { p: p, a: {}, u: {} };
    attrs.forEach(function (name) { o.a[name] = g.getAttribLocation(p, name); });
    var count = g.getProgramParameter(p, g.ACTIVE_UNIFORMS);
    for (var i = 0; i < count; i++) {
      var info = g.getActiveUniform(p, i);
      o.u[info.name] = g.getUniformLocation(p, info.name);
    }
    return o;
  }

  function texture(g, src) {
    var t = g.createTexture();
    g.bindTexture(g.TEXTURE_2D, t);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.REPEAT);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR);
    if (src) g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, src);
    else g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, 1, 1, 0, g.RGBA, g.UNSIGNED_BYTE,
                      new Uint8Array([0, 0, 0, 0]));
    return t;
  }

  var booted = false;

  function freshCanvas() {
    var next = canvas.cloneNode(false);
    if (canvas.parentNode) canvas.parentNode.replaceChild(next, canvas);
    canvas = next;
  }

  function initGL() {
    var g;
    try {
      var attrs = {
        alpha: false, depth: false, stencil: false, antialias: false,
        preserveDrawingBuffer: false, powerPreference: 'low-power',
        failIfMajorPerformanceCaveat: true
      };
      g = canvas.getContext('webgl', attrs) || canvas.getContext('experimental-webgl', attrs);
    } catch (e) { g = null; }
    if (!g) return false;

    var bg   = program(g, VS_BG, FS_BG, ['a']);
    var star = program(g, VS_STAR, FS_STAR, ['corner', 'seed', 'star', 'extra']);
    var shot = program(g, VS_SHOT, FS_SHOT, ['p', 'ta']);
    if (!bg || !star || !shot) {
      if (!booted) freshCanvas();
      return false;
    }

    var quad = g.createBuffer();
    g.bindBuffer(g.ARRAY_BUFFER, quad);
    g.bufferData(g.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), g.STATIC_DRAW);

    gl = g;
    GL = {
      bg: bg, star: star, shot: shot, quad: quad,
      g1: texture(g, null), g2: texture(g, null), du: texture(g, null),
      verts: g.createBuffer(), index: g.createBuffer(),
      shotBuf: g.createBuffer(), shotData: new Float32Array(3 * 4 * 4),
      count: 0, uploaded: false
    };

    g.disable(g.DEPTH_TEST);
    g.disable(g.CULL_FACE);
    g.blendFunc(g.ONE, g.ONE_MINUS_SRC_ALPHA);

    return true;
  }

  function watchContext() {
    canvas.addEventListener('webglcontextlost', function (e) {
      e.preventDefault();
      alive = false;
    });
    canvas.addEventListener('webglcontextrestored', function () {
      GL = null; gl = null;
      if (initGL()) {
        buildGLStars();
        if (baked) uploadNebula();
        alive = true;
      }
    });
  }

  var CORNERS = [-1, -1, 1, -1, 1, 1, -1, 1];

  function buildGLStars() {
    if (!gl) return;
    var stride = 10;
    var data = new Float32Array(n * 4 * stride);
    var idx = new Uint16Array(n * 6);

    for (var i = 0; i < n; i++) {
      for (var c = 0; c < 4; c++) {
        var o = (i * 4 + c) * stride;
        data[o]     = CORNERS[c * 2];
        data[o + 1] = CORNERS[c * 2 + 1];
        data[o + 2] = pX[i];
        data[o + 3] = pY[i];
        data[o + 4] = pZ[i];
        data[o + 5] = pR[i];
        data[o + 6] = pPh[i];
        data[o + 7] = pTw[i];
        data[o + 8] = pDr[i];
        data[o + 9] = pHue[i];
      }
      var b = i * 4, j = i * 6;
      idx[j] = b; idx[j + 1] = b + 1; idx[j + 2] = b + 2;
      idx[j + 3] = b; idx[j + 4] = b + 2; idx[j + 5] = b + 3;
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, GL.verts);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, GL.index);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
    GL.count = n * 6;
  }

  function uploadNebula() {
    if (!gl) return;
    gl.bindTexture(gl.TEXTURE_2D, GL.g1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, gas1);
    gl.bindTexture(gl.TEXTURE_2D, GL.g2);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, gas2);
    gl.bindTexture(gl.TEXTURE_2D, GL.du);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, dustMap);
    GL.uploaded = true;
  }

  function drawGL() {
    gl.viewport(0, 0, canvas.width, canvas.height);

    var span = SPAN * H;
    gl.disable(gl.BLEND);
    gl.useProgram(GL.bg.p);
    gl.bindBuffer(gl.ARRAY_BUFFER, GL.quad);
    gl.enableVertexAttribArray(GL.bg.a.a);
    gl.vertexAttribPointer(GL.bg.a.a, 2, gl.FLOAT, false, 0, 0);
    gl.uniform3fv(GL.bg.u.base, BASE_RGB);
    gl.uniform1f(GL.bg.u.ys, 1 / SPAN);
    gl.uniform1f(GL.bg.u.fade, fade);
    gl.uniform3f(GL.bg.u.off,
      -eased * 0.050 / span, -eased * 0.085 / span, -eased * 0.030 / span);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, GL.g1);
    gl.uniform1i(GL.bg.u.g1, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, GL.g2);
    gl.uniform1i(GL.bg.u.g2, 1);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, GL.du);
    gl.uniform1i(GL.bg.u.du, 2);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.disableVertexAttribArray(GL.bg.a.a);

    gl.enable(gl.BLEND);

    if (GL.count) {
      var p = GL.star, st = 40;
      gl.useProgram(p.p);
      gl.bindBuffer(gl.ARRAY_BUFFER, GL.verts);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, GL.index);
      gl.enableVertexAttribArray(p.a.corner);
      gl.vertexAttribPointer(p.a.corner, 2, gl.FLOAT, false, st, 0);
      gl.enableVertexAttribArray(p.a.seed);
      gl.vertexAttribPointer(p.a.seed, 2, gl.FLOAT, false, st, 8);
      gl.enableVertexAttribArray(p.a.star);
      gl.vertexAttribPointer(p.a.star, 4, gl.FLOAT, false, st, 16);
      gl.enableVertexAttribArray(p.a.extra);
      gl.vertexAttribPointer(p.a.extra, 2, gl.FLOAT, false, st, 32);
      gl.uniform2f(p.u.size, W, H);
      gl.uniform1f(p.u.scroll, eased);
      gl.uniform1f(p.u.time, clock);
      gl.uniform1f(p.u.warpv, warp);
      gl.uniform1f(p.u.dirv, dirs);
      gl.uniform1f(p.u.still, calm ? 1 : 0);
      gl.drawElements(gl.TRIANGLES, GL.count, gl.UNSIGNED_SHORT, 0);
      gl.disableVertexAttribArray(p.a.corner);
      gl.disableVertexAttribArray(p.a.seed);
      gl.disableVertexAttribArray(p.a.star);
      gl.disableVertexAttribArray(p.a.extra);
    }

    if (shots.length) drawShotsGL();
  }

  function drawShotsGL() {
    var p = GL.shot, d = GL.shotData, k = 0;

    for (var i = 0; i < shots.length && i < 3; i++) {
      var s = shots[i];
      var tx = s.x - s.vx * s.len / 8, ty = s.y - s.vy * s.len / 8;
      var dx = tx - s.x, dy = ty - s.y;
      var m = Math.sqrt(dx * dx + dy * dy) || 1;
      var nx = -dy / m * 1.6, ny = dx / m * 1.6;
      d[k++] = s.x + nx;  d[k++] = s.y + ny;  d[k++] = 0; d[k++] = 1;
      d[k++] = s.x - nx;  d[k++] = s.y - ny;  d[k++] = 0; d[k++] = -1;
      d[k++] = tx - nx;   d[k++] = ty - ny;   d[k++] = 1; d[k++] = -1;
      d[k++] = tx + nx;   d[k++] = ty + ny;   d[k++] = 1; d[k++] = 1;
    }

    gl.useProgram(p.p);
    gl.bindBuffer(gl.ARRAY_BUFFER, GL.shotBuf);
    gl.bufferData(gl.ARRAY_BUFFER, d, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(p.a.p);
    gl.vertexAttribPointer(p.a.p, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(p.a.ta);
    gl.vertexAttribPointer(p.a.ta, 2, gl.FLOAT, false, 16, 8);
    gl.uniform2f(p.u.size, W, H);

    for (var j = 0; j < shots.length && j < 3; j++) {
      gl.uniform1f(p.u.alpha, shots[j].a * 0.95);
      gl.drawArrays(gl.TRIANGLE_FAN, j * 4, 4);
    }

    gl.disableVertexAttribArray(p.a.p);
    gl.disableVertexAttribArray(p.a.ta);
  }

  var ctx = null, neb = null, nebCtx = null;
  var HB = 6, AB = 7, NBK = HB * AB;
  var swatch = null, order = null, counts = null, band = null;
  var vy = null, va = null;

  var CLOUDS = [
    { x: .16, y: .12, r: .60, c: [ 71,  35, 169], a: .32 },
    { x: .84, y: .07, r: .46, c: [155,  60, 211], a: .24 },
    { x: .58, y: .44, r: .72, c: [ 50,  21, 117], a: .34 },
    { x: .06, y: .64, r: .54, c: [230,  55, 125], a: .10 },
    { x: .93, y: .74, r: .50, c: [230,  55, 125], a: .05 },
    { x: .38, y: .92, r: .56, c: [ 35,  21,  87], a: .32 },
    { x: .70, y: .20, r: .34, c: [110,  95, 200], a: .13 }
  ];

  function init2D() {
    ctx = canvas.getContext('2d', { alpha: false });
    swatch = [];
    for (var h = 0; h < HB; h++) {
      for (var a = 0; a < AB; a++) {
        var hue = 36 + (h + 0.5) * (300 - 36) / HB;
        var al = (a + 0.5) / AB;
        swatch.push('hsla(' + hue.toFixed(0) + ',82%,90%,' + al.toFixed(3) + ')');
      }
    }
    counts = new Int32Array(NBK + 1);
  }

  function alloc2D() {
    order = new Int32Array(n);
    band = new Int32Array(n);
    vy = new Float32Array(n);
    va = new Float32Array(n);
  }

  function buildCloudNebula() {
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

  function draw2D() {
    ctx.fillStyle = BASE_CSS;
    ctx.fillRect(0, 0, W, H);

    if (neb) {
      var ny = -eased * 0.04;
      var m = ny % H;
      ctx.drawImage(neb, 0, m - (m > 0 ? H : 0), W, H);
      ctx.drawImage(neb, 0, m + (m > 0 ? -H : 0) + H, W, H);
    }

    var i;
    counts.fill(0);

    for (i = 0; i < n; i++) {
      var z = pZ[i];
      var par = 0.06 + z * 0.85;
      var y = (pY[i] - eased * par) % H;
      vy[i] = y < 0 ? y + H : y;

      var tw = calm ? 0.85 : 0.62 + 0.38 * Math.sin(pPh[i] + clock * pTw[i] * 60);
      var a = (0.20 + z * 0.8) * tw;
      va[i] = a;

      var hb = ((pHue[i] - 36) * HB / (300 - 36)) | 0;
      if (hb < 0) hb = 0; else if (hb >= HB) hb = HB - 1;
      var ab = (a * AB) | 0;
      if (ab < 0) ab = 0; else if (ab >= AB) ab = AB - 1;

      var b = hb * AB + ab;
      band[i] = b;
      counts[b + 1]++;
    }

    for (i = 0; i < NBK; i++) counts[i + 1] += counts[i];
    for (i = 0; i < n; i++) order[counts[band[i]]++] = i;

    for (i = NBK; i > 0; i--) counts[i] = counts[i - 1];
    counts[0] = 0;

    for (var b2 = 0; b2 < NBK; b2++) {
      var from = counts[b2], to = b2 + 1 < NBK ? counts[b2 + 1] : n;
      if (from >= to) continue;
      ctx.fillStyle = swatch[b2];
      ctx.beginPath();
      for (var k = from; k < to; k++) {
        var s = order[k];
        var x = pX[s];
        if (!calm) {
          x = (x + clock * pDr[s] * 60) % W;
          if (x < 0) x += W;
        }
        ctx.moveTo(x + pR[s], vy[s]);
        ctx.arc(x, vy[s], pR[s], 0, 6.2832);
      }
      ctx.fill();
    }

    if (!calm) draw2DShots();
  }

  function draw2DShots() {
    for (var i = 0; i < shots.length; i++) {
      var s = shots[i];
      var tx = s.x - s.vx * s.len / 8, ty = s.y - s.vy * s.len / 8;
      var g = ctx.createLinearGradient(s.x, s.y, tx, ty);
      g.addColorStop(0, 'rgba(255,245,255,' + (s.a * .95).toFixed(3) + ')');
      g.addColorStop(.4, 'rgba(190,150,255,' + (s.a * .45).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(120,60,255,0)');
      ctx.strokeStyle = g;
      ctx.lineWidth = 1.6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(tx, ty);
      ctx.stroke();
    }
  }

  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width  = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    canvas.style.width  = W + 'px';
    canvas.style.height = H + 'px';

    buildStars();

    if (gl) {
      buildGLStars();
    } else {
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      alloc2D();
      buildCloudNebula();
    }
  }

  function degrade() {
    if (drops >= 2 || DPR <= DPR_FLOOR) return;
    drops++;
    DPR = Math.max(DPR_FLOOR, DPR * 0.8);
    canvas.width  = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    if (!gl) ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    if (!alive || document.hidden) { lastT = now; return; }

    var dt = lastT ? Math.min(now - lastT, 66) : 16.7;
    lastT = now;
    clock = (now - t0) / 1000;

    ticks++;
    if (dt > 24) slow++;
    if (ticks >= 120) {
      if (slow > 45) degrade();
      ticks = 0; slow = 0;
    }

    eased += (target - eased) * (calm ? 1 : 0.22);
    var dv = eased - prev;
    prev = eased;
    warp += (Math.min(Math.abs(dv), 90) - warp) * 0.14;
    if (dv > 0.01) dirs = 1; else if (dv < -0.01) dirs = -1;

    if (!calm) {
      if (Math.random() < 0.0022 && shots.length < 3) spawnShot();
      if (shots.length) stepShots();
    }

    if (gl) {
      if (WANT_NEB && !baked) {
        bakeStep(8);
        if (baked) uploadNebula();
      } else if (fade < 1) {
        fade += (1 - fade) * 0.06;
        if (fade > 0.998) fade = 1;
      }
      drawGL();
    } else {
      draw2D();
    }
  }

  DPR = Math.min(window.devicePixelRatio || 1, DPR_CAP);

  var usingGL = initGL();
  booted = true;
  if (usingGL) watchContext(); else init2D();

  resize();
  if (usingGL && WANT_NEB) initBake();

  target = eased = prev = window.scrollY || window.pageYOffset || 0;
  t0 = lastT = performance.now();

  var rt;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(resize, 160);
  });

  window.addEventListener('scroll', function () {
    target = window.scrollY || window.pageYOffset || 0;
  }, { passive: true });

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) lastT = 0;
  });

  requestAnimationFrame(frame);
})();
