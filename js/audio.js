/* audio.js — 全部声音由 Web Audio 实时合成，没有任何音频文件
 * Sfx.play(name)：ring / clue / right / wrong / win / fail / special / tick / click / drop / link
 * Music.mood('calm' | 'tense' | 'sad' | 'off')
 * Sound.toggle()：一键开关全部声音
 */
(function (root) {
  'use strict';
  var ctx = null, master = null, musicBus = null, sfxBus = null, enabled = true;

  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return ctx; }
    var AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = enabled ? 0.9 : 0; master.connect(ctx.destination);
      musicBus = ctx.createGain(); musicBus.gain.value = 0.32; musicBus.connect(master);
      sfxBus = ctx.createGain(); sfxBus.gain.value = 0.55; sfxBus.connect(master);
    } catch (e) { ctx = null; }
    return ctx;
  }

  function tone(freq, t0, dur, opt) {
    opt = opt || {};
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = opt.type || 'sine';
    o.frequency.setValueAtTime(freq, t0);
    if (opt.slide) o.frequency.exponentialRampToValueAtTime(opt.slide, t0 + dur);
    var v = opt.vol == null ? 0.3 : opt.vol, a = opt.attack || 0.008;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(v, t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    var node = g;
    if (opt.filter) {
      var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = opt.filter; g.connect(f); node = f;
    }
    o.connect(g); node.connect(opt.bus || sfxBus);
    o.start(t0); o.stop(t0 + dur + 0.05);
    return o;
  }
  function noise(t0, dur, vol, hp) {
    var len = Math.floor(ctx.sampleRate * dur), buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var s = ctx.createBufferSource(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    s.buffer = buf; f.type = 'highpass'; f.frequency.value = hp || 2000; g.gain.value = vol || 0.08;
    s.connect(f); f.connect(g); g.connect(sfxBus); s.start(t0);
  }

  var Sfx = {
    play: function (name) {
      if (!enabled || !ensure()) return;
      var t = ctx.currentTime + 0.01, i;
      switch (name) {
        case 'ring': // 两段式电话铃：双频叠加 + 颤音
          for (i = 0; i < 2; i++) {
            var s0 = t + i * 0.5;
            for (var k = 0; k < 8; k++) {
              tone(880, s0 + k * 0.05, 0.045, { type: 'triangle', vol: 0.12 });
              tone(1320, s0 + k * 0.05, 0.045, { type: 'sine', vol: 0.07 });
            }
          }
          break;
        case 'clue': [784, 988, 1319].forEach(function (f, j) { tone(f, t + j * 0.07, 0.25, { type: 'triangle', vol: 0.16 }); }); break;
        case 'right': tone(659, t, 0.18, { type: 'sine', vol: 0.22 }); tone(988, t + 0.1, 0.35, { type: 'sine', vol: 0.2 }); break;
        case 'wrong': tone(220, t, 0.32, { type: 'sawtooth', vol: 0.12, slide: 140, filter: 900 }); tone(233, t, 0.32, { type: 'square', vol: 0.05, slide: 150, filter: 700 }); break;
        case 'special': tone(523, t, 0.12, { type: 'square', vol: 0.07, filter: 2000 }); tone(784, t + 0.08, 0.2, { type: 'square', vol: 0.07, filter: 2000 }); break;
        case 'win': [523, 659, 784, 1047].forEach(function (f, j) { tone(f, t + j * 0.11, 0.6, { type: 'triangle', vol: 0.17 }); }); tone(1568, t + 0.5, 0.9, { vol: 0.06 }); break;
        case 'fail': [392, 349, 311, 262].forEach(function (f, j) { tone(f, t + j * 0.2, 0.55, { type: 'sine', vol: 0.18, filter: 1500 }); }); break;
        case 'tick': tone(1800 + Math.random() * 400, t, 0.02, { type: 'square', vol: 0.018, filter: 3000 }); break;
        case 'click': tone(1200, t, 0.04, { type: 'triangle', vol: 0.06 }); break;
        case 'drop': noise(t, 0.25, 0.15, 400); tone(110, t, 0.3, { type: 'sine', vol: 0.25, slide: 60 }); break;
        case 'link': tone(523, t, 0.15, { vol: 0.15 }); tone(784, t + 0.08, 0.15, { vol: 0.15 }); tone(1047, t + 0.16, 0.4, { vol: 0.15 }); break;
        case 'msg': tone(1047, t, 0.08, { type: 'sine', vol: 0.12 }); tone(1397, t + 0.07, 0.12, { type: 'sine', vol: 0.1 }); break;
        case 'hang': tone(480, t, 0.18, { type: 'square', vol: 0.05, filter: 1200 }); tone(480, t + 0.3, 0.18, { type: 'square', vol: 0.05, filter: 1200 }); tone(480, t + 0.6, 0.18, { type: 'square', vol: 0.05, filter: 1200 }); break;
      }
    }
  };

  /* ---------- 生成式背景音乐 ---------- */
  var N = function (m) { return 440 * Math.pow(2, (m - 69) / 12); };
  var MOODS = {
    calm: { bpm: 66, chords: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]], arp: true, lead: 0.05, pad: 0.05, type: 'triangle' },
    tense: { bpm: 112, chords: [[50, 53, 57], [50, 53, 56], [49, 53, 56], [50, 53, 57]], pulse: true, pad: 0.035, type: 'sawtooth' },
    sad: { bpm: 52, chords: [[57, 60, 64], [52, 55, 59], [53, 57, 60], [52, 56, 59]], arp: true, lead: 0.06, pad: 0.045, type: 'sine', sparse: true }
  };
  var cur = null, timer = null, step = 0, nextT = 0, moodGain = null;

  function schedule() {
    if (!cur || !ctx) return;
    var m = MOODS[cur], spb = 60 / m.bpm / 2; // 八分音符
    while (nextT < ctx.currentTime + 0.25) {
      var bar = Math.floor(step / 8) % m.chords.length, ch = m.chords[bar], pos = step % 8;
      if (pos === 0) ch.forEach(function (n) { tone(N(n), nextT, spb * 8.2, { type: m.type, vol: m.pad, attack: 0.4, filter: cur === 'tense' ? 700 : 1200, bus: moodGain }); });
      if (m.arp && (!m.sparse || pos % 2 === 0)) {
        var seq = [0, 1, 2, 1, 2, 0, 1, 2], nn = ch[seq[pos]] + 12;
        if (!(m.sparse && Math.random() < 0.3)) tone(N(nn), nextT, spb * 1.8, { type: 'sine', vol: m.lead, filter: 2200, bus: moodGain });
      }
      if (m.pulse) {
        tone(N(ch[0] - 12), nextT, spb * 0.7, { type: 'square', vol: 0.05, filter: 380, bus: moodGain });
        if (pos === 4) noise(nextT, 0.05, 0.03, 5000);
        if (pos % 4 === 2) tone(N(ch[2] + 12 + (bar === 2 ? 1 : 0)), nextT, spb * 0.5, { type: 'triangle', vol: 0.025, bus: moodGain });
      }
      nextT += spb; step++;
    }
  }

  var Music = {
    current: function () { return cur; },
    mood: function (name) {
      if (name === cur) return;
      if (!ensure()) { cur = name === 'off' ? null : name; return; }
      var old = moodGain;
      if (old) { old.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.4); setTimeout(function () { try { old.disconnect(); } catch (e) {} }, 2500); }
      clearInterval(timer); timer = null;
      cur = (name === 'off' || !MOODS[name]) ? null : name;
      if (!cur) return;
      moodGain = ctx.createGain(); moodGain.gain.value = 0.0001; moodGain.connect(musicBus);
      moodGain.gain.setTargetAtTime(1, ctx.currentTime, 0.8);
      step = 0; nextT = ctx.currentTime + 0.1;
      timer = setInterval(schedule, 90);
      schedule();
    }
  };

  var Sound = {
    get on() { return enabled; },
    set: function (v) {
      enabled = !!v;
      if (master && ctx) master.gain.setTargetAtTime(enabled ? 0.9 : 0, ctx.currentTime, 0.05);
    },
    toggle: function () { Sound.set(!enabled); return enabled; },
    unlock: function () { ensure(); }
  };

  root.Sfx = Sfx; root.Music = Music; root.Sound = Sound;
})(this);
