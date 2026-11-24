/* tools/autoplay.js — 浏览器内自动通关（开发自测用，游戏本身不加载这个文件）
 * 用法：打开游戏后，在开发者工具控制台粘贴本文件全部内容，然后：
 *   Autoplay.run('good')   每回合都选对、线索墙全连 → 应达成好结局「长夜有灯」
 *   Autoplay.run('bad')    真实来电正确放行，诈骗电话随机乱选、线索墙不连 → 自然落入坏结局
 * 它通过点击真实的界面按钮来操作，所以也能顺便检验整条 UI 流程。
 */
(function () {
  'use strict';
  var E = window.Engine, S = window.STORY, CM = window.CASE_MAP;
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };

  function goodAction(cs, st, ctx) {
    var o = E.options(cs, st, ctx), sp = cs.sp || {};
    var spOk = function (k) { return o.special.some(function (s) { return s.id === k && s.ok; }); };
    if (spOk('hangup') && st.trust >= 35) return { kind: 'special', id: 'hangup' };
    var need = {};
    ['family', 'freeze'].forEach(function (k) { if (sp[k] && sp[k].clue && st.spLeft > 0) need[sp[k].clue] = 1; });
    (cs.persuade || []).forEach(function (p) { if (p.reqClue) need[p.reqClue] = 1; });
    Object.keys(cs.clues).forEach(function (k) { if (cs.clues[k].wall && cs.type !== 'genuine') need[k] = 1; });
    var qs = o.ask.filter(function (q) { return (q.trust || 0) >= 0; });
    var q1 = qs.filter(function (q) { return (q.clue && need[q.clue]) || q.prog > 0; }).sort(function (a, b) { return (b.prog || 0) - (a.prog || 0); })[0];
    if (q1) return { kind: 'ask', id: q1.id };
    if (!st.verdictOk) {
      if (!st.clues.length) { var any = qs.filter(function (q) { return q.clue; })[0]; if (any) return { kind: 'ask', id: any.id }; }
      return { kind: 'judge', id: cs.type };
    }
    if (spOk('freeze')) return { kind: 'special', id: 'freeze' };
    if (spOk('family') && st.need - st.prog >= 2) return { kind: 'special', id: 'family' };
    var c = cs.caller || {};
    var scored = o.persuade.map(function (p) {
      var eff = cs.type === 'genuine' && p.onGenuine ? p.onGenuine : p, tags = p.tags || [];
      if (cs.type === 'genuine' && tags.indexOf('accuse') >= 0) return null;
      var dg = (eff.prog || 0) + (eff.progIfVerdict && st.verdictOk ? eff.progIfVerdict : 0), dt = eff.trust || 0, dp = eff.pressure || 0;
      var dis = tags.some(function (t) { return (c.dislikes || []).indexOf(t) >= 0; }), like = tags.some(function (t) { return (c.likes || []).indexOf(t) >= 0; });
      if (dis) { dg = 0; dt -= 20; } else if (like) { dt += 8; if (dg > 0) dg++; }
      if (st.trust + dt <= 0) return null;
      return { p: p, s: dg * 100 + dt - dp * 0.5 };
    }).filter(Boolean).sort(function (a, b) { return b.s - a.s; });
    if (scored.length && scored[0].s > 0) return { kind: 'persuade', id: scored[0].p.id };
    if (spOk('family')) return { kind: 'special', id: 'family' };
    var rest = qs.filter(function (q) { return q.clue; })[0];
    if (rest) return { kind: 'ask', id: rest.id };
    return scored.length ? { kind: 'persuade', id: scored[0].p.id } : E.legalActions(cs, st, ctx)[0];
  }
  function randomAction(cs, st, ctx) {
    var acts = E.legalActions(cs, st, ctx), cats = {};
    acts.forEach(function (a) { (cats[a.kind] = cats[a.kind] || []).push(a); });
    var ks = Object.keys(cats), k = ks[Math.floor(Math.random() * ks.length)];
    return cats[k][Math.floor(Math.random() * cats[k].length)];
  }

  async function doCallStep(mode) {
    var G = window.Game._state(), cs = CM[S.NIGHTS[G.night - 1].cases[G.idx]], st = G.call;
    var ctx = { skills: G.skills, links: G.links, sp: G.spLeft };
    var a = (mode === 'good' || cs.type === 'genuine') ? goodAction(cs, st, ctx) : randomAction(cs, st, ctx);
    var cat = { ask: 0, judge: 1, persuade: 2, special: 3 }[a.kind];
    $$('.actions .act')[cat].click();
    await sleep(30);
    var items = $('.actions')._items || [];
    var idx = items.findIndex(function (it) { return it.act.kind === a.kind && it.act.id === a.id; });
    if (idx < 0) throw new Error('option not found ' + JSON.stringify(a));
    $$('.actions .opt')[idx].click();
    return a;
  }

  async function doWall(mode) {
    if (mode !== 'good') return;
    var G = window.Game._state();
    for (var i = 0; i < S.LINKS.length; i++) {
      var L = S.LINKS[i]; if (G.links.indexOf(L.id) >= 0) continue;
      var have = L.set.filter(function (g) { return G.bank.indexOf(g) >= 0; });
      if (have.length < 2) continue;
      $('[data-g="' + have[0] + '"]').click(); await sleep(60);
      $('[data-g="' + have[1] + '"]').click(); await sleep(200);
    }
  }

  var Autoplay = {
    log: [],
    run: async function (mode) {
      mode = mode || 'good';
      window.U.reduced = true;
      var guard = 0, t0 = Date.now();
      try { localStorage.removeItem('f96110.save.v1'); } catch (e) {}
      var newBtn = $$('.menu .btn').find(function (b) { return b.textContent.indexOf('新游戏') >= 0; });
      if (newBtn) newBtn.click();
      await sleep(300);
      var m = $('.modal-wrap.in .modal-btns .btn.primary'); if (m) { m.click(); await sleep(300); }
      while (guard++ < 3000) {
        await sleep(120);
        var G = window.Game._state();
        if ($('.prologue-screen .skip')) { $('.skip').click(); continue; }
        var modal = $('.modal-wrap.in .modal-btns .btn');
        if (modal) {
          var r = $('.modal.result');
          if (r) Autoplay.log.push((S.NIGHTS[G.night - 1].cases[G.idx]) + ': ' + r.querySelector('h2').textContent);
          modal.click(); await sleep(300); continue;
        }
        if (!G) continue;
        var ph = G.phase;
        if (ph === 'intro') { var sk = $('[data-a=skip]'); if (sk) sk.click(); continue; }
        if (ph === 'ring') { var an = $('.answer'); if (an) an.click(); continue; }
        if (ph === 'call') {
          if ($('.actions .act') && !G.call.over) { try { await doCallStep(mode); } catch (e) { console.warn(e); } }
          continue;
        }
        if (ph === 'wall') { await doWall(mode); }
        if (ph === 'done') {
          // 结局旁白：按空格推进
          document.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
          if ($('.end-rest') && !$('.end-rest').hidden) break;
          continue;
        }
        var b = $('.foot .btn.primary'); if (b) b.click();
      }
      var Gf = window.Game._state();
      var res = { mode: mode, seconds: Math.round((Date.now() - t0) / 1000), ending: $('.ending h1') && $('.ending h1').textContent, saved: Gf.saved, maxSaved: Gf.maxSaved, mis: Gf.mis, links: Gf.links.length, results: Gf.results };
      console.log(res);
      return res;
    }
  };
  window.Autoplay = Autoplay;
})();
