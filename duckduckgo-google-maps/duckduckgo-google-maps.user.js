// ==UserScript==
// @name         DuckDuckGoの地図をGoogleマップで開く
// @namespace    https://kdmsnr.com
// @version      1.1.0
// @description  DuckDuckGoの「地図」リンクの行き先を、同じ検索語のGoogleマップに変更します。
// @match        https://duckduckgo.com/*
// @match        https://www.duckduckgo.com/*
// @run-at       document-start
// @noframes
// @grant        window.onurlchange
// ==/UserScript==

(function () {
  'use strict';

  const mapLinkSelector = 'a[href*="iaxm="], a[href*="ia=maps"]';
  const rewrittenLinks = new WeakMap();

  function googleMapsUrl(source) {
    if (source.protocol !== 'https:' || source.pathname !== '/') return;
    if (source.hostname !== 'duckduckgo.com' && source.hostname !== 'www.duckduckgo.com') return;

    const params = new URLSearchParams(source.search);
    const mapView = params.get('iaxm');
    if (mapView !== 'maps' && mapView !== 'start' && params.get('ia') !== 'maps') return;

    const query = params.get('q')?.trim();
    const target = new URL('https://www.google.com/maps/');
    if (query) {
      target.pathname += 'search/';
      target.searchParams.set('api', '1');
      target.searchParams.set('query', query);
    }
    return target.href;
  }

  function rewriteLink(link) {
    const target = googleMapsUrl(link);
    if (!target) return;
    link.href = target;
    rewrittenLinks.set(link, target);
  }

  function rewriteLinksIn(root) {
    if (root.matches?.(mapLinkSelector)) rewriteLink(root);
    root.querySelectorAll?.(mapLinkSelector).forEach(rewriteLink);
  }

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === 'childList') {
        record.addedNodes.forEach(rewriteLinksIn);
      } else if (record.target.matches(mapLinkSelector)) {
        rewriteLink(record.target);
      }
    }
  });
  observer.observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ['href'] });
  rewriteLinksIn(document);

  // DuckDuckGoのクリック処理を止め、書き換えたリンクをブラウザに開かせる。
  window.addEventListener('click', (event) => {
    const link = event.target.closest?.('a[href]');
    if (link && rewrittenLinks.get(link) === link.href) event.stopImmediatePropagation();
  }, true);

  function openGoogleMaps() {
    const target = googleMapsUrl(location);
    if (target) location.replace(target);
  }

  // DuckDuckGoはページを再読み込みせずに「地図」へ切り替えることがある。
  if (window.navigation) {
    window.navigation.addEventListener('currententrychange', openGoogleMaps);
  } else {
    window.addEventListener('urlchange', openGoogleMaps);
  }
  openGoogleMaps();
})();
