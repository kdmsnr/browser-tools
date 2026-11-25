// ==UserScript==
// @name         DuckDuckGoの地図をGoogleマップで開く
// @namespace    https://kdmsnr.com
// @version      1.0.0
// @description  DuckDuckGoの「地図」を開くと、同じ検索語でGoogleマップを開きます。
// @match        https://duckduckgo.com/*
// @match        https://www.duckduckgo.com/*
// @run-at       document-start
// @noframes
// @grant        window.onurlchange
// ==/UserScript==

(function () {
  'use strict';

  function openGoogleMaps() {
    if (location.pathname !== '/') return;

    const params = new URLSearchParams(location.search);
    const mapView = params.get('iaxm');
    if (mapView !== 'maps' && mapView !== 'start' && params.get('ia') !== 'maps') return;

    const query = params.get('q')?.trim();
    const target = new URL('https://www.google.com/maps/');
    if (query) {
      target.pathname += 'search/';
      target.searchParams.set('api', '1');
      target.searchParams.set('query', query);
    }
    location.replace(target.href);
  }

  // DuckDuckGoはページを再読み込みせずに「地図」へ切り替えることがある。
  if (window.navigation) {
    window.navigation.addEventListener('currententrychange', openGoogleMaps);
  } else {
    window.addEventListener('urlchange', openGoogleMaps);
  }
  openGoogleMaps();
})();
