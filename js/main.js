(function () {
  'use strict';

  var C = window.CONFIG || {};
  var calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var toastEl = document.getElementById('toast');
  var toastT;
  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(function () { toastEl.classList.remove('show'); }, 2400);
  }
  window.toast = toast;

  var nav = document.querySelector('.nav');
  window.addEventListener('scroll', function () {
    nav.classList.toggle('stuck', (window.scrollY || 0) > 24);
  }, { passive: true });
  nav.classList.toggle('stuck', (window.scrollY || 0) > 24);

  var io = new IntersectionObserver(function (rows) {
    rows.forEach(function (r) {
      if (r.isIntersecting) { r.target.classList.add('in'); io.unobserve(r.target); }
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });

  document.querySelectorAll('.reveal').forEach(function (n) {
    var sibs = Array.prototype.indexOf.call(n.parentElement.children, n);
    if (!n.style.getPropertyValue('--d')) {
      n.style.setProperty('--d', Math.min(sibs, 7) * 70 + 'ms');
    }
    io.observe(n);
  });

  var p = C.profile || {};

  var blurb = document.getElementById('blurb');
  if (blurb && p.blurb) blurb.textContent = p.blurb;

  var role = document.querySelector('[data-scramble]');
  if (role && p.role) role.textContent = p.role;

  var facts = document.getElementById('facts');
  if (facts && p.facts) {
    p.facts.forEach(function (f) {
      var d = document.createElement('div');
      d.className = 'fact';
      d.innerHTML = '<b></b><span></span>';
      d.querySelector('b').textContent = f.label;
      d.querySelector('span').textContent = f.value;
      facts.appendChild(d);
    });
  }

  if (p.avatar) {
    document.querySelectorAll('.portrait img, .nav-mark-pic img').forEach(function (img) {
      img.src = p.avatar;
    });
  }
  var portraitImg = document.querySelector('.portrait img');
  if (portraitImg && p.username) portraitImg.alt = p.username;

  var mark = document.querySelector('.nav-mark-text');
  if (mark && p.username) mark.textContent = p.username;
  var h1 = document.querySelector('.h1-name');
  if (h1 && p.username) h1.textContent = p.username;

  if (role && !calm) {
    var CHARS = '01<>[]{}/|+=*#%&';
    var target = role.textContent;
    var frame = 0, queue = [], raf;

    function step() {
      var out = '', done = 0;
      for (var i = 0; i < queue.length; i++) {
        var q = queue[i];
        if (frame >= q.end) { done++; out += q.to; }
        else if (frame >= q.start) {
          if (!q.c || Math.random() < 0.28) q.c = CHARS[Math.floor(Math.random() * CHARS.length)];
          out += '<i style="opacity:.5;font-style:normal">' + q.c + '</i>';
        } else out += q.to === ' ' ? ' ' : '';
      }
      role.innerHTML = out;
      if (done < queue.length) { frame++; raf = requestAnimationFrame(step); }
      else role.textContent = target;
    }

    function scramble() {
      queue = [];
      for (var i = 0; i < target.length; i++) {
        queue.push({
          to: target[i],
          start: Math.floor(Math.random() * 14),
          end: Math.floor(Math.random() * 30) + 14,
          c: null
        });
      }
      frame = 0;
      cancelAnimationFrame(raf);
      step();
    }

    var ro = new IntersectionObserver(function (rows) {
      if (rows[0].isIntersecting) { scramble(); ro.disconnect(); }
    }, { threshold: 0.5 });
    ro.observe(role);
  }

  var skillBox = document.getElementById('skills');
  if (skillBox && C.skills) {
    C.skills.forEach(function (s) {
      var li = document.createElement('li');
      var span = document.createElement('span');
      span.className = 'skill';
      span.textContent = s;
      li.appendChild(span);
      skillBox.appendChild(li);
    });
  }

  var ICONS = {
    x: 'M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z',
    linkedin: 'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z',
    discord: 'M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z',
    roblox: 'M18.926 23.998 0 18.892 5.075.002 24 5.108ZM15.222 12.13 9.945 10.71l-1.42 5.277 5.277 1.42Z'
  };

  var LABELS = { x: 'X / Twitter', linkedin: 'LinkedIn', discord: 'Discord', roblox: 'Roblox' };

  function icon(key) {
    return '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">' +
           '<path fill="currentColor" d="' + ICONS[key] + '"/></svg>';
  }

  function copy(text, note) {
    function done() { toast(note || 'Copied'); }
    function legacy() {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); done(); } catch (e) { toast(text); }
      ta.remove();
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, legacy);
    } else legacy();
  }

  var socialBox = document.getElementById('socials');
  var contact = C.contact || {};
  var socials = C.socials || {};

  if (socialBox) {
    ['x', 'linkedin', 'discord', 'roblox'].forEach(function (key) {
      var s = socials[key];
      if (!s) return;

      var node, tip;
      var url = (s.url || '').trim();

      if (url) {
        node = document.createElement('a');
        node.href = url;
        node.target = '_blank';
        node.rel = 'noopener noreferrer';
        node.className = 'social';
        tip = LABELS[key] + (s.handle ? ' · ' + s.handle : '');

      } else if (key === 'discord' && s.handle) {
        node = document.createElement('button');
        node.type = 'button';
        node.className = 'social';
        tip = 'Discord · ' + s.handle + ' (click to copy)';
        node.addEventListener('click', function () {
          copy(s.handle, 'Discord copied: ' + s.handle);
        });

      } else {
        node = document.createElement('span');
        node.className = 'social unset';
        node.setAttribute('aria-disabled', 'true');
        tip = LABELS[key];
      }

      node.setAttribute('aria-label', LABELS[key]);
      node.dataset.tip = tip;
      node.innerHTML = icon(key);
      socialBox.appendChild(node);
    });
  }

  var handleNote = document.getElementById('handle-note');
  if (handleNote) {
    var dh = (socials.discord && socials.discord.handle || '').trim();
    if (dh) {
      var tag = document.createElement('b');
      tag.textContent = 'Discord: ' + dh;
      handleNote.appendChild(tag);
      handleNote.appendChild(document.createTextNode(
        'That is the only discord account I use. If anyone else claims to be me, they are not.'));
    } else {
      handleNote.remove();
    }
  }

  var cBlurb = document.getElementById('contact-blurb');
  if (cBlurb) cBlurb.textContent = contact.blurb || '';

  var copyBtn = document.getElementById('mail-copy');
  var copyTxt = document.getElementById('mail-copy-text');
  if (copyBtn && contact.to) {
    copyTxt.textContent = contact.to;
    copyBtn.addEventListener('click', function () { copy(contact.to, 'Email copied'); });
  } else if (copyBtn) {
    copyBtn.parentElement.style.display = 'none';
  }

  var form   = document.getElementById('contact-form');
  var status = document.getElementById('form-status');
  var sendBtn = document.getElementById('send-btn');

  function mailtoLink(v) {
    var body =
      'Name: ' + v.name + '\n' +
      (v.company ? 'Company: ' + v.company + '\n' : '') +
      'Email: ' + v.email + '\n\n' +
      v.message + '\n';
    return 'mailto:' + contact.to +
      '?subject=' + encodeURIComponent(v.subject) +
      '&body=' + encodeURIComponent(body);
  }

  function validate() {
    var ok = true;
    form.querySelectorAll('.field').forEach(function (f) {
      var input = f.querySelector('input, textarea');
      if (!input || !input.required) return;
      var err = f.querySelector('.err');
      var val = input.value.trim();
      var msg = '';

      if (!val) msg = 'Required.';
      else if (input.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(val))
        msg = "That email doesn't look right.";
      else if (input.name === 'message' && val.length < 12)
        msg = 'A little more detail, please.';

      f.classList.toggle('bad', !!msg);
      if (err) err.textContent = msg;
      if (msg) ok = false;
    });
    return ok;
  }

  if (form) {
    form.addEventListener('input', function (e) {
      var f = e.target.closest('.field');
      if (f && f.classList.contains('bad')) f.classList.remove('bad');
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      status.className = 'form-status';
      status.textContent = '';

      if (form._honey.value) return;
      if (!validate()) {
        status.className = 'form-status no';
        status.textContent = 'Check the highlighted fields.';
        return;
      }

      var v = {
        name:    form.name.value.trim(),
        company: form.company.value.trim(),
        email:   form.email.value.trim(),
        subject: form.subject.value.trim(),
        message: form.message.value.trim()
      };

      if (!contact.to) {
        status.className = 'form-status no';
        status.textContent = 'The form is not wired up yet.';
        return;
      }

      if (contact.mode === 'mailto') {
        window.location.href = mailtoLink(v);
        status.className = 'form-status ok';
        status.textContent = 'Opening your mail app...';
        return;
      }

      sendBtn.disabled = true;
      sendBtn.querySelector('span').textContent = 'Sending...';

      fetch('https://formsubmit.co/ajax/' + encodeURIComponent(contact.to), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          name: v.name,
          company: v.company || '—',
          email: v.email,
          subject: v.subject,
          message: v.message,
          _subject: '[portfolio] ' + v.subject,
          _template: 'table',
          _captcha: 'false'
        })
      })
      .then(function (r) { return r.json().catch(function () { return {}; }); })
      .then(function (j) {
        if (String(j.success) !== 'true') throw new Error(j.message || 'rejected');
        status.className = 'form-status ok';
        status.textContent = 'Sent. I\'ll get back to you.';
        form.reset();
      })
      .catch(function (err) {
        if (window.console && console.warn) {
          console.warn('Contact form: ' + ((err && err.message) || 'send failed'));
        }
        status.className = 'form-status no';
        status.innerHTML =
          'Couldn\'t send that. <a href="' + mailtoLink(v) + '">Open it in your mail app instead</a> ' +
          'or write to ' + contact.to + '.';
      })
      .finally(function () {
        sendBtn.disabled = false;
        sendBtn.querySelector('span').textContent = 'Send message';
      });
    });
  }

  document.addEventListener('keydown', function (e) {
    var tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea') return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    if (e.key === 'g' || e.key === 'G') {
      var other = document.querySelector('.view-toggle button:not(.on)');
      if (other) other.click();
    }
  });
})();
