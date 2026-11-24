/* util.js — 小工具：DOM、弹窗、提示、存档（localStorage 全部包在 try/catch 里） */
(function (root) {
  'use strict';
  var U = {};

  U.$ = function (sel, el) { return (el || document).querySelector(sel); };
  U.$$ = function (sel, el) { return Array.prototype.slice.call((el || document).querySelectorAll(sel)); };
  U.h = function (tag, attrs, html) {
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === 'class') e.className = attrs[k];
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), attrs[k]);
      else e.setAttribute(k, attrs[k]);
    }
    if (html != null) e.innerHTML = html;
    return e;
  };
  U.esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  U.fmt = function (n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); };
  U.wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  U.clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };

  /* 偏好"减少动态效果"时缩短动画 */
  U.reduced = false;
  try { U.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  /* ---------- 存档 ---------- */
  var KEY = 'f96110.save.v1', META = 'f96110.meta.v1';
  var memory = {};               // 存储不可用时的内存后备
  U.storageOk = (function () { try { var k = '__t'; localStorage.setItem(k, '1'); localStorage.removeItem(k); return true; } catch (e) { return false; } })();
  function get(k) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : (memory[k] || null); } catch (e) { return memory[k] || null; } }
  function set(k, v) { memory[k] = v; try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function del(k) { delete memory[k]; try { localStorage.removeItem(k); } catch (e) {} }

  U.Store = {
    load: function () { return get(KEY); },
    save: function (s) { set(KEY, s); },
    clear: function () { del(KEY); },
    meta: function () { return get(META) || { ach: {}, sound: true, endings: {}, plays: 0 }; },
    setMeta: function (m) { set(META, m); }
  };

  /* ---------- 提示 ---------- */
  U.toast = function (html, kind, ms) {
    var box = U.$('#toasts');
    if (!box) { box = U.h('div', { id: 'toasts', 'aria-live': 'polite' }); document.body.appendChild(box); }
    var t = U.h('div', { class: 'toast ' + (kind || '') }, html);
    box.appendChild(t);
    requestAnimationFrame(function () { t.classList.add('in'); });
    setTimeout(function () { t.classList.remove('in'); setTimeout(function () { t.remove(); }, 400); }, ms || 2600);
  };

  /* ---------- 弹窗 ----------
   * U.modal({title, html, buttons:[{label, value, primary}], dismiss:true}) → Promise<value>
   */
  U.modal = function (opt) {
    return new Promise(function (resolve) {
      var wrap = U.h('div', { class: 'modal-wrap', role: 'dialog', 'aria-modal': 'true' });
      var box = U.h('div', { class: 'modal ' + (opt.cls || '') });
      if (opt.title) box.appendChild(U.h('h2', null, opt.title));
      var body = U.h('div', { class: 'modal-body' }, opt.html || '');
      box.appendChild(body);
      var btns = U.h('div', { class: 'modal-btns' });
      (opt.buttons || [{ label: '好的', value: true, primary: true }]).forEach(function (b, i) {
        var el = U.h('button', { class: 'btn ' + (b.primary ? 'primary' : '') }, (opt.buttons && opt.buttons.length > 1 ? '<kbd>' + (i + 1) + '</kbd>' : '') + b.label);
        el.addEventListener('click', function () { close(b.value); });
        btns.appendChild(el);
      });
      box.appendChild(btns);
      wrap.appendChild(box);
      document.body.appendChild(wrap);
      requestAnimationFrame(function () { wrap.classList.add('in'); });
      var first = btns.querySelector('.primary') || btns.querySelector('button');
      if (first) setTimeout(function () { first.focus(); }, 30);
      function key(e) {
        var n = parseInt(e.key, 10);
        if (n >= 1 && n <= (opt.buttons || [1]).length) { e.preventDefault(); e.stopPropagation(); close((opt.buttons || [{ value: true }])[n - 1].value); }
        else if (e.key === 'Escape' && opt.dismiss !== false) { e.stopPropagation(); close(null); }
      }
      document.addEventListener('keydown', key, true);
      if (opt.dismiss !== false) wrap.addEventListener('click', function (e) { if (e.target === wrap) close(null); });
      if (opt.onOpen) opt.onOpen(body, close);
      var done = false;
      function close(v) {
        if (done) return; done = true;
        document.removeEventListener('keydown', key, true);
        wrap.classList.remove('in');
        setTimeout(function () { wrap.remove(); }, 250);
        resolve(v);
      }
    });
  };

  /* 可复现的伪随机 */
  U.rng = function (seed) {
    var s = seed >>> 0 || 1;
    return function () { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; };
  };

  root.U = U;
})(this);
