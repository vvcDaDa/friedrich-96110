/* art.js — 全部美术都是内联 SVG
 * Art.friedrich(expr, {headset})  expr: calm|smile|worry|shock|focus|sad|tired
 * Art.person(spec)                 来电者头像，spec: {g:'m'|'f', age:'kid'|'young'|'mid'|'old', hair, skin, glasses, seed}
 * Art.skyline(seed, opts)          城市夜景天际线
 * Art.dutyRoom()                   值班室场景
 */
(function (root) {
  'use strict';
  var Art = {};

  function rng(seed) { var s = (seed >>> 0) || 7; return function () { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 10000) / 10000; }; }

  /* ---------- Friedrich ---------- */
  var EYES = {
    calm: '<circle cx="47" cy="62" r="3.2" fill="#1d1a22"/><circle cx="73" cy="62" r="3.2" fill="#1d1a22"/>',
    smile: '<path d="M42 63 q5 -6 10 0" stroke="#1d1a22" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M68 63 q5 -6 10 0" stroke="#1d1a22" stroke-width="3" fill="none" stroke-linecap="round"/>',
    worry: '<circle cx="47" cy="63" r="3" fill="#1d1a22"/><circle cx="73" cy="63" r="3" fill="#1d1a22"/>',
    shock: '<circle cx="47" cy="62" r="5" fill="#fff" stroke="#1d1a22" stroke-width="2"/><circle cx="47" cy="62" r="2" fill="#1d1a22"/><circle cx="73" cy="62" r="5" fill="#fff" stroke="#1d1a22" stroke-width="2"/><circle cx="73" cy="62" r="2" fill="#1d1a22"/>',
    focus: '<ellipse cx="47" cy="63" rx="3.4" ry="2.6" fill="#1d1a22"/><ellipse cx="73" cy="63" rx="3.4" ry="2.6" fill="#1d1a22"/>',
    sad: '<path d="M42 62 q5 4 10 0" stroke="#1d1a22" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M68 62 q5 4 10 0" stroke="#1d1a22" stroke-width="3" fill="none" stroke-linecap="round"/>',
    tired: '<path d="M42 63 h10" stroke="#1d1a22" stroke-width="3" stroke-linecap="round"/><path d="M68 63 h10" stroke="#1d1a22" stroke-width="3" stroke-linecap="round"/>'
  };
  var BROWS = {
    calm: 'M41 53 q6 -3 12 0 M67 53 q6 -3 12 0',
    smile: 'M41 52 q6 -3 12 0 M67 52 q6 -3 12 0',
    worry: 'M41 54 q6 -5 12 -3 M67 51 q6 -2 12 3',
    shock: 'M41 49 q6 -4 12 0 M67 49 q6 -4 12 0',
    focus: 'M41 52 l12 3 M79 52 l-12 3',
    sad: 'M41 55 q6 -5 12 -4 M67 51 q6 -1 12 4',
    tired: 'M41 55 q6 -2 12 0 M67 55 q6 -2 12 0'
  };
  var MOUTH = {
    calm: '<path d="M53 80 q7 4 14 0" stroke="#7a3b2e" stroke-width="2.6" fill="none" stroke-linecap="round"/>',
    smile: '<path d="M50 78 q10 10 20 0 z" fill="#7a3b2e"/><path d="M53 79 q7 3 14 0" fill="#fff"/>',
    worry: '<path d="M53 82 q3.5 -3 7 0 q3.5 3 7 0" stroke="#7a3b2e" stroke-width="2.6" fill="none" stroke-linecap="round"/>',
    shock: '<ellipse cx="60" cy="82" rx="5" ry="6" fill="#7a3b2e"/>',
    focus: '<path d="M53 81 h14" stroke="#7a3b2e" stroke-width="2.6" stroke-linecap="round"/>',
    sad: '<path d="M52 84 q8 -6 16 0" stroke="#7a3b2e" stroke-width="2.6" fill="none" stroke-linecap="round"/>',
    tired: '<path d="M54 82 q6 2 12 0" stroke="#7a3b2e" stroke-width="2.6" fill="none" stroke-linecap="round"/>'
  };
  Art.friedrich = function (expr, opt) {
    expr = EYES[expr] ? expr : 'calm'; opt = opt || {};
    var hs = opt.headset !== false;
    return '<svg class="av av-fr" viewBox="0 0 120 120" role="img" aria-label="Friedrich">' +
      '<defs><clipPath id="frc"><circle cx="60" cy="60" r="58"/></clipPath></defs>' +
      '<g clip-path="url(#frc)">' +
      '<rect width="120" height="120" fill="#22304a"/>' +
      '<path d="M18 120 q4 -26 42 -28 q38 2 42 28z" fill="#33507a"/>' +
      '<path d="M48 94 l12 10 l12 -10" fill="none" stroke="#a7c0e8" stroke-width="3"/>' +
      '<rect x="52" y="84" width="16" height="12" fill="#e9c3a2"/>' +
      '<ellipse cx="60" cy="62" rx="27" ry="29" fill="#f2d1b3"/>' +
      '<ellipse cx="33" cy="65" rx="4" ry="6" fill="#e9c3a2"/><ellipse cx="87" cy="65" rx="4" ry="6" fill="#e9c3a2"/>' +
      '<path d="M32 58 q-2 -30 28 -30 q30 0 28 30 q-4 -14 -14 -17 q-6 8 -22 7 q-10 0 -15 -5 q-4 6 -5 15z" fill="#2b2321"/>' +
      '<path d="M58 28 q6 -8 14 -4 q-6 1 -8 6z" fill="#2b2321"/>' +
      '<path d="' + BROWS[expr] + '" stroke="#2b2321" stroke-width="2.6" fill="none" stroke-linecap="round"/>' +
      EYES[expr] +
      '<circle cx="47" cy="62" r="9" fill="none" stroke="#3a3d48" stroke-width="1.8" opacity=".85"/><circle cx="73" cy="62" r="9" fill="none" stroke="#3a3d48" stroke-width="1.8" opacity=".85"/><path d="M56 62 h8" stroke="#3a3d48" stroke-width="1.8"/>' +
      (expr === 'tired' ? '<path d="M41 69 q6 3 12 0 M67 69 q6 3 12 0" stroke="#c99a86" stroke-width="1.5" fill="none"/>' : '') +
      '<ellipse cx="42" cy="74" rx="4" ry="2" fill="#f0a89a" opacity=".45"/><ellipse cx="78" cy="74" rx="4" ry="2" fill="#f0a89a" opacity=".45"/>' +
      MOUTH[expr] +
      (expr === 'sad' ? '<path d="M78 70 q2 5 0 7 q-2 -2 0 -7" fill="#8fd0ff"/>' : '') +
      (hs ? '<path d="M30 62 q0 -40 30 -40 q30 0 30 40" fill="none" stroke="#15171d" stroke-width="5"/><rect x="25" y="56" width="10" height="18" rx="4" fill="#15171d"/><rect x="85" y="56" width="10" height="18" rx="4" fill="#15171d"/><path d="M30 72 q2 14 20 12" fill="none" stroke="#15171d" stroke-width="2.5"/><circle cx="51" cy="84" r="3" fill="#ff8a3d"/>' : '') +
      '</g></svg>';
  };

  /* ---------- 来电者头像 ---------- */
  var SKINS = ['#f2d1b3', '#e8bf9a', '#d9a982', '#f5dcc6'];
  var HAIRS = { black: '#231f20', brown: '#5a3b2a', gray: '#a7a7ad', white: '#dcdce2', dye: '#7a4a7d' };
  Art.person = function (p) {
    p = p || {}; var r = rng(p.seed || 3);
    var skin = p.skin || SKINS[Math.floor(r() * SKINS.length)];
    var age = p.age || 'young', g = p.g || 'm';
    var hc = HAIRS[p.hair] || (age === 'old' ? HAIRS.gray : HAIRS.black);
    var bg = p.bg || ['#2d3b56', '#3b2d4f', '#24414a', '#4a3a2c'][Math.floor(r() * 4)];
    var shirt = p.shirt || ['#6b8fbf', '#b5735a', '#7a9f6b', '#a06fa8', '#c9a227'][Math.floor(r() * 5)];
    var faceRy = age === 'kid' ? 25 : 28, cy = age === 'kid' ? 64 : 60;
    var hair = '';
    if (g === 'f') {
      hair = age === 'old'
        ? '<path d="M32 58 q0 -30 28 -30 q28 0 28 30 q-6 -16 -28 -16 q-22 0 -28 16z" fill="' + hc + '"/><circle cx="60" cy="27" r="9" fill="' + hc + '"/>'
        : '<path d="M30 92 q-6 -64 30 -64 q36 0 30 64 q-6 -2 -8 -10 q4 -24 -4 -34 q-14 10 -38 8 q-6 12 -2 26 q-2 8 -8 10z" fill="' + hc + '"/>';
    } else {
      hair = age === 'old'
        ? '<path d="M33 55 q2 -22 27 -22 q25 0 27 22 q-6 -10 -27 -12 q-21 2 -27 12z" fill="' + hc + '" opacity=".95"/>'
        : '<path d="M32 58 q-2 -30 28 -30 q30 0 28 30 q-3 -12 -10 -15 q-10 6 -36 3 q-6 4 -10 12z" fill="' + hc + '"/>';
    }
    var eyes = '<circle cx="48" cy="' + (cy + 2) + '" r="3" fill="#1d1a22"/><circle cx="72" cy="' + (cy + 2) + '" r="3" fill="#1d1a22"/>';
    var brows = p.mood === 'anx'
      ? '<path d="M42 ' + (cy - 6) + ' q6 -5 12 -2 M66 ' + (cy - 8) + ' q6 -1 12 3" stroke="' + (age === 'old' ? '#77777d' : '#2b2321') + '" stroke-width="2.4" fill="none" stroke-linecap="round"/>'
      : '<path d="M42 ' + (cy - 7) + ' q6 -3 12 0 M66 ' + (cy - 7) + ' q6 -3 12 0" stroke="' + (age === 'old' ? '#77777d' : '#2b2321') + '" stroke-width="2.4" fill="none" stroke-linecap="round"/>';
    var mouth = p.mood === 'happy' ? '<path d="M52 ' + (cy + 17) + ' q8 7 16 0" stroke="#7a3b2e" stroke-width="2.4" fill="none" stroke-linecap="round"/>'
      : p.mood === 'sly' ? '<path d="M50 ' + (cy + 18) + ' q10 4 18 -4" stroke="#7a3b2e" stroke-width="2.4" fill="none" stroke-linecap="round"/>'
      : '<path d="M53 ' + (cy + 19) + ' q7 -3 14 0" stroke="#7a3b2e" stroke-width="2.4" fill="none" stroke-linecap="round"/>';
    var wr = age === 'old' ? '<path d="M38 ' + (cy + 8) + ' q3 3 6 2 M76 ' + (cy + 10) + ' q3 -1 6 -2 M50 ' + (cy - 14) + ' h20" stroke="#b98d76" stroke-width="1.4" fill="none"/>' : '';
    var gl = p.glasses ? '<rect x="38" y="' + (cy - 5) + '" width="19" height="14" rx="5" fill="none" stroke="#2c2f38" stroke-width="2"/><rect x="63" y="' + (cy - 5) + '" width="19" height="14" rx="5" fill="none" stroke="#2c2f38" stroke-width="2"/><path d="M57 ' + (cy + 1) + ' h6" stroke="#2c2f38" stroke-width="2"/>' : '';
    var extra = p.cap ? '<path d="M30 48 q30 -30 60 0 z" fill="' + p.cap + '"/><path d="M60 46 h34 q-4 6 -34 6z" fill="' + p.cap + '" opacity=".8"/>' : '';
    if (p.uniform) { shirt = '#20314f'; extra += '<path d="M44 40 h32 l-4 -10 h-24z" fill="#1b2a44"/><circle cx="60" cy="34" r="3" fill="#d8b44a"/>'; }
    var id = 'pc' + Math.floor(r() * 1e6);
    return '<svg class="av" viewBox="0 0 120 120" role="img" aria-label="来电者头像">' +
      '<defs><clipPath id="' + id + '"><circle cx="60" cy="60" r="58"/></clipPath></defs><g clip-path="url(#' + id + ')">' +
      '<rect width="120" height="120" fill="' + bg + '"/>' +
      (g === 'f' && age !== 'old' ? hair : '') +
      '<path d="M16 120 q4 -28 44 -30 q40 2 44 30z" fill="' + shirt + '"/>' +
      '<rect x="52" y="' + (cy + 22) + '" width="16" height="12" fill="' + skin + '"/>' +
      '<ellipse cx="60" cy="' + cy + '" rx="26" ry="' + faceRy + '" fill="' + skin + '"/>' +
      (g === 'f' && age !== 'old' ? '' : hair) +
      (g === 'f' && age !== 'old' ? '<path d="M34 54 q8 -22 26 -24 q18 2 26 24 q-12 -12 -26 -12 q-14 0 -26 12z" fill="' + hc + '"/>' : '') +
      brows + eyes + gl + wr + mouth +
      '<ellipse cx="43" cy="' + (cy + 12) + '" rx="4" ry="2" fill="#f0a89a" opacity=".4"/><ellipse cx="77" cy="' + (cy + 12) + '" rx="4" ry="2" fill="#f0a89a" opacity=".4"/>' +
      extra + '</g></svg>';
  };

  /* 未知来电 / 骗子剪影 */
  Art.shadow = function () {
    return '<svg class="av" viewBox="0 0 120 120" role="img" aria-label="未知"><defs><clipPath id="shc"><circle cx="60" cy="60" r="58"/></clipPath></defs><g clip-path="url(#shc)"><rect width="120" height="120" fill="#2a1d24"/>' +
      '<ellipse cx="60" cy="58" rx="26" ry="29" fill="#0e0b10"/><path d="M16 120 q4 -28 44 -30 q40 2 44 30z" fill="#0e0b10"/>' +
      '<rect x="40" y="56" width="40" height="8" rx="4" fill="#ff4d6a" opacity=".8"/></g></svg>';
  };

  /* ---------- 天际线 ---------- */
  Art.skyline = function (seed, opt) {
    opt = opt || {}; var r = rng(seed || 96110), W = 800, H = 320, out = [];
    out.push('<svg class="skyline" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMax slice" aria-hidden="true"' + (opt.w ? ' x="' + opt.x + '" y="' + opt.y + '" width="' + opt.w + '" height="' + opt.h + '"' : '') + '>');
    out.push('<defs><linearGradient id="skyg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#070b18"/><stop offset=".65" stop-color="#121b36"/><stop offset="1" stop-color="#2a2340"/></linearGradient>' +
      '<radialGradient id="moong"><stop offset="0" stop-color="#fff6d8" stop-opacity=".9"/><stop offset="1" stop-color="#fff6d8" stop-opacity="0"/></radialGradient></defs>');
    if (!opt.noSky) {
      out.push('<rect width="' + W + '" height="' + H + '" fill="url(#skyg)"/>');
      for (var s = 0; s < 60; s++) out.push('<circle class="star" style="animation-delay:' + (r() * 5).toFixed(2) + 's" cx="' + (r() * W).toFixed(0) + '" cy="' + (r() * 150).toFixed(0) + '" r="' + (r() * 1.2 + 0.3).toFixed(1) + '" fill="#fff"/>');
      out.push('<circle cx="640" cy="70" r="60" fill="url(#moong)"/><circle cx="640" cy="70" r="22" fill="#f6efd6"/><circle cx="632" cy="64" r="20" fill="#121b36" opacity=".18"/>');
    }
    // 远景楼
    var layers = [{ c: '#141c33', h: [90, 170], w: [30, 60], y: 0, lit: 0.08 }, { c: '#0c1224', h: [60, 210], w: [36, 80], y: 0, lit: 0.18 }];
    layers.forEach(function (L, li) {
      var x = -10;
      while (x < W) {
        var bw = L.w[0] + r() * (L.w[1] - L.w[0]), bh = L.h[0] + r() * (L.h[1] - L.h[0]);
        out.push('<rect x="' + x.toFixed(0) + '" y="' + (H - bh).toFixed(0) + '" width="' + bw.toFixed(0) + '" height="' + bh.toFixed(0) + '" fill="' + L.c + '"/>');
        if (li === 1 && r() < 0.25) out.push('<rect x="' + (x + bw / 2 - 1).toFixed(0) + '" y="' + (H - bh - 18).toFixed(0) + '" width="2" height="18" fill="' + L.c + '"/><circle class="blink" cx="' + (x + bw / 2).toFixed(0) + '" cy="' + (H - bh - 19).toFixed(0) + '" r="2" fill="#ff4d4d"/>');
        for (var wy = H - bh + 8; wy < H - 6; wy += 11) for (var wx = x + 5; wx < x + bw - 6; wx += 9) {
          if (r() < L.lit) {
            var warm = r() < 0.75;
            out.push('<rect class="' + (r() < 0.12 ? 'win flick' : 'win') + '" style="animation-delay:' + (r() * 8).toFixed(1) + 's" x="' + wx.toFixed(0) + '" y="' + wy.toFixed(0) + '" width="4" height="6" fill="' + (warm ? '#ffcf7a' : '#9fd3ff') + '" opacity="' + (0.5 + r() * 0.5).toFixed(2) + '"/>');
          }
        }
        x += bw + (li === 0 ? r() * 10 : 2);
      }
    });
    out.push('</svg>');
    return out.join('');
  };

  /* ---------- 值班室 ---------- */
  Art.dutyRoom = function (night) {
    var portrait = typeof window !== 'undefined' && window.innerWidth < window.innerHeight * 0.8;
    return '<svg class="room" viewBox="' + (portrait ? '110 0 300 500' : '0 0 800 500') + '" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' +
      '<defs><radialGradient id="lampg" cx="0.5" cy="0" r="0.8"><stop offset="0" stop-color="#ffcf8a" stop-opacity=".55"/><stop offset="1" stop-color="#ffcf8a" stop-opacity="0"/></radialGradient>' +
      '<linearGradient id="wallg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#121829"/><stop offset="1" stop-color="#0b0f1c"/></linearGradient>' +
      '<clipPath id="winclip"><rect x="420" y="40" width="330" height="250" rx="4"/></clipPath></defs>' +
      '<rect width="800" height="500" fill="url(#wallg)"/>' +
      '<g clip-path="url(#winclip)">' + Art.skyline(900 + (night || 1), { x: 420, y: 40, w: 330, h: 250 }) + '</g>' +
      '<rect x="420" y="40" width="330" height="250" rx="4" fill="none" stroke="#2c3550" stroke-width="10"/><path d="M585 40 v250 M420 165 h330" stroke="#2c3550" stroke-width="6"/>' +
      '<rect x="60" y="70" width="150" height="90" rx="4" fill="#1a2238" stroke="#2a3452" stroke-width="3"/>' +
      '<text x="135" y="105" text-anchor="middle" fill="#7f93c4" font-size="14" font-family="sans-serif">值班表</text><path d="M80 120 h110 M80 134 h80 M80 148 h96" stroke="#3a4870" stroke-width="3"/>' +
      '<rect x="0" y="360" width="800" height="140" fill="#1b1714"/><rect x="0" y="352" width="800" height="14" fill="#2b241e"/>' +
      '<ellipse cx="200" cy="360" rx="230" ry="120" fill="url(#lampg)"/>' +
      '<path d="M150 350 l20 -110 l-40 -40" stroke="#3a3330" stroke-width="7" fill="none" stroke-linecap="round"/><path d="M95 205 l70 -30 l18 30 z" fill="#d08a3c"/><ellipse cx="140" cy="210" rx="30" ry="8" fill="#ffe2a8" opacity=".9"/>' +
      '<polygon points="120,212 170,206 330,360 60,360" fill="#ffd79a" opacity=".12"/>' +
      '<rect x="270" y="230" width="190" height="120" rx="6" fill="#0d1220" stroke="#2c3550" stroke-width="5"/><rect x="282" y="242" width="166" height="96" fill="#0f2a3a"/>' +
      '<text x="365" y="290" text-anchor="middle" fill="#5fe0c0" font-size="26" font-family="monospace" class="mon">96110</text><text x="365" y="315" text-anchor="middle" fill="#5fe0c0" font-size="10" font-family="monospace" opacity=".7">LINE READY_</text>' +
      '<rect x="350" y="350" width="30" height="8" fill="#2c3550"/>' +
      '<path d="M520 345 q0 -45 40 -45 q40 0 40 45" fill="none" stroke="#111" stroke-width="8"/><rect x="510" y="330" width="18" height="26" rx="6" fill="#151515"/><rect x="592" y="330" width="18" height="26" rx="6" fill="#151515"/><circle cx="601" cy="343" r="3" fill="#ff8a3d" class="blink"/>' +
      '<rect x="660" y="318" width="34" height="38" rx="4" fill="#d9d4c7"/><path d="M694 326 q14 4 0 18" fill="none" stroke="#d9d4c7" stroke-width="5"/><path class="steam" d="M670 310 q6 -10 0 -20 q-6 -10 0 -20 M684 310 q6 -10 0 -20 q-6 -10 0 -20" stroke="#aab" stroke-width="2" fill="none" opacity=".4"/>' +
      '</svg>';
  };

  root.Art = Art;
})(this);
