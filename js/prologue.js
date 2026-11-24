/* prologue.js — 开场：手机聊天界面回顾第一作 + 打字机旁白
 * Narrate.type(el, text)          打字机效果，点击/空格立即显示整句
 * Narrate.run(host, lines, opts)   逐句旁白，点击/空格推进；返回 Promise
 * Prologue.play(host)              完整开场，可随时"跳过"；返回 Promise
 */
(function (root) {
  'use strict';
  var U = root.U;

  /* 当前等待中的"推进"回调（点击或空格） */
  var advanceFn = null;
  function onAdvance(e) {
    if (!advanceFn) return;
    if (e.type === 'keydown') {
      if (e.key !== ' ' && e.key !== 'Enter') return;
      if (e.target && /INPUT|TEXTAREA|BUTTON/.test(e.target.tagName) && e.key === 'Enter') return;
      e.preventDefault();
    } else if (e.target && e.target.closest && e.target.closest('button, a')) return;
    var f = advanceFn; f();
  }
  document.addEventListener('keydown', onAdvance);
  document.addEventListener('click', onAdvance);

  var Narrate = {
    type: function (el, text, speed) {
      speed = speed || 38;
      return new Promise(function (resolve) {
        var i = 0, done = false, chars = Array.from(text);
        el.textContent = '';
        el.classList.add('typing');
        function finish() {
          if (done) return; done = true; clearInterval(t);
          el.textContent = text; el.classList.remove('typing'); advanceFn = null; resolve();
        }
        var t = setInterval(function () {
          i++;
          el.textContent = chars.slice(0, i).join('');
          if (i % 2 === 0 && root.Sfx) root.Sfx.play('tick');
          if (i >= chars.length) finish();
        }, U.reduced ? 5 : speed);
        advanceFn = finish;
      });
    },
    waitAdvance: function () {
      return new Promise(function (resolve) { advanceFn = function () { advanceFn = null; resolve(); }; });
    },
    cancel: function () { advanceFn = null; },
    run: function (host, list, opts) {
      opts = opts || {};
      var box = U.h('div', { class: 'narr ' + (opts.cls || '') });
      var p = U.h('p', { class: 'narr-line' });
      var hint = U.h('div', { class: 'narr-hint' }, '点击 / 空格 继续');
      box.appendChild(p); box.appendChild(hint); host.appendChild(box);
      var stopped = false, idx = 0;
      return new Promise(function (resolve) {
        Narrate._stop = function () { stopped = true; advanceFn = null; resolve(); };
        (function next() {
          if (stopped) return;
          if (idx >= list.length) { box.classList.add('out'); setTimeout(function () { box.remove(); resolve(); }, 400); return; }
          var line = list[idx++];
          p.className = 'narr-line ' + (line.cls || '');
          hint.style.opacity = 0;
          Narrate.type(p, line.t || line).then(function () {
            if (stopped) return;
            hint.style.opacity = 1;
            return Narrate.waitAdvance();
          }).then(next);
        })();
      });
    }
  };

  /* ---------- 第一作回顾：聊天记录 ---------- */
  var CHAT = [
    ['in', '亲，在吗？点赞关注就能领佣金，一单 3 元，日结哦～'],
    ['out', '真的假的？我试试。'],
    ['in', '恭喜！首日任务佣金 <b>¥1,200</b> 已到账 🎉'],
    ['in', '邀请您进入「VIP 任务群」，连单收益翻倍！需先垫付 ¥1,200'],
    ['in', '⚠ 系统检测到卡单，需补单 ¥5,000 才能解冻'],
    ['in', '⚠ 您的账户存在风险，需缴纳保证金 ¥8,000'],
    ['in', '最后一步啦：解冻金 ¥3,325。没钱的话可以先借个网贷周转一下哦～'],
    ['out', '我已经没钱了……能先把本金退给我吗？'],
    ['sys', '你已被移出群聊「VIP 任务群」']
  ];

  var Prologue = {
    play: function (host) {
      host.innerHTML = '';
      var stage = U.h('div', { class: 'prologue' });
      var skip = U.h('button', { class: 'btn ghost skip' }, '跳过开场 »');
      host.appendChild(stage); host.appendChild(skip);
      var skipped = false;
      return new Promise(function (resolve) {
        skip.addEventListener('click', function () { skipped = true; Narrate.cancel(); if (Narrate._stop) Narrate._stop(); end(); });
        function end() { if (end.d) return; end.d = true; host.innerHTML = ''; resolve(); }

        // 1) 手机聊天
        var phone = U.h('div', { class: 'phone' },
          '<div class="phone-top"><span>一年前</span><span class="ph-title">接待员-Rg</span><span>📶 ▮</span></div><div class="phone-chat"></div><div class="phone-foot">发消息…</div>');
        stage.appendChild(phone);
        var chat = U.$('.phone-chat', phone), i = 0;
        (function step() {
          if (skipped) return;
          if (i >= CHAT.length) { setTimeout(part2, 1300); return; }
          var m = CHAT[i++];
          var b = U.h('div', { class: 'pmsg ' + m[0] }, m[1]);
          chat.appendChild(b);
          chat.scrollTop = chat.scrollHeight;
          if (root.Sfx) root.Sfx.play(m[0] === 'sys' ? 'drop' : 'msg');
          setTimeout(step, U.reduced ? 150 : (m[0] === 'sys' ? 900 : 1050));
        })();

        // 2) 旁白
        function part2() {
          if (skipped) return;
          phone.classList.add('out');
          setTimeout(function () {
            if (skipped) return;
            stage.innerHTML = '';
            if (root.Music) root.Music.mood('sad');
            Narrate.run(stage, [
              '那一年，我刚毕业，投出去的简历都没有回音。',
              '一个"点赞返利"的兼职，第一天就给我返了 1,200 块。',
              '后来的事你大概猜得到——卡单、补单、保证金、解冻金。',
              { t: '我一共被骗走 ¥17,525。打了 14 天工，才把网贷还清。', cls: 'em' },
              { t: '一年后。', cls: 'big' },
              '民警老陈问我，愿不愿意来 96110 反诈热线值夜班。',
              '他说："你被骗过，所以你听得出他们是怎么说话的。"',
              '现在是晚上十一点。耳机里很安静。',
              { t: '——直到第一通电话打进来。', cls: 'em' }
            ]).then(end);
          }, 600);
        }
      });
    }
  };

  root.Narrate = Narrate;
  root.Prologue = Prologue;
})(this);
