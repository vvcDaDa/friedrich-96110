/* game.js — 场景流程与界面
 * 标题 → 开场 → [夜班开场 → 来电 → 通话 × N → 夜班结算 → 白天(新闻/线索墙/话术)] × 7 → 结局
 */
(function (root) {
  'use strict';
  var U = root.U, E = root.Engine, S = root.STORY, CM = root.CASE_MAP, Art = root.Art, Sfx = root.Sfx, Music = root.Music;
  var $ = U.$, h = U.h, esc = U.esc, fmt = U.fmt;

  var scr, G = null, meta = U.Store.meta();
  var busy = false, fast = false, mode = 'root', ringTimer = null, keyHandler = null;

  /* ---------- 状态 ---------- */
  function newGame() {
    return { v: 1, night: 1, phase: 'intro', idx: 0, saved: 0, lost: 0, maxSaved: 0, rep: 60, mis: 0,
      results: {}, bank: [], links: [], linkPairs: {}, skills: [], spLeft: 0, call: null, log: [],
      stats: { family: 0, freeze: 0, hangup: 0 }, nightRes: [], wallTries: 3, nightStart: null };
  }
  function nightDef() { return S.NIGHTS[G.night - 1]; }
  function curCase() { return CM[nightDef().cases[G.idx]]; }
  function spFor() { return (nightDef().sp || 2) + (G.skills.indexOf('extra') >= 0 ? 1 : 0); }
  function ctx() { return { skills: G.skills, links: G.links, sp: G.spLeft }; }
  function save() { if (G) U.Store.save(G); }
  function saveMeta() { U.Store.setMeta(meta); }

  function setKeys(fn) { keyHandler = fn; }
  document.addEventListener('keydown', function (e) {
    if (document.querySelector('.modal-wrap')) return;
    if (busy && (e.key === ' ' || e.key === 'Enter')) { fast = true; e.preventDefault(); return; }
    if (keyHandler) keyHandler(e);
  });

  function go(html, cls) {
    stopRing();
    root.Narrate.cancel();
    setKeys(null);
    scr.className = 'screen ' + (cls || '');
    scr.innerHTML = html || '';
    scr.scrollTop = 0;
    window.scrollTo(0, 0);
  }

  function unlock(id) {
    if (meta.ach[id]) return;
    meta.ach[id] = Date.now(); saveMeta();
    var a = S.ACH.filter(function (x) { return x.id === id; })[0];
    if (a) { U.toast('🏆 成就解锁：<b>' + esc(a.n) + '</b>', 'gold', 3500); Sfx.play('win'); }
  }

  /* ======================= 标题 ======================= */
  function title() {
    Music.mood('calm');
    var sv = U.Store.load();
    var canContinue = sv && sv.v === 1 && sv.phase !== 'done';
    go('<div class="title-screen"><div class="sky">' + Art.skyline(96110) + '</div>' +
      '<div class="title-box">' +
      '<div class="pre">Friedrich 打工记 · 续</div>' +
      '<h1><span class="num">96110</span><span class="ye">夜班</span></h1>' +
      '<p class="tagline">一年前，我被骗走了 ¥17,525。<br>现在，我坐在电话的这一头。</p>' +
      '<div class="menu">' +
      (canContinue ? '<button class="btn primary" data-a="cont"><kbd>1</kbd>继续游戏<small>第 ' + sv.night + ' 夜</small></button>' : '') +
      '<button class="btn ' + (canContinue ? '' : 'primary') + '" data-a="new"><kbd>' + (canContinue ? 2 : 1) + '</kbd>新游戏</button>' +
      '<button class="btn" data-a="ach"><kbd>' + (canContinue ? 3 : 2) + '</kbd>成就</button>' +
      '<button class="btn" data-a="learn"><kbd>' + (canContinue ? 4 : 3) + '</kbd>反诈小课堂</button>' +
      '</div>' +
      (U.storageOk ? '' : '<p class="warn">⚠ 浏览器存储不可用，本次游戏无法存档，但可以正常游玩。</p>') +
      '<p class="credit">本作人物、机构、平台均为虚构 · 遇到诈骗请拨打 110，咨询请拨打 96110</p>' +
      '</div></div>', 'title');
    var btns = U.$$('.menu .btn', scr);
    btns.forEach(function (b) { b.addEventListener('click', function () { Sfx.play('click'); menuAct(b.getAttribute('data-a'), sv); }); });
    setKeys(function (e) { var n = parseInt(e.key, 10); if (n >= 1 && n <= btns.length) btns[n - 1].click(); });
  }
  function menuAct(a, sv) {
    root.Sound.unlock();
    if (a === 'cont') { G = sv; resume(); }
    else if (a === 'new') {
      var start = function () {
        G = newGame(); G.spLeft = spFor(); save();
        meta.plays = (meta.plays || 0) + 1; saveMeta();
        go('', 'prologue-screen');
        root.Prologue.play(scr).then(nightIntro);
      };
      if (sv && sv.phase !== 'done') U.modal({ title: '开始新游戏？', html: '<p>当前存档（第 ' + sv.night + ' 夜）会被覆盖。</p>', buttons: [{ label: '开始新游戏', value: 1, primary: true }, { label: '算了', value: 0 }] }).then(function (v) { if (v) start(); });
      else start();
    }
    else if (a === 'ach') showAch();
    else if (a === 'learn') showKnowledge();
  }
  function showAch() {
    var html = '<div class="ach-grid">' + S.ACH.map(function (a) {
      var on = meta.ach[a.id];
      return '<div class="ach ' + (on ? 'on' : '') + '"><span class="ic">' + (on ? a.icon : '🔒') + '</span><b>' + esc(a.n) + '</b><small>' + esc(a.d) + '</small></div>';
    }).join('') + '</div>';
    var ends = Object.keys(meta.endings || {});
    html += '<p class="dim">已达成结局：' + (ends.length ? ends.map(function (k) { return '「' + S.ENDINGS[k].title + '」'; }).join(' ') : '暂无') + '</p>';
    U.modal({ title: '成就', html: html, cls: 'wide' });
  }
  function knowledgeHTML() {
    return '<div class="know">' + S.KNOWLEDGE.map(function (k) { return '<div class="kn"><b>' + esc(k[0]) + '</b><p>' + esc(k[1]) + '</p></div>'; }).join('') + '</div>';
  }
  function showKnowledge() { U.modal({ title: '反诈小课堂', html: knowledgeHTML(), cls: 'wide' }); }

  function resume() {
    var p = G.phase;
    if (p === 'intro') nightIntro();
    else if (p === 'ring') ringCall();
    else if (p === 'call') renderCall(true);
    else if (p === 'callEnd') nextCall();
    else if (p === 'summary') nightSummary();
    else if (p === 'news') dayNews();
    else if (p === 'wall') dayWall();
    else if (p === 'skill') daySkill();
    else if (p === 'ending') ending();
    else title();
  }

  /* ======================= 夜班开场 ======================= */
  function nightIntro() {
    G.phase = 'intro'; G.idx = 0; G.call = null; G.log = []; G.nightRes = [];
    G.spLeft = spFor();
    G.nightStart = { saved: G.saved, lost: G.lost, rep: G.rep, bank: G.bank.length, mis: G.mis };
    save();
    Music.mood('calm');
    var N = nightDef();
    go('<div class="room-wrap">' + Art.dutyRoom(G.night) + '</div>' +
      '<div class="night-badge">第 ' + G.night + ' 夜<small>共 7 夜</small></div>' +
      '<div class="intro-text"></div>' +
      '<div class="intro-foot"><button class="btn ghost" data-a="skip">跳过 »</button></div>', 'night-intro');
    var box = $('.intro-text', scr), done = false;
    function next() {
      if (done) return; done = true; root.Narrate.cancel();
      if (root.Narrate._stop) root.Narrate._stop();
      ringCall();
    }
    $('[data-a=skip]', scr).addEventListener('click', next);
    var lines = N.intro.slice(1);
    root.Narrate.run(box, lines).then(function () {
      if (done) return;
      box.innerHTML = '';
      var b = h('button', { class: 'btn primary big' }, '<kbd>1</kbd>戴上耳机，开始值班');
      b.addEventListener('click', next);
      box.appendChild(b); b.focus();
      setKeys(function (e) { if (e.key === '1') next(); });
    });
  }

  /* ======================= 来电 ======================= */
  function stopRing() { if (ringTimer) { clearInterval(ringTimer); ringTimer = null; } }
  function ringCall() {
    G.phase = 'ring'; save();
    var N = nightDef(), cs = curCase();
    var isBoss = !!cs.boss;
    go('<div class="room-wrap dim">' + Art.dutyRoom(G.night) + '</div>' +
      '<div class="ring-card ' + (isBoss ? 'boss' : '') + '">' +
      '<div class="ring-phone">' + (isBoss ? Art.shadow() : '<div class="ring-ic">📞</div>') + '</div>' +
      '<div class="ring-info"><small>第 ' + G.night + ' 夜 · 第 ' + (G.idx + 1) + ' / ' + N.cases.length + ' 通</small>' +
      '<b>' + (isBoss ? '内线来电 · 号码隐藏' : '96110 热线 · 市民来电') + '</b>' +
      '<span>' + esc(cs.ringHint || '来电中……') + '</span></div>' +
      '<button class="btn primary big answer"><kbd>1</kbd>接听</button></div>', 'ring');
    Music.mood(isBoss ? 'tense' : 'off');
    Sfx.play('ring');
    ringTimer = setInterval(function () { Sfx.play('ring'); }, 2200);
    var answered = false;
    function answer() { if (answered) return; answered = true; stopRing(); Sfx.play('click'); startCall(); }
    $('.answer', scr).addEventListener('click', answer);
    setKeys(function (e) { if (e.key === '1' || e.key === ' ' || e.key === 'Enter') { e.preventDefault(); answer(); } });
  }

  /* ======================= 通话 ======================= */
  var CLUE_IC = { key: '🔍', acct: '🏦', family: '👪', proof: '✅', gang: '🕸️', line: '📱' };

  function startCall() {
    var cs = curCase();
    var r = E.newCall(cs, ctx());
    G.call = r.st; G.log = []; G.phase = 'call';
    renderCall(false);
    busy = true;
    play(r.out).then(function () { busy = false; mode = 'root'; renderActions(); save(); });
  }

  function renderCall(replay) {
    var cs = curCase(), st = G.call, c = cs.caller, N = nightDef();
    var lab = cs.labels || {};
    lastVals = {};
    Music.mood(cs.boss ? 'tense' : 'calm');
    go('<div class="call ' + (cs.boss ? 'boss' : '') + '">' +
      '<aside class="caller-pane">' +
      '<div class="cp-av">' + (cs.avatar === 'shadow' ? Art.shadow() : Art.person(c.av)) + '</div>' +
      '<div class="cp-main"><div class="cp-name">' + esc(c.name) + '<small>' + (c.age ? c.age + ' 岁' : '') + '</small></div>' +
      '<div class="cp-role">' + esc(c.role) + '</div>' +
      '<div class="cp-tags">' + (c.tags || []).map(function (t) { return '<span>' + esc(t) + '</span>'; }).join('') + '</div>' +
      '<p class="cp-bio">' + esc(c.bio || '') + '</p></div>' +
      '<div class="cp-me"><div class="me-av">' + Art.friedrich('calm') + '</div><div><b>Friedrich</b><small>96110 夜班接线员</small></div></div>' +
      '</aside>' +
      '<section class="center">' +
      '<div class="hud"><span>第 ' + G.night + ' 夜 · ' + (G.idx + 1) + '/' + N.cases.length + '</span><span>口碑 <b>' + G.rep + '</b></span>' +
      '<button class="btn tiny clue-toggle" aria-label="打开线索板">🗂 线索 <b class="cc">0</b></button></div>' +
      '<div class="meters">' +
      meterHTML('trust', lab.trust || '信任度', st.trust) +
      meterHTML('pressure', lab.pressure || '施压度', st.pressure) +
      '<div class="meter-row"><div class="prog"><label>' + esc(lab.prog || '劝阻进度') + '</label><span class="pips"></span></div>' +
      '<div class="turns"><label>剩余回合</label><b class="tl">' + st.turnsLeft + '</b></div></div>' +
      '</div>' +
      '<div class="log" aria-live="polite"></div>' +
      '<div class="actions"></div>' +
      '</section>' +
      '<aside class="clue-pane"><div class="clue-head"><h3>线索板</h3><button class="btn tiny close-clues" aria-label="关闭">✕</button></div>' +
      '<div class="clues"><p class="empty">还没有线索。多问几句。</p></div>' +
      '<button class="btn judge-btn">⚖ 根据线索做判断</button></aside>' +
      '</div>', 'call-screen');
    $('.clue-toggle', scr).addEventListener('click', function () { $('.clue-pane', scr).classList.toggle('open'); });
    $('.close-clues', scr).addEventListener('click', function () { $('.clue-pane', scr).classList.remove('open'); });
    $('.judge-btn', scr).addEventListener('click', function () { if (busy || G.call.over) return; $('.clue-pane', scr).classList.remove('open'); mode = 'judge'; renderActions(); });
    $('.log', scr).addEventListener('click', function () { if (busy) fast = true; });
    updateMeters({ trust: st.trust, pressure: st.pressure, prog: st.prog, need: st.need, turns: st.turnsLeft }, false);
    st.clues.forEach(function (id) { addClueCard(id, false); });
    if (replay) {
      G.log.forEach(function (l) { addLineNow(l); });
      mode = 'root'; renderActions();
      if (st.over) endCall();
    }
    setKeys(callKeys);
  }

  function meterHTML(k, label, v) {
    return '<div class="meter ' + k + '"><label>' + esc(label) + '</label><div class="bar"><i style="width:' + v + '%"></i><em></em></div><b class="val">' + v + '</b></div>';
  }

  function setFace(expr) { var m = $('.me-av', scr); if (m) m.innerHTML = Art.friedrich(expr); }

  var lastVals = {};
  function updateMeters(e, anim) {
    var cs = curCase();
    ['trust', 'pressure'].forEach(function (k) {
      var m = $('.meter.' + k, scr); if (!m) return;
      var v = e[k], old = lastVals[k] == null ? v : lastVals[k];
      $('i', m).style.width = v + '%';
      tween($('.val', m), old, v, anim ? 500 : 0);
      if (k === 'pressure') m.classList.toggle('danger', v >= 70);
      if (k === 'trust') m.classList.toggle('danger', v <= 25);
      if (anim && v !== old) {
        var d = v - old, fl = h('span', { class: 'float ' + (d > 0 ? 'up' : 'down') }, (d > 0 ? '+' : '') + d);
        m.appendChild(fl); setTimeout(function () { fl.remove(); }, 1200);
      }
      lastVals[k] = v;
    });
    if (anim && e.dt <= -15) trustShock();
    var pips = $('.pips', scr);
    if (pips) {
      var s = '';
      for (var i = 0; i < e.need; i++) s += '<i class="' + (i < e.prog ? 'on' : '') + '"></i>';
      pips.innerHTML = s;
      if (anim && e.dg > 0) { pips.classList.remove('pop'); void pips.offsetWidth; pips.classList.add('pop'); }
    }
    var tl = $('.tl', scr); if (tl) { tl.textContent = e.turns; tl.parentNode.classList.toggle('danger', e.turns <= 2); }
    if (!cs.boss && G.phase === 'call' && !(G.call && G.call.over)) Music.mood(e.pressure >= 60 ? 'tense' : 'calm');
  }
  function tween(el, a, b, ms) {
    if (!ms || U.reduced) { el.textContent = b; return; }
    var t0 = performance.now();
    (function f(t) { var p = Math.min(1, (t - t0) / ms); el.textContent = Math.round(a + (b - a) * p); if (p < 1) requestAnimationFrame(f); })(t0);
  }
  function trustShock() {
    var m = $('.meter.trust', scr); if (m) { m.classList.remove('hit'); void m.offsetWidth; m.classList.add('hit'); }
    var f = h('div', { class: 'flash' }); document.body.appendChild(f); setTimeout(function () { f.remove(); }, 700);
    var c = $('.call', scr); if (c) { c.classList.remove('shake'); void c.offsetWidth; c.classList.add('shake'); }
    Sfx.play('drop'); setFace('shock');
    try { if (navigator.vibrate && navigator.userActivation && navigator.userActivation.hasBeenActive) navigator.vibrate(80); } catch (e) {}
  }

  function lineEl(l) {
    var cls = 'msg ' + l.who, inner = esc(l.t);
    if (l.who === 'scam') inner = '<span class="lbl">电话那头隐约传来</span>' + inner;
    if (l.who === 'think') inner = '<span class="lbl">（内心）</span>' + inner;
    return h('div', { class: cls }, '<div class="bubble">' + inner + '</div>');
  }
  function addLineNow(l) { var log = $('.log', scr); log.appendChild(lineEl(l)); log.scrollTop = log.scrollHeight; }
  function addLine(l) {
    var log = $('.log', scr);
    var d = fast || U.reduced ? 0 : (l.who === 'caller' ? 280 + Math.min(700, l.t.length * 14) : l.who === 'me' ? 180 : 420);
    var typing = null;
    if (d && (l.who === 'caller')) { typing = h('div', { class: 'msg caller typing' }, '<div class="bubble"><i></i><i></i><i></i></div>'); log.appendChild(typing); log.scrollTop = log.scrollHeight; }
    return U.wait(d).then(function () {
      if (typing) typing.remove();
      var el = lineEl(l); log.appendChild(el); log.scrollTop = log.scrollHeight;
      if (l.who === 'scam') Sfx.play('msg');
      return U.wait(fast ? 0 : 160);
    });
  }

  function clueDef(id) { return (curCase().clues || {})[id] || { n: id, t: '' }; }
  function clueCardHTML(cd) {
    return '<span class="ic">' + (CLUE_IC[cd.k] || '🔍') + '</span><div><b>' + esc(cd.n) + '</b><small>' + esc(cd.t) + '</small></div>' + (cd.wall ? '<em class="pin" title="会出现在线索墙上">📌</em>' : '');
  }
  function addClueCard(id, isNew) {
    var box = $('.clues', scr), cd = clueDef(id);
    var em = $('.empty', box); if (em) em.remove();
    var card = h('div', { class: 'clue k-' + (cd.k || 'key') + (isNew ? ' new' : ''), 'data-id': id }, clueCardHTML(cd));
    box.appendChild(card);
    $('.cc', scr).textContent = G.call.clues.length;
    return card;
  }
  function flyClue(id) {
    var cd = clueDef(id);
    var card = addClueCard(id, true);
    var pane = $('.clue-pane', scr);
    var mobile = getComputedStyle(pane).position === 'fixed' && !pane.classList.contains('open');
    var target = mobile ? $('.clue-toggle', scr) : card;
    var log = $('.log', scr), lb = log.getBoundingClientRect();
    var fly = h('div', { class: 'clue flying k-' + (cd.k || 'key') }, clueCardHTML(cd));
    document.body.appendChild(fly);
    var tb = target.getBoundingClientRect();
    var sx = lb.left + lb.width / 2 - 120, sy = lb.bottom - 90;
    fly.style.left = sx + 'px'; fly.style.top = sy + 'px';
    if (!mobile) card.style.visibility = 'hidden';
    var dur = fast || U.reduced ? 1 : 750;
    var anim = fly.animate ? fly.animate([
      { transform: 'translate(0,0) scale(1.08)', opacity: 0 },
      { transform: 'translate(0,-20px) scale(1.08)', opacity: 1, offset: 0.25 },
      { transform: 'translate(' + (tb.left - sx) + 'px,' + (tb.top - sy) + 'px) scale(' + (mobile ? 0.3 : 1) + ')', opacity: mobile ? 0.2 : 1 }
    ], { duration: dur, easing: 'cubic-bezier(.5,0,.2,1)' }) : null;
    setFace('focus');
    return new Promise(function (res) {
      function done() {
        fly.remove(); card.style.visibility = '';
        if (mobile) { var b = $('.clue-toggle', scr); b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); }
        res();
      }
      if (anim) anim.onfinish = done; else setTimeout(done, dur);
    });
  }

  function play(out) {
    fast = false;
    var i = 0;
    return new Promise(function (resolve) {
      (function next() {
        if (i >= out.length) { fast = false; resolve(); return; }
        var e = out[i++];
        if (e.k === 'line') { G.log.push({ who: e.who, t: e.t }); addLine(e).then(next); }
        else if (e.k === 'stat') { updateMeters(e, true); setTimeout(next, fast ? 0 : 120); }
        else if (e.k === 'clue') { flyClue(e.id).then(next); }
        else if (e.k === 'sfx') {
          Sfx.play(e.name);
          if (e.name === 'right') setFace('smile'); else if (e.name === 'wrong') setFace('worry');
          next();
        }
        else next();
      })();
    });
  }

  /* ---------- 行动面板 ---------- */
  function renderActions() {
    var box = $('.actions', scr); if (!box) return;
    var cs = curCase(), st = G.call;
    if (st.over) { box.innerHTML = ''; return; }
    var o = E.options(cs, st, ctx()), lab = cs.labels || {};
    box.className = 'actions mode-' + mode;
    var html = '';
    if (mode === 'root') {
      var spOk = o.special.some(function (s) { return s.ok; });
      html = '<div class="act-grid">' +
        actBtn(1, '❓', '提问', o.ask.length ? o.ask.length + ' 个问题' : '没有可问的了', !o.ask.length) +
        actBtn(2, '⚖', '判断', o.judgeLock || '选出诈骗类型', !!o.judgeLock) +
        actBtn(3, '💬', lab.persuadeName || '劝说', st.verdictOk ? '已解锁针对性话术' : '判断正确后更有效', false) +
        actBtn(4, '⚡', '特殊行动', '今晚剩 ' + st.spLeft + ' 次', !spOk) +
        '</div>';
    } else {
      var items = [];
      if (mode === 'ask') items = o.ask.map(function (q) {
        var star = G.skills.indexOf('insight') >= 0 && q.clue ? '<span class="star" title="能问出线索">★</span>' : '';
        return { label: star + esc(q.q), act: { kind: 'ask', id: q.id } };
      });
      if (mode === 'judge') items = o.judge.map(function (j) {
        return { label: esc(j.label), act: { kind: 'judge', id: j.id }, cls: j.id === 'genuine' ? 'genuine' : '' };
      });
      if (mode === 'persuade') items = o.persuade.map(function (p) {
        var badge = p.targeted ? '<span class="badge t">针对性</span>' : p.id.indexOf('s_') === 0 ? '<span class="badge s">话术</span>' : '';
        return { label: badge + esc(p.t), act: { kind: 'persuade', id: p.id } };
      });
      if (mode === 'special') items = o.special.map(function (s) {
        return { label: '<b>' + esc(s.label) + '</b>' + (s.ok ? '' : '<small>' + esc(s.why) + '</small>'), act: { kind: 'special', id: s.id }, disabled: !s.ok };
      });
      var titles = { ask: '提问', judge: '判断：这是哪一类？', persuade: lab.persuadeName || '劝说', special: '特殊行动（今晚剩 ' + st.spLeft + ' 次）' };
      html = '<div class="opt-head"><button class="btn tiny back"><kbd>Esc</kbd>返回</button><span>' + titles[mode] + '</span></div><div class="opt-list">' +
        items.map(function (it, i) {
          return '<button class="opt ' + (it.cls || '') + '" data-i="' + i + '"' + (it.disabled ? ' disabled' : '') + '><kbd>' + (i + 1) + '</kbd><span>' + it.label + '</span></button>';
        }).join('') + (items.length ? '' : '<p class="empty">没有可选的了。</p>') + '</div>';
      box._items = items;
    }
    box.innerHTML = html;
    if (mode === 'root') {
      U.$$('.act', box).forEach(function (b) { b.addEventListener('click', function () { if (b.disabled) return; Sfx.play('click'); mode = ['ask', 'judge', 'persuade', 'special'][+b.getAttribute('data-n') - 1]; renderActions(); }); });
    } else {
      $('.back', box).addEventListener('click', function () { mode = 'root'; renderActions(); });
      U.$$('.opt', box).forEach(function (b) { b.addEventListener('click', function () { if (b.disabled) return; doAction(box._items[+b.getAttribute('data-i')].act); }); });
    }
  }
  function actBtn(n, ic, name, sub, dis) {
    return '<button class="act" data-n="' + n + '"' + (dis ? ' disabled' : '') + '><kbd>' + n + '</kbd><span class="ic">' + ic + '</span><b>' + name + '</b><small>' + esc(sub) + '</small></button>';
  }
  function callKeys(e) {
    if (busy || !G.call || G.call.over) return;
    if (e.key === 'Escape' || e.key === 'Backspace') { if (mode !== 'root') { e.preventDefault(); mode = 'root'; renderActions(); } return; }
    var n = parseInt(e.key, 10); if (!(n >= 1 && n <= 9)) return;
    var box = $('.actions', scr);
    if (mode === 'root') { var b = U.$$('.act', box)[n - 1]; if (b && !b.disabled) b.click(); }
    else { var o = U.$$('.opt', box)[n - 1]; if (o && !o.disabled) o.click(); }
  }

  function doAction(a) {
    if (busy) return;
    busy = true;
    var cs = curCase(), st = G.call;
    var box = $('.actions', scr); box.innerHTML = '<div class="waiting">…</div>';
    var out = E.act(cs, st, ctx(), a);
    G.spLeft = st.spLeft;
    if (a.kind === 'special' && st.spUsed.indexOf(a.id) >= 0) G.stats[a.id] = (G.stats[a.id] || 0) + 1;
    setFace('calm');
    play(out).then(function () {
      busy = false;
      if (st.over) { save(); endCall(); return; }
      if (st.trust > 30 && st.pressure < 60) setFace('calm'); else setFace('worry');
      mode = 'root'; renderActions(); save();
    });
  }

  /* ---------- 通话结束 ---------- */
  var OUT_NAME = { perfect: '完全拦截', partial: '部分损失', scammed: '被骗', misjudge: '误判' };
  function endCall() {
    var cs = curCase(), st = G.call;
    var res = E.settle(cs, st);
    var g = cs.type === 'genuine';
    var name = g && res.outcome === 'perfect' ? '正确放行' : (cs.boss && cs.outName && cs.outName[res.outcome]) || OUT_NAME[res.outcome];
    if (!G.results[cs.id]) {
      G.results[cs.id] = res.outcome;
      G.saved += res.saved; G.lost += res.lost; G.rep = U.clamp(G.rep + res.rep, 0, 100);
      if (!g) G.maxSaved += cs.amount || 0;
      if (res.outcome === 'misjudge') G.mis++;
      st.clues.forEach(function (id) { var cd = cs.clues[id]; if (cd && cd.wall) { var gid = cs.id + '.' + id; if (G.bank.indexOf(gid) < 0) G.bank.push(gid); } });
      G.nightRes.push({ id: cs.id, outcome: res.outcome, saved: res.saved, lost: res.lost });
      G.phase = 'callEnd';
      save();
      // 成就
      unlock('first');
      if (cs.id === 'n1a' && res.outcome === 'perfect') unlock('n1200');
      if (G.stats.family >= 3) unlock('family');
      if (G.stats.freeze >= 5) unlock('freezer');
    }
    var good = res.outcome === 'perfect';
    Sfx.play(good ? 'win' : res.outcome === 'partial' ? 'right' : 'fail');
    Music.mood(good ? 'calm' : res.outcome === 'partial' ? 'calm' : 'sad');
    setFace(good ? 'smile' : res.outcome === 'partial' ? 'tired' : 'sad');
    var txt = (cs.end && cs.end[st.reason === 'hangup' && cs.end.hangup ? 'hangup' : res.outcome]) || '';
    if (st.reason === 'hangup' && !g && !(cs.end && cs.end.hangup)) txt = '他不再相信你，挂断了电话。' + (res.outcome === 'scammed' ? '后来——' + txt : txt);
    var money = g ? '' : '<div class="money"><div><small>挽回</small><b class="ok">¥' + fmt(res.saved) + '</b></div><div><small>损失</small><b class="bad">¥' + fmt(res.lost) + '</b></div></div>';
    var learn = res.outcome !== 'perfect' && cs.lesson ? '<p class="lesson">💡 ' + esc(cs.lesson) + '</p>' : '';
    var typeLine = '<p class="truth">真实类型：<b>' + esc(E.TYPES[cs.type].name) + '</b></p>';
    var last = G.idx + 1 >= nightDef().cases.length;
    setTimeout(function () {
      U.modal({ title: '<span class="oc oc-' + res.outcome + '">' + name + '</span>', cls: 'result r-' + res.outcome, dismiss: false,
        html: '<p class="rtext">' + esc(txt) + '</p>' + money + typeLine + learn + '<p class="rep">口碑 ' + (res.rep >= 0 ? '+' : '') + res.rep + '</p>',
        buttons: [{ label: last ? '夜班结算' : '接下一通', value: 1, primary: true }] }).then(nextCall);
    }, fast ? 100 : 700);
  }
  function nextCall() {
    G.idx++; G.call = null; G.log = [];
    if (G.idx >= nightDef().cases.length) { G.phase = 'summary'; save(); nightSummary(); }
    else { G.phase = 'ring'; save(); ringCall(); }
  }

  /* ======================= 夜班结算 ======================= */
  function nightSummary() {
    G.phase = 'summary'; save();
    var ns = G.nightStart || { saved: 0, lost: 0, rep: 60, bank: 0, mis: 0 };
    var allPerfect = G.nightRes.length && G.nightRes.every(function (r) { return r.outcome === 'perfect'; });
    if (allPerfect) unlock('clean');
    Music.mood('calm');
    var rows = G.nightRes.map(function (r) {
      var cs = CM[r.id], g = cs.type === 'genuine';
      var nm = g && r.outcome === 'perfect' ? '正确放行' : (cs.boss && cs.outName && cs.outName[r.outcome]) || OUT_NAME[r.outcome];
      return '<li><span class="who">' + esc(cs.caller.name) + '</span><span class="oc oc-' + r.outcome + '">' + nm + '</span><span class="amt">' + (g ? '—' : '¥' + fmt(r.saved)) + '</span></li>';
    }).join('');
    var newClues = G.bank.slice(ns.bank).map(function (gid) { var p = gid.split('.'); var cd = CM[p[0]].clues[p[1]]; return '<span class="chip">📌 ' + esc(cd.n) + '</span>'; }).join('');
    var last = G.night >= S.NIGHTS.length;
    go('<div class="room-wrap dim">' + Art.dutyRoom(G.night) + '</div>' +
      '<div class="panel summary"><h2>第 ' + G.night + ' 夜 · 结算</h2>' +
      '<div class="stats3"><div><small>今晚挽回</small><b class="ok">¥' + fmt(G.saved - ns.saved) + '</b></div><div><small>今晚损失</small><b class="bad">¥' + fmt(G.lost - ns.lost) + '</b></div><div><small>口碑</small><b>' + G.rep + ' <i>(' + (G.rep - ns.rep >= 0 ? '+' : '') + (G.rep - ns.rep) + ')</i></b></div></div>' +
      '<ul class="res-list">' + rows + '</ul>' +
      '<h3>新获得的线索</h3><div class="chips">' + (newClues || '<span class="dim">今晚没有新的主线线索。</span>') + '</div>' +
      '<div class="foot"><button class="btn primary big"><kbd>1</kbd>' + (last ? '天亮了' : '下班，迎接白天') + '</button></div></div>', 'summary-screen');
    var b = $('.foot .btn', scr);
    function nx() { Sfx.play('click'); if (last) { G.phase = 'ending'; save(); ending(); } else { G.phase = 'news'; save(); dayNews(); } }
    b.addEventListener('click', nx);
    setKeys(function (e) { if (e.key === '1') nx(); });
  }

  /* ======================= 白天 ======================= */
  function dayNews() {
    G.phase = 'news'; save();
    Music.mood('calm');
    var D = S.DAY_NEWS[G.night] || {};
    var items = G.nightRes.map(function (r) {
      var cs = CM[r.id];
      return '<li class="oc-' + r.outcome + '"><b>' + esc(cs.caller.name) + '</b><p>' + esc((cs.after && cs.after[r.outcome]) || '') + '</p></li>';
    }).join('');
    go('<div class="day-bg"></div><div class="panel news"><div class="paper-head"><small>第 ' + G.night + ' 天 · 早 8:00</small><h2>早间新闻 / 后续回访</h2></div>' +
      (D.head ? '<div class="headline">' + esc(D.head) + '</div>' : '') +
      '<ul class="news-list">' + items + '</ul>' +
      (D.laochen ? '<p class="laochen">' + esc(D.laochen) + '</p>' : '') +
      '<div class="foot"><button class="btn primary big"><kbd>1</kbd>去线索墙</button></div></div>', 'day-screen');
    var b = $('.foot .btn', scr);
    function nx() { Sfx.play('click'); G.phase = 'wall'; G.wallTries = 3; save(); dayWall(); }
    b.addEventListener('click', nx);
    setKeys(function (e) { if (e.key === '1') nx(); });
  }

  function linkFor(a, b) {
    return S.LINKS.filter(function (L) { return a !== b && L.set.indexOf(a) >= 0 && L.set.indexOf(b) >= 0; })[0];
  }
  function dayWall() {
    G.phase = 'wall'; save();
    var cards = G.bank.slice();
    var possible = S.LINKS.filter(function (L) { return G.links.indexOf(L.id) < 0 && L.set.filter(function (g) { return cards.indexOf(g) >= 0; }).length >= 2; }).length;
    go('<div class="day-bg"></div><div class="panel wall"><div class="paper-head"><small>第 ' + G.night + ' 天 · 下午</small><h2>线索墙</h2></div>' +
      '<p class="dim">把<b>属于同一个团伙</b>的两张线索连起来。点一张，再点另一张。' + (possible ? '' : ' <i>（今天没有能连上的新线索）</i>') + '</p>' +
      '<div class="wall-stat"><span>已确认关联 <b class="lk">' + G.links.length + '</b> / ' + S.LINKS.length + '</span><span>可试错 <b class="tr">' + G.wallTries + '</b> 次</span></div>' +
      '<div class="board"><svg class="threads"></svg><div class="cards"></div></div>' +
      '<div class="found"></div>' +
      '<div class="foot"><button class="btn primary big"><kbd>1</kbd>把结论交给老陈</button></div></div>', 'day-screen wall-screen');
    var box = $('.cards', scr), sel = null;
    cards.forEach(function (gid, i) {
      var p = gid.split('.'), cs = CM[p[0]], cd = cs.clues[p[1]];
      var el = h('button', { class: 'wcard k-' + cd.k, 'data-g': gid, style: '--r:' + (((i * 37) % 7) - 3) + 'deg' },
        '<span class="ic">' + (CLUE_IC[cd.k] || '🔍') + '</span><b>' + esc(cd.n) + '</b><small>' + esc(cs.caller.name) + ' · 第' + cs.night + '夜</small>');
      el.addEventListener('click', function () { pick(el); });
      box.appendChild(el);
    });
    function renderFound() {
      if (G.phase !== 'wall' || !$('.found', scr)) return;
      $('.found', scr).innerHTML = G.links.map(function (id) { var L = S.LINKS.filter(function (x) { return x.id === id; })[0]; return '<div class="fl"><b>🧵 ' + esc(L.n) + '</b><p>' + esc(L.t) + '</p></div>'; }).join('');
      drawThreads();
    }
    function drawThreads() {
      if (!$('.threads', scr)) return;
      var svg = $('.threads', scr), bd = $('.board', scr).getBoundingClientRect(), s = '';
      G.links.forEach(function (id) {
        var pr = (G.linkPairs || {})[id]; if (!pr) return;
        var a = $('[data-g="' + pr[0] + '"]', scr), b = $('[data-g="' + pr[1] + '"]', scr);
        if (!a || !b) return;
        var ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
        s += '<line x1="' + (ra.left + ra.width / 2 - bd.left) + '" y1="' + (ra.top + 10 - bd.top) + '" x2="' + (rb.left + rb.width / 2 - bd.left) + '" y2="' + (rb.top + 10 - bd.top) + '"/>';
        a.classList.add('linked'); b.classList.add('linked');
      });
      svg.setAttribute('width', bd.width); svg.setAttribute('height', bd.height);
      svg.innerHTML = s;
    }
    function pick(el) {
      if (!sel) { sel = el; el.classList.add('sel'); Sfx.play('click'); return; }
      if (sel === el) { el.classList.remove('sel'); sel = null; return; }
      var a = sel.getAttribute('data-g'), b = el.getAttribute('data-g');
      var L = linkFor(a, b);
      sel.classList.remove('sel');
      var pa = sel; sel = null;
      if (L && G.links.indexOf(L.id) < 0) {
        G.links.push(L.id); G.linkPairs = G.linkPairs || {}; G.linkPairs[L.id] = [a, b]; save(); Sfx.play('link');
        U.toast('🧵 关联成立：<b>' + esc(L.n) + '</b>', 'ok', 3000);
        $('.lk', scr).textContent = G.links.length;
        renderFound();
        if (G.links.length >= S.LINKS.length) unlock('wall');
      } else if (L) { U.toast('这条关联已经连过了。'); }
      else {
        if (G.wallTries <= 0) { U.toast('老陈："今天就到这儿吧，别硬凑。"'); return; }
        G.wallTries--; save(); Sfx.play('wrong');
        [pa, el].forEach(function (x) { x.classList.remove('bad'); void x.offsetWidth; x.classList.add('bad'); });
        $('.tr', scr).textContent = G.wallTries;
        U.toast(G.wallTries > 0 ? '这两条看不出有什么关系。' : '老陈："别硬凑。今天就到这儿。"', 'bad');
        if (G.wallTries <= 0) U.$$('.wcard', scr).forEach(function (x) { if (!x.classList.contains('linked')) x.disabled = true; });
      }
    }
    if (G.wallTries <= 0) U.$$('.wcard', scr).forEach(function (x) { x.disabled = true; });
    requestAnimationFrame(renderFound);
    window.onresize = function () { if (G && G.phase === 'wall') drawThreads(); };
    var b = $('.foot .btn', scr);
    function nx() { Sfx.play('click'); G.phase = 'skill'; save(); daySkill(); }
    b.addEventListener('click', nx);
    setKeys(function (e) { if (e.key === '1') nx(); });
  }

  function daySkill() {
    G.phase = 'skill'; save();
    var key = S.SKILL_ORDER[G.night - 1], sk = E.SKILLS[key];
    if (sk && G.skills.indexOf(key) < 0) { G.skills.push(key); save(); }
    var lines = (S.SKILL_TALK || {})[key] || '老陈："今天教你一招。"';
    go('<div class="day-bg"></div><div class="panel skill"><div class="paper-head"><small>第 ' + G.night + ' 天 · 傍晚</small><h2>新话术</h2></div>' +
      '<div class="lc-row"><div class="lc-av">' + Art.person({ g: 'm', age: 'mid', hair: 'gray', seed: 77, uniform: true, mood: 'happy', bg: '#2b3a52' }) + '</div><p class="laochen">' + esc(lines) + '</p></div>' +
      (sk ? '<div class="skill-card"><small>已学会</small><h3>' + esc(sk.name) + '</h3><p>' + esc(sk.desc) + '</p>' + (sk.opt ? '<blockquote>“' + esc(sk.opt.t) + '”</blockquote>' : '') + '</div>' : '') +
      '<div class="foot"><button class="btn primary big"><kbd>1</kbd>天黑了，去值班</button></div></div>', 'day-screen');
    var b = $('.foot .btn', scr);
    function nx() { Sfx.play('click'); G.night++; G.phase = 'intro'; save(); nightIntro(); }
    b.addEventListener('click', nx);
    setKeys(function (e) { if (e.key === '1') nx(); });
  }

  /* ======================= 结局 ======================= */
  function ending() {
    var busted = !!(S.BOSS_ID && G.results[S.BOSS_ID] === 'perfect' && G.links.length >= (S.BUST_LINKS || 5));
    var key = S.decideEnding({ saved: G.saved, maxSaved: G.maxSaved, mis: G.mis, busted: busted });
    var EN = S.ENDINGS[key];
    meta.endings = meta.endings || {}; meta.endings[key] = Date.now(); saveMeta();
    if (key === 'good') unlock('dawn');
    var genuineIds = Object.keys(G.results).filter(function (id) { return CM[id].type === 'genuine'; });
    if (genuineIds.length >= 1 && genuineIds.length === S.NIGHTS.length && genuineIds.every(function (id) { return G.results[id] === 'perfect'; })) unlock('notall');
    Music.mood(EN.mood);
    var ratio = G.maxSaved ? Math.round(G.saved / G.maxSaved * 100) : 0;
    go('<div class="sky end-sky">' + Art.skyline(7, {}) + '</div><div class="panel ending end-' + key + '">' +
      '<small class="dim">结局</small><h1>「' + esc(EN.title) + '」</h1>' +
      '<div class="end-text"></div>' +
      '<div class="end-rest" hidden>' +
      '<div class="stats3"><div><small>挽回总额</small><b class="ok">¥' + fmt(G.saved) + '</b><i>' + ratio + '%</i></div><div><small>误判</small><b>' + G.mis + ' 次</b></div><div><small>团伙</small><b>' + (busted ? '已破获' : '在逃') + '</b></div></div>' +
      '<p class="dim cond">好结局：破获团伙（终局定位成功 + 线索墙关联 ≥ ' + (S.BUST_LINKS || 5) + ' 条）+ 误判 ≤ 1 次 + 挽回 ≥ 60%｜狼来了：误判 ≥ 4 次｜电话还在响：挽回 < 50%</p>' +
      '<h3>反诈知识小结</h3>' + knowledgeHTML() +
      '<div class="foot"><button class="btn primary" data-a="t">回到标题</button><button class="btn" data-a="a">查看成就</button></div></div></div>', 'ending-screen');
    var box = $('.end-text', scr);
    G.phase = 'done'; save();
    root.Narrate.run(box, EN.text).then(function () {
      box.innerHTML = EN.text.map(function (t) { return '<p>' + esc(t) + '</p>'; }).join('');
      $('.end-rest', scr).hidden = false;
      $('[data-a=t]', scr).addEventListener('click', title);
      $('[data-a=a]', scr).addEventListener('click', showAch);
    });
  }

  /* ======================= 启动 ======================= */
  var Game = {
    init: function () {
      scr = $('#screen');
      root.Sound.set(meta.sound !== false);
      var sb = $('#sound-btn');
      function paint() { sb.textContent = root.Sound.on ? '🔊' : '🔇'; sb.setAttribute('aria-label', root.Sound.on ? '关闭声音' : '打开声音'); }
      paint();
      sb.addEventListener('click', function (e) { e.stopPropagation(); root.Sound.unlock(); root.Sound.toggle(); meta.sound = root.Sound.on; saveMeta(); paint(); });
      document.addEventListener('keydown', function (e) { if ((e.key === 'm' || e.key === 'M') && !document.querySelector('.modal-wrap')) sb.click(); });
      document.addEventListener('pointerdown', function () { root.Sound.unlock(); }, { once: true });
      title();
    },
    _state: function () { return G; }
  };
  root.Game = Game;
})(this);
