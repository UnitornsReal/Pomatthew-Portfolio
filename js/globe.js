window.Globe = (function () {
  'use strict';

  var GOLDEN = Math.PI * (3 - Math.sqrt(5));
  var calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function Globe(stage, layer, opt) {
    opt = opt || {};

    this.stage = stage;
    this.layer = layer;
    this.items = [];

    this.yaw   = 0.35;
    this.pitch = -0.10;
    this.vy = 0;
    this.vp = 0;

    this.rx = this.rz = 260;
    this.ry = 150;
    this.autoSpin = calm ? 0 : (opt.autoSpin != null ? opt.autoSpin : 0.0020);

    this.dragging = false;
    this.running = false;
    this.spawn = 0;
    this.raf = null;

    this._bind();
  }

  Globe.prototype.setItems = function (els, keep) {
    this.items = els.map(function (el, i) {
      return { el: el, i: i, v: { x: 0, y: 0, z: 0 }, delay: i * 0.05 };
    });
    this._lattice();
    if (!keep) this.spawn = 0;
    this.measure();
    this._draw();
  };

  Globe.prototype._lattice = function () {
    var n = this.items.length;
    for (var i = 0; i < n; i++) {
      var y = n === 1 ? 0 : 1 - (i / (n - 1)) * 2;
      var r = Math.sqrt(Math.max(0, 1 - y * y));
      var th = i * GOLDEN;
      this.items[i].v = { x: Math.cos(th) * r, y: y, z: Math.sin(th) * r };
    }
  };

  Globe.prototype.measure = function () {
    var w = this.stage.clientWidth  || 800;
    var h = this.stage.clientHeight || 520;
    var n = Math.max(this.items.length, 1);

    var cw = Math.round(Math.max(Math.min(108, w * 0.30), Math.min(176, 460 / Math.sqrt(n), w * 0.185)));
    this.stage.style.setProperty('--gcard', cw + 'px');

    var first = this.items[0] && this.items[0].el;
    var ch = (first && first.offsetHeight) || Math.round(cw * 1.45);

    var want = 96 + Math.sqrt(n) * 112;
    var room = w * 0.5 - cw * 0.62;

    this.rx = this.rz = Math.max(Math.min(110, room), Math.min(want, room, 520));
    this.ry = Math.max(58, Math.min(want * 0.60, h * 0.5 - ch * 0.62));

    var planet = Math.min(this.rx * 2.1, h * 0.96, w * 0.86);
    this.stage.style.setProperty('--gsize', Math.round(planet) + 'px');
  };

  Globe.prototype._draw = function () {
    var cy = Math.cos(this.yaw),   sy = Math.sin(this.yaw);
    var cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);

    for (var i = 0; i < this.items.length; i++) {
      var it = this.items[i], v = it.v;

      var x1 =  v.x * cy + v.z * sy;
      var z1 = -v.x * sy + v.z * cy;
      var y1 =  v.y;

      var y2 = y1 * cp - z1 * sp;
      var z2 = y1 * sp + z1 * cp;

      var g = Math.max(0, Math.min(1, (this.spawn - it.delay) / 0.45));
      var e = 1 - Math.pow(1 - g, 3);

      var depth = (z2 + 1) / 2;
      var op = (0.26 + depth * 0.74) * e;

      it.el.style.transform =
        'translate3d(' + (x1 * this.rx * e).toFixed(2) + 'px,' +
                         (y2 * this.ry * e).toFixed(2) + 'px,' +
                         (z2 * this.rz * e).toFixed(2) + 'px)';
      it.el.style.opacity = op.toFixed(3);
      it.el.style.pointerEvents = z2 < -0.08 ? 'none' : 'auto';
    }
  };

  Globe.prototype._tick = function () {
    if (!this.running) return;

    if (this.spawn < 1.6) this.spawn += 0.024;

    if (!this.dragging) {
      this.yaw   += this.vy;
      this.pitch += this.vp;

      this.vy *= 0.945;
      this.vp *= 0.945;
      if (Math.abs(this.vy) < 0.00012) this.vy = 0;
      if (Math.abs(this.vp) < 0.00012) this.vp = 0;

      this.pitch += (0 - this.pitch) * 0.012;
      if (!this.vy) this.yaw += this.autoSpin;
    }

    this._draw();
    this.raf = requestAnimationFrame(this._tick.bind(this));
  };

  Globe.prototype._bind = function () {
    var self = this;
    var id = null, lx = 0, ly = 0, moved = 0;

    function down(e) {
      if (e.button != null && e.button !== 0) return;
      id = e.pointerId;
      lx = e.clientX; ly = e.clientY; moved = 0;
      self.dragging = true;
      self.stage.classList.add('dragging');
      self.stage.setPointerCapture && self.stage.setPointerCapture(id);
    }

    function move(e) {
      if (!self.dragging || e.pointerId !== id) return;
      var dx = e.clientX - lx, dy = e.clientY - ly;
      lx = e.clientX; ly = e.clientY;
      moved += Math.abs(dx) + Math.abs(dy);

      self.yaw   += dx * 0.0068;
      self.pitch += dy * 0.0050;
      self.pitch = Math.max(-1.05, Math.min(1.05, self.pitch));

      self.vy = dx * 0.0068;
      self.vp = dy * 0.0050;

      self._draw();
      if (moved > 10) self.stage.dispatchEvent(new CustomEvent('globe:drag'));
    }

    function up() {
      if (!self.dragging) return;
      self.dragging = false;
      self.stage.classList.remove('dragging');
      try { self.stage.releasePointerCapture(id); } catch (err) {}
      self.lastWasDrag = moved > 8;
      id = null;
    }

    this.stage.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);

    this.stage.addEventListener('keydown', function (e) {
      var k = e.key;
      if (k === 'ArrowLeft')  { self.vy = -0.03; e.preventDefault(); }
      if (k === 'ArrowRight') { self.vy =  0.03; e.preventDefault(); }
      if (k === 'ArrowUp')    { self.vp = -0.02; e.preventDefault(); }
      if (k === 'ArrowDown')  { self.vp =  0.02; e.preventDefault(); }
    });

    var rt;
    window.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(function () {
        self.measure();
        if (self.running) self._draw();
      }, 150);
    });
  };

  Globe.prototype.start = function () {
    if (this.running) return;
    this.running = true;
    this.measure();
    this.raf = requestAnimationFrame(this._tick.bind(this));
  };

  Globe.prototype.stop = function () {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = null;
  };

  Globe.prototype.replay = function () { this.spawn = 0; };

  return Globe;
})();
