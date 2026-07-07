/* SUPER SLOT CAR '98 — version tag + download link.
   version.json sits next to index.html and is rewritten by the release
   script; fetch it cache-busted so playtesters always see the live build. */
(function () {
  'use strict';

  var tag = document.getElementById('dl-version');
  var btn = document.getElementById('dl-btn');
  var msg = document.getElementById('dl-msg');
  if (!tag || !btn) return;

  fetch('./version.json?ts=' + Date.now(), { cache: 'no-store' })
    .then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then(function (v) {
      var href = v.direct_zip || v.download_url;
      if (href && /^https:\/\//.test(href)) btn.href = href;
      if (v.version) tag.textContent = 'free playtest build · v' + v.version;
      if (v.message && msg) {
        msg.textContent = '"' + v.message + '"';
        msg.hidden = false;
      }
    })
    .catch(function () {
      // Graceful fallback: keep the baked-in releases link.
      tag.textContent = 'free playtest build · latest release';
    });
})();
