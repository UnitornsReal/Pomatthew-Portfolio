(function () {
  'use strict';

  var C = window.CONFIG || {};
  var p = C.profile || {};
  var contact = C.contact || {};
  var socials = C.socials || {};

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

  if (p.avatar) {
    document.getElementById('avatar').src = p.avatar;
    document.getElementById('mark-pic').src = p.avatar;
  }
  if (p.username) {
    document.getElementById('mark-name').textContent = p.username;
    document.getElementById('avatar').alt = p.username;
  }

  var blurb = document.getElementById('blurb');
  if (p.blurb) blurb.textContent = p.blurb;
  else blurb.remove();

  var skills = document.getElementById('skills');
  if (C.skills && C.skills.length) {
    var label = document.createElement('b');
    label.textContent = 'Skills';
    skills.appendChild(label);
    C.skills.forEach(function (s, i) {
      if (i) {
        skills.appendChild(document.createTextNode(' '));
        var sep = document.createElement('i');
        sep.textContent = '/';
        skills.appendChild(sep);
        skills.appendChild(document.createTextNode(' '));
      }
      var span = document.createElement('span');
      span.textContent = s;
      skills.appendChild(span);
    });
  } else {
    skills.remove();
  }

  var warn = document.getElementById('warn');
  var dh = (socials.discord && socials.discord.handle || '').trim();
  if (dh) {
    var tag = document.createElement('b');
    tag.textContent = 'Discord: ' + dh;
    warn.appendChild(tag);
    warn.appendChild(document.createElement('br'));
    warn.appendChild(document.createTextNode('That is the only Discord account I use. If anyone else claims to be me, they are not.'));
  } else {
    warn.remove();
  }

  var ICONS = {
    x: 'M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z',
    linkedin: 'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z',
    discord: 'M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z',
    roblox: 'M18.926 23.998 0 18.892 5.075.002 24 5.108ZM15.222 12.13 9.945 10.71l-1.42 5.277 5.277 1.42Z'
  };
  var LABELS = { x: 'X / Twitter', linkedin: 'LinkedIn', discord: 'Discord', roblox: 'Roblox' };

  var socialBox = document.getElementById('socials');
  ['x', 'linkedin', 'discord', 'roblox'].forEach(function (key) {
    var s = socials[key];
    if (!s) return;
    var url = (s.url || '').trim();
    var node, tip;

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
      node.addEventListener('click', function () { copy(s.handle, 'Discord copied: ' + s.handle); });
    } else {
      return;
    }

    node.setAttribute('aria-label', LABELS[key]);
    node.dataset.tip = tip;
    node.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="' + ICONS[key] + '"/></svg>';
    socialBox.appendChild(node);
  });

  var cBlurb = document.getElementById('contact-blurb');
  if (contact.blurb) cBlurb.textContent = contact.blurb;
  else cBlurb.remove();

  var copyBtn = document.getElementById('mail-copy');
  if (contact.to) {
    document.getElementById('mail-copy-text').textContent = contact.to;
    copyBtn.addEventListener('click', function () { copy(contact.to, 'Email copied'); });
  } else {
    copyBtn.previousElementSibling.remove();
    copyBtn.remove();
  }

  var form = document.getElementById('contact-form');
  var status = document.getElementById('form-status');
  var sendBtn = document.getElementById('send-btn');

  function mailtoLink(v) {
    var body = 'Name: ' + v.name + '\nEmail: ' + v.email + '\n\n' + v.message + '\n';
    return 'mailto:' + contact.to +
      '?subject=' + encodeURIComponent('Message from ' + v.name) +
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
      else if (input.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(val)) msg = "That email doesn't look right.";
      else if (input.name === 'message' && val.length < 12) msg = 'A little more detail, please.';
      f.classList.toggle('bad', !!msg);
      if (err) err.textContent = msg;
      if (msg) ok = false;
    });
    return ok;
  }

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
      name: form.name.value.trim(),
      email: form.email.value.trim(),
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
        email: v.email,
        message: v.message,
        _subject: '[portfolio] Message from ' + v.name,
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
    .catch(function () {
      status.className = 'form-status no';
      status.innerHTML = 'Couldn\'t send that. <a href="' + mailtoLink(v) + '">Open it in your mail app instead</a> or write to ' + contact.to + '.';
    })
    .finally(function () {
      sendBtn.disabled = false;
      sendBtn.querySelector('span').textContent = 'Send message';
    });
  });
})();
