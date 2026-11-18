// ==UserScript==
// @name         freshrss-open-window-background
// @namespace    https://github.com/kdmsnr/browser-tools
// @version      1.0.0
// @description  FreshRSSの記事の元ページをChromeのバックグラウンドタブで開く
// @match        https://freshrss.example.org/*
// @run-at       document-end
// @noframes
// @sandbox      JavaScript
// @grant        unsafeWindow
// @grant        GM_openInTab
// ==/UserScript==

(() => {
  'use strict';

  const page = unsafeWindow;
  if (!document.querySelector('#stream:is(.normal, .reader, .global)')) return;

  const entry = ':is(#stream, #panel) .flux';
  const heading = 'h1.title > a.go_website[href]';

  function openInBackground(link) {
    if (link.protocol !== 'https:' && link.protocol !== 'http:') return false;
    GM_openInTab(link.href, { active: false, insert: true });
    return true;
  }

  function install() {
    if (typeof page.context?.shortcuts?.go_website !== 'string') return;

    const originalOpen = page.open;
    page.open = function (url, target, features) {
      // Chrome exposes the event currently being handled by the page.
      const event = page.event;
      if (event?.isTrusted && event.type === 'keydown' && event.currentTarget === document &&
          target === '_blank' && features === 'noopener') {
        const link = document.querySelector(`${entry}.current ${heading}`);
        if (link && url === link.href && openInBackground(link)) return null;
      }
      return Reflect.apply(originalOpen, this, arguments);
    };

    // Bubble after FreshRSS has handled selection and cancelled any internal navigation.
    window.addEventListener('click', event => {
      if (!event.isTrusted || event.defaultPrevented || event.button !== 0 ||
          event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const link = event.target.closest?.('a[href][target="_blank"]');
      if (!link || !link.closest(entry) || link.closest('.text')) return;
      if (link.matches(`${heading}, .flux_header .item a.title, .item.link > a`) &&
          openInBackground(link)) {
        event.preventDefault();
      }
    });
  }

  // main.js is async and may still be loading when the document is parsed.
  if (page.context?.shortcuts) install();
  else window.addEventListener('load', install, { once: true });
})();
