// ==UserScript==
// @name         DuckDuckGoの地図をGoogleマップで開く
// @namespace    https://kdmsnr.com
// @version      1.2.0
// @description  DuckDuckGoの「マップ」を「Google マップ」に変更し、同じ検索語で開きます。
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

  function updateTabLabel(link) {
    if (!link.closest('nav, [role="navigation"]')) return;
    const labels = { 'マップ': 'Google マップ', '地図': 'Google マップ', Maps: 'Google Maps' };
    const name = link.textContent.trim();
    if (!Object.hasOwn(labels, name)) return;

    const nodes = document.createTreeWalker(link, NodeFilter.SHOW_TEXT);
    while (nodes.nextNode()) {
      const node = nodes.currentNode;
      if (node.data.trim() === name) node.data = node.data.replace(name, labels[name]);
    }
    for (const attr of ['aria-label', 'title']) {
      if (link.getAttribute(attr) === name) link.setAttribute(attr, labels[name]);
    }
  }

  function rewriteLink(link) {
    const target = googleMapsUrl(link);
    if (!target) return;
    link.href = target;
    rewrittenLinks.set(link, target);
    updateTabLabel(link);
  }

  function rewriteLinksIn(root) {
    if (root.matches?.(mapLinkSelector)) rewriteLink(root);
    root.querySelectorAll?.(mapLinkSelector).forEach(rewriteLink);
  }

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === 'attributes') {
        if (record.target.matches(mapLinkSelector)) rewriteLink(record.target);
        continue;
      }
      record.addedNodes.forEach(rewriteLinksIn);
      const element = record.type === 'characterData' ? record.target.parentElement : record.target;
      const link = element?.closest?.('a[href]');
      if (link && rewrittenLinks.get(link) === link.href) updateTabLabel(link);
    }
  });
  observer.observe(document, { childList: true, characterData: true, subtree: true, attributeFilter: ['href'] });
  rewriteLinksIn(document);

  // DuckDuckGoのクリック処理を止め、書き換えたリンクをブラウザに開かせる。
  function handleMapLink(event) {
    const link = event.target.closest?.('a[href]');
    if (!link) return;
    if (link.matches(mapLinkSelector)) rewriteLink(link);
    if (rewrittenLinks.get(link) === link.href) event.stopImmediatePropagation();
  }
  window.addEventListener('click', handleMapLink, true);
  window.addEventListener('contextmenu', handleMapLink, true);

  function openGoogleMaps() {
    const target = googleMapsUrl(location);
    if (target) location.replace(target);
  }

  // DuckDuckGoはページを再読み込みせずに「マップ」へ切り替えることがある。
  if (window.navigation) {
    window.navigation.addEventListener('currententrychange', openGoogleMaps);
  } else {
    window.addEventListener('urlchange', openGoogleMaps);
  }
  openGoogleMaps();
})();
