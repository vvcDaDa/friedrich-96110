#!/usr/bin/env node
/* =========================================================================
 * tools/simulate.js — 平衡与可解性模拟
 * 用法：node tools/simulate.js [随机局数，默认 4000]
 *
 * 直接加载游戏里的 js/engine.js、js/cases.js、js/story.js（与浏览器同一套规则），然后：
 *  1. 穷举搜索（带记忆化的 DFS）：每个案例是否存在"完全拦截/正确放行"的路线
 *  2. 随机玩家：每回合先随机选一类行动，再随机选一个选项
 *  3. 正确玩家：每回合都做"对"的选择（先问关键线索 → 判断正确 → 特殊行动 → 最有效的劝说）
 *  4. 整局模拟：随机 / 普通（ε-贪心）/ 正确 三类玩家打完 7 夜，统计各结局比例
 * ========================================================================= */
'use strict';
var vm = require('vm'), fs = require('fs'), path = require('path');
var root = path.join(__dirname, '..', 'js');
var sb = { console: console }; vm.createContext(sb);
['engine', 'cases', 'story'].forEach(function (f) { vm.runInContext(fs.readFileSync(path.join(root, f + '.js'), 'utf8'), sb, { filename: f + '.js' }); });
var E = sb.Engine, S = sb.STORY, CM = sb.CASE_MAP, CASES = sb.CASES;
var N_RANDOM = +process.argv[2] || 4000;
var RANK = { perfect: 3, partial: 2, scammed: 1, misjudge: 0 };

/* 可复现随机数 */
var seed = 20261124;
function rnd() { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return ((seed >>> 0) % 1e9) / 1e9; }
function pick(a) { return a[Math.floor(rnd() * a.length)]; }

/* 某一夜开始时玩家拥有的技能（第 n 夜之前的白天学到的） */
function skillsAt(night) { return S.SKILL_ORDER.slice(0, night - 1); }
function spAt(night, skills) { return (S.NIGHTS[night - 1].sp || 2) + (skills.indexOf('extra') >= 0 ? 1 : 0); }
function ctxFor(cs, opt) {
  opt = opt || {};
  var sk = opt.skills || skillsAt(cs.night);
  return { skills: sk, links: opt.links || S.LINKS.map(function (l) { return l.id; }), sp: opt.sp != null ? opt.sp : spAt(cs.night, sk) };
}

/* ---------- 1. 穷举 ---------- */
function solve(cs, ctx) {
  var memo = new Map(), nodes = 0, bestPath = null;
  function key(st) { return [st.trust, st.pressure, st.prog, st.turnsLeft, st.asked.join(), st.clues.join(), st.used.join(), st.spUsed.join(), st.verdictOk ? 1 : 0, st.wrong, st.frozen ? 1 : 0, st.partialDone ? 1 : 0, st.recovered ? 1 : 0, st.blocked ? 1 : 0, st.rateMod, st.spLeft, st.turn].join('|'); }
  function dfs(st, trail) {
    if (st.over) return RANK[st.outcome];
    var k = key(st); if (memo.has(k)) return memo.get(k);
    if (++nodes > 3e6) return -1;
    var best = -1, acts = E.legalActions(cs, st, ctx);
    for (var i = 0; i < acts.length; i++) {
      var s2 = E.clone(st); E.act(cs, s2, ctx, acts[i]);
      var r = dfs(s2, trail.concat([acts[i]]));
      if (r > best) best = r;
      if (r === 3) { if (!bestPath) bestPath = trail.concat([acts[i]]); break; }
    }
    memo.set(k, best); return best;
  }
  var st = E.newCall(cs, ctx).st;
  var best = dfs(st, []);
  return { best: best, nodes: nodes, path: bestPath };
}

/* ---------- 2. 随机玩家 ---------- */
function randomPlay(cs, ctx) {
  var st = E.newCall(cs, ctx).st;
  while (!st.over) {
    var acts = E.legalActions(cs, st, ctx);
    var cats = {}; acts.forEach(function (a) { (cats[a.kind] = cats[a.kind] || []).push(a); });
    var a = pick(cats[pick(Object.keys(cats))]);
    E.act(cs, st, ctx, a);
  }
  return st;
}

/* ---------- 3. 正确玩家（每回合都选对） ---------- */
function goodAction(cs, st, ctx) {
  var o = E.options(cs, st, ctx), sp = cs.sp || {};
  var spOk = function (k) { return o.special.some(function (s) { return s.id === k && s.ok; }); };
  // 挂掉另一部电话：越早越好
  if (spOk('hangup') && st.trust >= 35) return { kind: 'special', id: 'hangup' };
  // 需要的线索：特殊行动前置、针对性劝说前置、线索墙、能推进定位的提问
  var need = {};
  ['family', 'freeze'].forEach(function (k) { if (sp[k] && sp[k].clue && st.spLeft > 0) need[sp[k].clue] = 1; });
  (cs.persuade || []).forEach(function (p) { if (p.reqClue) need[p.reqClue] = 1; });
  Object.keys(cs.clues).forEach(function (k) { if (cs.clues[k].wall && cs.type !== 'genuine') need[k] = 1; });
  var qs = o.ask.filter(function (q) { return (q.trust || 0) >= 0; });
  var q1 = qs.filter(function (q) { return (q.clue && need[q.clue]) || (q.prog > 0); })
    .sort(function (a, b) { return (b.prog || 0) - (a.prog || 0); })[0];
  if (q1) return { kind: 'ask', id: q1.id };
  if (!st.verdictOk) {
    if (!st.clues.length) { var any = qs.filter(function (q) { return q.clue; })[0]; if (any) return { kind: 'ask', id: any.id }; }
    return { kind: 'judge', id: cs.type };
  }
  if (spOk('freeze')) return { kind: 'special', id: 'freeze' };
  if (spOk('family') && st.need - st.prog >= 2) return { kind: 'special', id: 'family' };
  // 劝说：按预期进度 > 信任 > 施压排序，避开会被讨厌的标签
  var c = cs.caller || {};
  var scored = o.persuade.map(function (p) {
    var eff = cs.type === 'genuine' && p.onGenuine ? p.onGenuine : p;
    var tags = p.tags || [];
    if (cs.type === 'genuine' && tags.indexOf('accuse') >= 0) return null;
    var dg = (eff.prog || 0) + (eff.progIfVerdict && st.verdictOk ? eff.progIfVerdict : 0), dt = eff.trust || 0, dp = eff.pressure || 0;
    var dis = tags.some(function (t) { return (c.dislikes || []).indexOf(t) >= 0; });
    var like = tags.some(function (t) { return (c.likes || []).indexOf(t) >= 0; });
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
function play(cs, ctx, chooser) {
  var st = E.newCall(cs, ctx).st, guard = 0;
  while (!st.over && guard++ < 40) E.act(cs, st, ctx, chooser(cs, st, ctx));
  return st;
}
function epsPlayer(eps) {
  return function (cs, st, ctx) {
    if (rnd() < eps) {
      var acts = E.legalActions(cs, st, ctx), cats = {};
      acts.forEach(function (a) { (cats[a.kind] = cats[a.kind] || []).push(a); });
      return pick(cats[pick(Object.keys(cats))]);
    }
    return goodAction(cs, st, ctx);
  };
}

/* ---------- 4. 整局 ---------- */
function fullGame(chooser, wallSkill) {
  var g = { saved: 0, max: 0, mis: 0, bank: [], links: [], skills: [], res: {}, perfect: 0, calls: 0 };
  S.NIGHTS.forEach(function (N, ni) {
    var sp = spAt(N.n, g.skills);
    N.cases.forEach(function (id) {
      var cs = CM[id], ctx = { skills: g.skills.slice(), links: g.links.slice(), sp: sp };
      var st = play(cs, ctx, chooser); sp = st.spLeft;
      var r = E.settle(cs, st);
      g.res[id] = r.outcome; g.saved += r.saved; if (cs.type !== 'genuine') g.max += cs.amount;
      if (r.outcome === 'misjudge') g.mis++;
      if (r.outcome === 'perfect') g.perfect++; g.calls++;
      st.clues.forEach(function (k) { if (cs.clues[k].wall) g.bank.push(id + '.' + k); });
    });
    if (ni < S.NIGHTS.length - 1) {
      // 白天线索墙：wallSkill=1 全找；0 随机连（3 次试错）；介于之间按概率找到
      var tries = 3, possible = S.LINKS.filter(function (L) { return g.links.indexOf(L.id) < 0 && L.set.filter(function (x) { return g.bank.indexOf(x) >= 0; }).length >= 2; });
      if (wallSkill > 0) possible.forEach(function (L) { if (rnd() < wallSkill) g.links.push(L.id); });
      else {
        var guard = 0;
        while (tries > 0 && g.bank.length >= 2 && guard++ < 50) {
          var a = pick(g.bank), b = pick(g.bank); if (a === b) continue;
          var L = S.LINKS.filter(function (l) { return l.set.indexOf(a) >= 0 && l.set.indexOf(b) >= 0; })[0];
          if (L) { if (g.links.indexOf(L.id) < 0) g.links.push(L.id); } else tries--;
        }
      }
      g.skills.push(S.SKILL_ORDER[ni]);
    }
  });
  var busted = g.res[S.BOSS_ID] === 'perfect' && g.links.length >= S.BUST_LINKS;
  g.busted = busted;
  g.ending = S.decideEnding({ saved: g.saved, maxSaved: g.max, mis: g.mis, busted: busted });
  return g;
}

/* ======================= 运行 ======================= */
function pct(x) { return (x * 100).toFixed(1) + '%'; }
var NAME = { perfect: '完全拦截', partial: '部分损失', scammed: '被骗', misjudge: '误判' };
console.log('# 《96110 夜班》平衡模拟报告\n');
console.log('随机局数：每个案例 ' + N_RANDOM + ' 次；整局模拟各 ' + Math.round(N_RANDOM / 4) + ' 局。\n');
console.log('## 一、逐案例\n');
console.log('| 案例 | 来电者 | 真实类型 | 穷举最佳 | 搜索节点 | 正确玩家 | 随机：完全拦截 | 随机：部分 | 随机：被骗 | 随机：误判 |');
console.log('|---|---|---|---|---|---|---|---|---|---|');
var totR = { perfect: 0, partial: 0, scammed: 0, misjudge: 0 }, totN = 0, unsolved = [], goodFail = [];
CASES.forEach(function (cs) {
  var ctx = ctxFor(cs);
  var sol = solve(cs, ctx);
  var gst = play(cs, ctx, goodAction);
  if (sol.best !== 3) unsolved.push(cs.id);
  if (gst.outcome !== 'perfect') goodFail.push(cs.id + '(' + gst.outcome + ')');
  var cnt = { perfect: 0, partial: 0, scammed: 0, misjudge: 0 };
  for (var i = 0; i < N_RANDOM; i++) { var st = randomPlay(cs, ctxFor(cs)); cnt[st.outcome]++; totR[st.outcome]++; totN++; }
  var bestName = ['误判', '被骗', '部分损失', cs.type === 'genuine' ? '正确放行' : '完全拦截'][sol.best] || '超出搜索上限';
  console.log('| ' + cs.id + ' | ' + cs.caller.name + ' | ' + E.TYPES[cs.type].name + ' | ' + bestName + ' | ' + sol.nodes + ' | ' + (cs.type === 'genuine' && gst.outcome === 'perfect' ? '正确放行' : NAME[gst.outcome]) +
    ' | ' + pct(cnt.perfect / N_RANDOM) + ' | ' + pct(cnt.partial / N_RANDOM) + ' | ' + pct(cnt.scammed / N_RANDOM) + ' | ' + pct(cnt.misjudge / N_RANDOM) + ' |');
});
console.log('\n**汇总**');
console.log('- 存在完全拦截路线的案例：' + (CASES.length - unsolved.length) + ' / ' + CASES.length + (unsolved.length ? '（无解：' + unsolved.join(', ') + '）' : '（无无解关卡）'));
console.log('- 正确玩家完全拦截率：' + pct((CASES.length - goodFail.length) / CASES.length) + (goodFail.length ? '（失败：' + goodFail.join(', ') + '）' : ''));
console.log('- 随机玩家：完全拦截 ' + pct(totR.perfect / totN) + '｜部分损失 ' + pct(totR.partial / totN) + '｜被骗 ' + pct(totR.scammed / totN) + '｜误判 ' + pct(totR.misjudge / totN));

console.log('\n## 二、整局（7 夜）结局分布\n');
var G = Math.round(N_RANDOM / 4);
var players = [
  ['随机玩家（乱选 + 线索墙乱连）', epsPlayer(1), 0],
  ['新手玩家（50% 乱选，线索墙找到 50%）', epsPlayer(0.5), 0.5],
  ['普通玩家（25% 乱选，线索墙找到 75%）', epsPlayer(0.25), 0.75],
  ['熟练玩家（10% 乱选，线索墙找到 90%）', epsPlayer(0.1), 0.9],
  ['慌乱玩家（真实来电都认对，但诈骗电话乱选，线索墙不连）', function (cs, st, ctx) { return cs.type === 'genuine' ? goodAction(cs, st, ctx) : epsPlayer(1)(cs, st, ctx); }, 0],
  ['正确玩家（每回合都选对，线索墙全找到）', goodAction, 1]
];
console.log('| 玩家 | 长夜有灯（好） | 天快亮了（普通） | 狼来了 | 电话还在响（坏） | 平均挽回率 | 平均误判 | 破获团伙 | 平均线索关联 |');
console.log('|---|---|---|---|---|---|---|---|---|');
players.forEach(function (p) {
  var end = { good: 0, normal: 0, wolf: 0, bad: 0 }, ratio = 0, mis = 0, bust = 0, links = 0;
  for (var i = 0; i < G; i++) { var g = fullGame(p[1], p[2]); end[g.ending]++; ratio += g.saved / g.max; mis += g.mis; bust += g.busted ? 1 : 0; links += g.links.length; }
  console.log('| ' + p[0] + ' | ' + pct(end.good / G) + ' | ' + pct(end.normal / G) + ' | ' + pct(end.wolf / G) + ' | ' + pct(end.bad / G) + ' | ' + pct(ratio / G) + ' | ' + (mis / G).toFixed(2) + ' | ' + pct(bust / G) + ' | ' + (links / G).toFixed(1) + ' / ' + S.LINKS.length + ' |');
});
var total = CASES.reduce(function (s, c) { return s + (c.type === 'genuine' ? 0 : c.amount); }, 0);
console.log('\n涉案总额：¥' + E.fmt(total) + '（好结局门槛 60% ≈ ¥' + E.fmt(Math.round(total * 0.6)) + '；坏结局线 50% ≈ ¥' + E.fmt(Math.round(total * 0.5)) + '）');
if (process.argv.indexOf('--paths') >= 0) {
  console.log('\n## 三、每个案例的一条完全拦截路线\n');
  CASES.forEach(function (cs) { var s = solve(cs, ctxFor(cs)); console.log('- ' + cs.id + '：' + (s.path || []).map(function (a) { return a.kind + ':' + a.id; }).join(' → ')); });
}
process.exitCode = unsolved.length || goodFail.length ? 1 : 0;
