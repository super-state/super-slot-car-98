/* SUPER SLOT CAR '98 — click-level analytics wiring.
   Page views come from the gtag snippet in each page's <head>; this file adds
   the events the dashboard actually cares about:
     download_click   the Windows-build button (any .zip / GitHub releases link)
     play_demo_click  any link into the browser demo (/play/)
     outbound_click   links leaving the site (GitHub, mailto excluded)
     binder_filter    card-binder filter chips
   One delegated capture-phase listener, so dynamically rewritten links (the
   download button gets its href from version.json) are read at click time.
   Fails silent when gtag is blocked — the site must never break over stats. */
(function () {
  'use strict';

  function send(name, params) {
    if (typeof window.gtag !== 'function') return;
    params = params || {};
    params.transport_type = 'beacon'; // survive the navigation-away click
    window.gtag('event', name, params);
  }

  document.addEventListener('click', function (ev) {
    if (!ev.target || !ev.target.closest) return;

    var chip = ev.target.closest('.chip[data-filter]');
    if (chip) {
      send('binder_filter', { filter: chip.dataset.filter });
      return;
    }

    var a = ev.target.closest('a[href]');
    if (!a) return;
    var url;
    try { url = new URL(a.href, window.location.href); } catch (e) { return; }
    if (url.protocol === 'mailto:') return;

    if (a.id === 'dl-btn' || /\.zip$/i.test(url.pathname) ||
        /github\.com\/[^/]+\/[^/]+\/releases/.test(url.href)) {
      var tag = document.getElementById('dl-version');
      send('download_click', {
        link_url: url.href,
        build_label: tag ? tag.textContent : ''
      });
      return;
    }

    if (/\/play\/?$/.test(url.pathname)) {
      send('play_demo_click', {
        source_page: window.location.pathname,
        link_id: a.id || ''
      });
      return;
    }

    if (url.host && url.host !== window.location.host) {
      send('outbound_click', { link_domain: url.host, link_url: url.href });
    }
  }, true);
})();
