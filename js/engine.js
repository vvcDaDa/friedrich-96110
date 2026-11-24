/* =========================================================================
 * engine.js — 通话规则引擎（纯逻辑，不碰 DOM）
 * 浏览器里挂在 window.Engine；Node 里通过 module.exports 导出，供 tools/simulate.js 使用。
 *
 * 一通电话的状态 st：
 *   trust / pressure / prog / need / turnsLeft / rate / rateMod
 *   clues[]   已获得线索 id         asked[]  已问过的问题 id
 *   used[]    已用过的劝说 id       spUsed[] 本通已用的特殊行动
 *   verdict / verdictOk            frozen / partialDone / recovered
 *   spLeft    本夜剩余特殊行动次数（通话结束后由游戏层写回）
 *   over / reason / outcome
 * act() 返回事件数组，UI 依次播放：
 *   {k:'line', who:'me|caller|scam|sys|think', t}
 *   {k:'stat', trust, pressure, prog, turns, dt, dp, dg}
 *   {k:'clue', id}   {k:'sfx', name}   {k:'end', outcome, reason}
 * ========================================================================= */
(function (root) {
  'use strict';

  var TYPES = {
    shuadan:  { name: '刷单返利', say: '这是刷单返利诈骗。先返小钱让你尝甜头，再用"卡单""补单""解冻金"一步步让你越投越多。' },
    gjf:      { name: '冒充公检法', say: '这是冒充公检法诈骗。真正的公检法不会通过电话办案，更没有什么"安全账户"。' },
    kefu:     { name: '冒充客服退款/理赔', say: '这是冒充客服的退款理赔诈骗。正规客服不会让你开屏幕共享，也不会要你的验证码。' },
    touzi:    { name: '虚假投资理财', say: '这是虚假投资理财诈骗。"内部消息""稳赚不赔"，前期让你小赚，等你投大钱就提不出来了。' },
    shazhu:   { name: '杀猪盘（网恋投资）', say: '这很可能是网恋交友类的"杀猪盘"：先培养感情，再带你上一个他说了算的平台投钱。' },
    shuren:   { name: '冒充熟人/领导', say: '这是冒充熟人或领导的诈骗。新加的好友、只打字不接电话、催着马上转账，都是典型特征。' },
    xiaoyuan: { name: '注销校园贷', say: '这是"注销校园贷"诈骗。根本不存在"不注销就影响征信"这回事，让你借钱转走才是目的。' },
    youxi:    { name: '游戏账号交易', say: '这是游戏账号交易诈骗。脱离官方平台私下交易，再用"账户冻结""解冻费"让你一次次付钱。' },
    zhaopin:  { name: '虚假招聘/培训贷', say: '这是虚假招聘加培训贷。"包就业、高薪"是饵，真正签下的是一份贷款合同。' },
    zhuihui:  { name: '"帮你追回"二次诈骗', say: '这是专门盯着受害人的二次诈骗。追回被骗资金只能通过公安机关，没有收费"追回"这回事。' },
    ai:       { name: 'AI 换脸/换声冒充亲人', say: '这很可能是 AI 换声或换脸冒充亲人。声音和脸都能伪造，要用只有你们知道的事情去核实。' },
    genuine:  { name: '真实来电（不是诈骗）', say: '我仔细听下来，这通电话的特征和正规机构一致：不要钱、不要验证码，还让你自己去官方渠道核实。' }
  };

  /* 通用劝说（任何电话都可选，未必是好选择） */
  var GENERIC = [
    { id: 'g_pause', t: '能不能先停一下，别急着操作？我陪你一起把事情捋一遍。', tags: ['calm'], trust: 2, pressure: -10,
      onGenuine: { trust: -3, pressure: -5 } },
    { id: 'g_blunt', t: '这一看就是骗子，你怎么会信这种东西？', tags: ['blame', 'accuse'], trust: -25 }
  ];

  /* 白天学会的话术（成长解锁）。passive 的技能不出现在选项里 */
  var SKILLS = {
    metoo: { name: '「我也被骗过」', desc: '坦白自己去年的经历。大幅提升信任；判断正确后还能推动劝阻进度。',
      opt: { id: 's_metoo', t: '跟你说个事：去年我也被刷单骗过一万七。被骗真的不丢人，丢人的是骗子。', tags: ['empathy'], trust: 15, pressure: -5, progIfVerdict: 1,
        onGenuine: { trust: 6 } } },
    callback: { name: '「挂断，回拨官方号码」', desc: '教对方自己查官方电话回拨核实。判断正确后推动进度，对真实来电同样适用。',
      opt: { id: 's_callback', t: '我们换个办法：先挂掉他，你自己查官方号码打过去问，是真是假一问就知道。', tags: ['facts'], pressure: -10, progIfVerdict: 1,
        onGenuine: { progIfVerdict: 1 } } },
    insight: { name: '「多问一句」', desc: '被动：问题列表里，能问出关键线索的问题会标上 ★，且每问出一条线索，施压度 -3。', passive: true },
    threeno: { name: '「三不一多」', desc: '不听、不信、不转账，多核实。判断正确后推动进度。',
      opt: { id: 's_threeno', t: '记住四个字就行——不听、不信、不转账，多核实。我们现在就在"多核实"这一步。', tags: ['facts'], trust: 3, progIfVerdict: 1,
        onGenuine: { trust: -4 } } },
    extra: { name: '「值班老手」', desc: '被动：每晚特殊行动次数 +1。', passive: true },
    noshame: { name: '「被骗不丢人」', desc: '卸下对方的羞耻感。大幅提升信任、降低施压；判断正确后推动进度。',
      opt: { id: 's_noshame', t: '你肯打这个电话，已经比大多数人清醒了。真被骗了也不是你的错，我们一起想办法。', tags: ['empathy'], trust: 18, pressure: -10, progIfVerdict: 1,
        onGenuine: { trust: 8 } } }
  };

  var SPECIAL_NAMES = { family: '联系家属', freeze: '紧急止付', hangup: '挂掉另一部电话' };

  var DEFAULT_REACT = {
    blame: '……你也觉得我很蠢，是吧。',
    accuse: '你凭什么一口咬定？你又不了解情况。',
    calm: '你别光让我冷静，我现在冷静不下来！',
    family: '别、别告诉家里人，我不想让他们担心……',
    authority: '你一个接电话的，凭什么比警察还懂？',
    credit: '征信的事你又不能替我担保……',
    gentle: '……',
    facts: '道理我都懂，可是……',
    empathy: '……谢谢你这么说。'
  };

  function clamp(v) { return Math.max(0, Math.min(100, Math.round(v))); }
  function has(arr, x) { return arr.indexOf(x) !== -1; }
  function lines(arr) {
    // ['c','text'] 简写 → {who,text}
    var map = { c: 'caller', m: 'me', s: 'scam', x: 'sys', t: 'think' };
    return (arr || []).map(function (p) { return typeof p === 'string' ? { k: 'line', who: 'caller', t: p } : { k: 'line', who: map[p[0]] || p[0], t: p[1] }; });
  }
  function say(out, a) {
    if (!a) return;
    if (typeof a === 'string') out.push({ k: 'line', who: 'caller', t: a });
    else lines(a).forEach(function (e) { out.push(e); });
  }

  function newCall(cs, ctx) {
    ctx = ctx || {};
    var s = cs.start || {};
    var st = {
      id: cs.id, trust: s.trust || 50, pressure: s.pressure || 15, need: cs.need || 2,
      turnsLeft: s.turns || 9, turnsMax: s.turns || 9, rate: s.rate || 8, rateMod: 1, prog: 0, turn: 0,
      clues: [], asked: [], used: [], spUsed: [], verdict: null, verdictOk: false, wrong: 0,
      frozen: false, partialDone: false, recovered: false, blocked: false,
      spLeft: ctx.sp == null ? 3 : ctx.sp, over: false, reason: null, outcome: null
    };
    var out = lines(cs.open);
    fireEvents(cs, st, out);
    out.push(stat(st, 0, 0, 0));
    return { st: st, out: out };
  }

  function stat(st, dt, dp, dg) {
    return { k: 'stat', trust: st.trust, pressure: st.pressure, prog: st.prog, need: st.need, turns: st.turnsLeft, dt: dt, dp: dp, dg: dg };
  }
  function delta(st, out, dt, dp, dg) {
    dt = dt || 0; dp = dp || 0; dg = dg || 0;
    st.trust = clamp(st.trust + dt);
    st.pressure = clamp(st.pressure + dp);
    st.prog = Math.max(0, Math.min(st.need, st.prog + dg));
    out.push(stat(st, dt, dp, dg));
  }
  function addClue(cs, st, out, id, ctx) {
    if (!id || has(st.clues, id)) return;
    st.clues.push(id);
    out.push({ k: 'clue', id: id });
    out.push({ k: 'sfx', name: 'clue' });
    if (ctx && ctx.skills && has(ctx.skills, 'insight')) delta(st, out, 0, -3, 0);
  }

  function fireEvents(cs, st, out) {
    (cs.events || []).forEach(function (ev) {
      if (ev.after !== st.turn) return;
      if (ev.req && !has(st.clues, ev.req)) return;
      say(out, ev.a);
      if (ev.clue) addClue(cs, st, out, ev.clue);
      if (ev.dt || ev.dp) delta(st, out, ev.dt, ev.dp, 0);
    });
  }

  /* ---------- 可选行动 ---------- */
  function questionList(cs, st, ctx) {
    ctx = ctx || {};
    return (cs.questions || []).filter(function (q) {
      if (has(st.asked, q.id)) return false;
      if (q.req && !has(st.clues, q.req)) return false;
      if (q.reqLink && !(ctx.links && has(ctx.links, q.reqLink))) return false;
      return true;
    });
  }
  function persuadeList(cs, st, ctx) {
    ctx = ctx || {};
    var list = [];
    (cs.persuade || []).forEach(function (o) {
      if (has(st.used, o.id)) return;
      if (o.targeted && !st.verdictOk) return;
      if (o.reqClue && !has(st.clues, o.reqClue)) return;
      if (o.reqLink && !(ctx.links && has(ctx.links, o.reqLink))) return;
      list.push(o);
    });
    if (!cs.noGeneric) GENERIC.forEach(function (o) { if (!has(st.used, o.id)) list.push(o); });
    (ctx.skills || []).forEach(function (k) {
      var sk = SKILLS[k];
      if (sk && sk.opt && !has(st.used, sk.opt.id) && !cs.noSkills) list.push(sk.opt);
    });
    return list;
  }
  function specialList(cs, st) {
    var sp = cs.sp || {};
    return ['family', 'freeze', 'hangup'].map(function (key) {
      var d = sp[key];
      var r = { id: key, label: SPECIAL_NAMES[key], ok: false, why: '' };
      if (!d) { r.why = '这通电话用不上'; return r; }
      if (has(st.spUsed, key)) { r.why = '本通已使用'; return r; }
      if (st.spLeft <= 0) { r.why = '今晚次数已用完'; return r; }
      if (d.clue && !has(st.clues, d.clue)) { r.why = d.hint || (key === 'family' ? '还没问到家属联系方式' : key === 'freeze' ? '还没拿到收款账户线索' : '还不知道有另一部电话'); return r; }
      r.ok = true; if (d.label) r.label = d.label; return r;
    });
  }
  function options(cs, st, ctx) {
    return {
      ask: questionList(cs, st, ctx),
      judge: (cs.verdict || []).map(function (id) { return { id: id, label: TYPES[id] ? TYPES[id].name : id }; }),
      judgeLock: st.verdictOk ? '已判断正确' : (st.clues.length === 0 ? '先问出至少一条线索' : ''),
      persuade: persuadeList(cs, st, ctx),
      special: specialList(cs, st)
    };
  }
  /* 平铺的可执行行动（模拟器使用） */
  function legalActions(cs, st, ctx) {
    var o = options(cs, st, ctx), a = [];
    o.ask.forEach(function (q) { a.push({ kind: 'ask', id: q.id }); });
    if (!o.judgeLock) o.judge.forEach(function (j) { a.push({ kind: 'judge', id: j.id }); });
    o.persuade.forEach(function (p) { a.push({ kind: 'persuade', id: p.id }); });
    o.special.forEach(function (s) { if (s.ok) a.push({ kind: 'special', id: s.id }); });
    return a;
  }

  /* ---------- 结局 ---------- */
  function finish(cs, st, out, reason) {
    if (st.over) return;
    st.over = true; st.reason = reason;
    var g = cs.type === 'genuine', oc;
    if (reason === 'misjudge') oc = 'misjudge';
    else if (g) oc = reason === 'win' ? 'perfect' : reason === 'hangup' ? 'misjudge' : 'partial';
    else if (reason === 'win') oc = (st.partialDone && !st.recovered) ? 'partial' : 'perfect';
    else if (reason === 'timeout') oc = (st.frozen || st.prog >= Math.ceil(st.need / 2)) ? 'partial' : 'scammed';
    else oc = st.frozen ? 'partial' : 'scammed';
    st.outcome = oc;
    var tail = cs.endLine && cs.endLine[reason];
    if (tail) say(out, tail);
    else if (reason === 'hangup') out.push({ k: 'line', who: 'sys', t: g ? '对方觉得你在胡说八道，挂断了电话。' : '对方认定你也是骗子，挂断了电话。' });
    else if (reason === 'pressure' && !g) out.push({ k: 'line', who: 'sys', t: st.frozen ? '听筒里传来转账提示音——但收款账户已被止付，大部分钱被拦在了路上。' : '听筒里传来转账成功的提示音。对方挂断了。' });
    else if (reason === 'pressure') out.push({ k: 'line', who: 'sys', t: '对方等不及，先挂了电话。' });
    else if (reason === 'timeout') out.push({ k: 'line', who: 'sys', t: '通话时间到了。对方说"我再想想"，挂断了电话。' });
    out.push({ k: 'end', outcome: oc, reason: reason });
  }
  function checkEnd(cs, st, out) {
    if (st.over) return true;
    if (st.prog >= st.need) finish(cs, st, out, 'win');
    else if (st.trust <= 0) finish(cs, st, out, 'hangup');
    else if (st.pressure >= 100) finish(cs, st, out, 'pressure');
    return st.over;
  }
  function checkPartial(cs, st, out) {
    var p = cs.partial;
    if (!p || st.partialDone || st.blocked || st.pressure < p.at) return;
    if (st.frozen) { st.blocked = true; out.push({ k: 'line', who: 'sys', t: '（对方想先转一笔 ¥' + fmt(p.amount) + '，但收款账户已被止付，转账失败。）' }); return; }
    st.partialDone = true;
    out.push({ k: 'line', who: 'sys', t: p.t || ('（听筒里"叮"的一声——对方已经先转出了 ¥' + fmt(p.amount) + '。）') });
    out.push({ k: 'sfx', name: 'wrong' });
  }

  /* ---------- 行动 ---------- */
  function act(cs, st, ctx, action) {
    ctx = ctx || {};
    var out = [];
    if (st.over) return out;
    st.turn++;
    var genuine = cs.type === 'genuine';

    if (action.kind === 'ask') {
      var q = (cs.questions || []).filter(function (x) { return x.id === action.id; })[0];
      if (!q) return out;
      st.asked.push(q.id);
      out.push({ k: 'line', who: 'me', t: q.q });
      say(out, q.a);
      if (q.clue) addClue(cs, st, out, q.clue, ctx);
      if (q.clue2) addClue(cs, st, out, q.clue2, ctx);
      delta(st, out, q.trust, q.pressure, q.prog);
      if (q.trust <= -10) out.push({ k: 'sfx', name: 'wrong' });
    }
    else if (action.kind === 'judge') {
      var id = action.id, T = TYPES[id] || { say: id };
      st.verdict = id;
      out.push({ k: 'line', who: 'me', t: (cs.judgeSay && cs.judgeSay[id]) || T.say });
      if (genuine) {
        if (id === 'genuine') {
          st.verdictOk = true;
          say(out, cs.onJudge || '……这么说，是真的银行？那我就放心多了。');
          out.push({ k: 'sfx', name: 'right' });
          delta(st, out, 10, -10, 0);
        } else {
          say(out, cs.onMisjudge || '啊？可、可对方明明……好吧，那我不理他了。');
          out.push({ k: 'sfx', name: 'wrong' });
          finish(cs, st, out, 'misjudge');
          return out;
        }
      } else if (id === cs.type) {
        st.verdictOk = true;
        say(out, cs.onJudge || '……你这么一说，好像真是这样。');
        out.push({ k: 'sfx', name: 'right' });
        delta(st, out, 10, -5, 0);
      } else if (id === 'genuine') {
        st.wrong++;
        say(out, cs.onGenuineWrong || '那我就放心了！我这就按他说的办。');
        out.push({ k: 'sfx', name: 'wrong' });
        delta(st, out, 5, 25, 0);
      } else {
        st.wrong++;
        say(out, cs.onWrongJudge || '可……我遇到的根本不是这样啊。你到底有没有在听我说？');
        out.push({ k: 'sfx', name: 'wrong' });
        delta(st, out, -25, 0, 0);
      }
    }
    else if (action.kind === 'persuade') {
      var o = persuadeList(cs, st, ctx).filter(function (x) { return x.id === action.id; })[0];
      if (!o) return out;
      st.used.push(o.id);
      out.push({ k: 'line', who: 'me', t: o.t });
      var tags = o.tags || [];
      if (genuine && has(tags, 'accuse')) {
        say(out, cs.onMisjudge || '骗子？可……那我别理他了？');
        out.push({ k: 'sfx', name: 'wrong' });
        finish(cs, st, out, 'misjudge');
        return out;
      }
      var eff = genuine && o.onGenuine ? o.onGenuine : o;
      var dt = eff.trust || 0, dp = eff.pressure || 0, dg = eff.prog || 0;
      if (eff.progIfVerdict && st.verdictOk) dg += eff.progIfVerdict;
      var c = cs.caller || {}, like = false, dislike = false;
      tags.forEach(function (tg) { if (has(c.likes || [], tg)) like = true; if (has(c.dislikes || [], tg)) dislike = true; });
      if (dislike) { dt -= 20; dg = 0; }
      else if (like) { dt += 8; if (dg > 0) dg += 1; }
      var reply;
      if (dislike) { var hit = firstHit(tags, c.dislikes); reply = (c.react && c.react[hit]) || DEFAULT_REACT[hit]; }
      else reply = o.a || (cs.react && cs.react[o.id]) || (dg > 0 ? '……嗯。我好像，有点明白了。' : dt < 0 ? '你这话说得，我听着不舒服。' : '……好吧，我听着。');
      say(out, reply);
      if (dislike || dt <= -15) out.push({ k: 'sfx', name: 'wrong' });
      delta(st, out, dt, dp, dg);
    }
    else if (action.kind === 'special') {
      var key = action.id, d = (cs.sp || {})[key];
      var sl = specialList(cs, st).filter(function (x) { return x.id === key; })[0];
      if (!d || !sl || !sl.ok) return out;
      st.spUsed.push(key); st.spLeft--;
      out.push({ k: 'sfx', name: 'special' });
      if (key === 'family') {
        say(out, d.a || [['m', '我们这边帮你联系一下家里人，好吗？'], ['x', '（家属接通，在电话里劝了几句。）']]);
        delta(st, out, 10, -10, st.verdictOk ? 2 : 1);
      } else if (key === 'freeze') {
        st.frozen = true;
        say(out, d.a || [['x', '（你把收款账户报给了值班民警，申请紧急止付。）'], ['x', '止付指令已下发——这个账户暂时收不到钱了。']]);
        if (st.partialDone && !st.recovered) { st.recovered = true; out.push({ k: 'line', who: 'sys', t: '刚才转出的那笔 ¥' + fmt(cs.partial.amount) + '，被拦在了路上。' }); }
        delta(st, out, 5, -15, d.prog || 0);
      } else if (key === 'hangup') {
        if (st.trust >= 35) {
          st.rateMod = 0.5;
          say(out, d.a || [['m', '你另一部手机还在通话吧？先把它挂掉，只听我说两分钟。'], ['x', '（另一部手机里的声音被掐断了。）']]);
          delta(st, out, 0, -20, d.prog || 0);
        } else {
          say(out, d.no || [['m', '先把另一部电话挂了吧？'], ['c', '不行！他说挂了就……我不敢。']]);
          delta(st, out, -10, 0, 0);
        }
      }
    }

    if (checkEnd(cs, st, out)) return out;
    // 回合结束：骗子那边催促
    var inc = Math.round(st.rate * st.rateMod);
    st.turnsLeft--;
    delta(st, out, 0, inc, 0);
    checkPartial(cs, st, out);
    if (checkEnd(cs, st, out)) return out;
    fireEvents(cs, st, out);
    checkPartial(cs, st, out);
    if (checkEnd(cs, st, out)) return out;
    if (st.turnsLeft <= 0) finish(cs, st, out, 'timeout');
    return out;
  }
  function firstHit(tags, list) { for (var i = 0; i < tags.length; i++) if (has(list || [], tags[i])) return tags[i]; return tags[0]; }

  function settle(cs, st) {
    var oc = st.outcome, amt = cs.amount || 0, part = cs.partial ? cs.partial.amount : Math.round(amt / 3);
    var saved = 0, lost = 0;
    if (cs.type !== 'genuine') {
      if (oc === 'perfect') saved = amt;
      else if (oc === 'partial') { saved = amt - part; lost = part; }
      else if (oc === 'scammed') lost = amt;
    }
    var rep = { perfect: 6, partial: 2, scammed: -4, misjudge: -10 }[oc] || 0;
    return { outcome: oc, saved: saved, lost: lost, rep: rep };
  }

  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function clone(st) { return JSON.parse(JSON.stringify(st)); }

  var Engine = { TYPES: TYPES, SKILLS: SKILLS, GENERIC: GENERIC, SPECIAL_NAMES: SPECIAL_NAMES,
    newCall: newCall, act: act, options: options, legalActions: legalActions, settle: settle, clone: clone, fmt: fmt };
  if (typeof module !== 'undefined' && module.exports) module.exports = Engine;
  else root.Engine = Engine;
})(this);
