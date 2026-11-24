/* main.js — 启动入口 */
(function () {
  'use strict';
  function boot() {
    try { window.Game.init(); }
    catch (e) {
      console.error(e);
      document.getElementById('screen').innerHTML = '<p style="padding:24px">启动失败：' + String(e && e.message) + '</p>';
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
