// ==UserScript==
// @name         Remove Watched Programs for TVer
// @namespace    https://kdmsnr.com
// @version      1.1.0
// @description  Remove watched programs from TVer's My Page
// @author       kdmsnr
// @match        https://tver.jp/*
// @grant        none
// @run-at       document-end
// ==/UserScript==
(function (root) {
  'use strict';

  const defaults = Object.freeze({
    progressThreshold: 100,
    progressSelector: 'span[class^="ProgressBar_progress"], span[class*=" ProgressBar_progress"], ' +
      'span[class^="Thumbnail_progress__"], span[class*=" Thumbnail_progress__"]',
  });

  function normalizeSettings(settings = {}) {
    const threshold = settings.progressThreshold;
    return {
      progressThreshold: typeof threshold === 'number' && Number.isFinite(threshold) &&
        threshold > 0 && threshold <= 100 ? threshold : defaults.progressThreshold,
      progressSelector: typeof settings.progressSelector === 'string' && settings.progressSelector.trim()
        ? settings.progressSelector.trim() : defaults.progressSelector,
    };
  }

  function getEpisodeLinks(doc = document) {
    const links = new Set();

    doc.querySelectorAll('a[class^="EpisodeItem_"]').forEach((link) => links.add(link));
    doc.querySelectorAll('li > a[href^="/episodes/"]').forEach((link) => links.add(link));

    return [...links];
  }

  function applyWatchedVisibility(options = {}) {
    const { featureEnabled = true, doc = document } = options;
    const { progressThreshold, progressSelector } = normalizeSettings(options);

    // Invalid stored selectors fall back to the built-in selector.
    let selector = progressSelector;
    try {
      doc.querySelector(selector);
    } catch {
      selector = defaults.progressSelector;
    }

    getEpisodeLinks(doc).forEach((anchor) => {
      const progressBar = anchor.querySelector(selector);
      const listItem = anchor.closest('li');
      const width = progressBar?.style.width || '';
      const progress = width.endsWith('%') ? Number(width.slice(0, -1)) : NaN;
      const isWatched = Number.isFinite(progress) && progress >= progressThreshold && progress <= 100;

      if (isWatched) {
        if (listItem) {
          listItem.style.display = featureEnabled ? 'none' : '';
        } else {
          anchor.style.display = featureEnabled ? 'none' : '';
        }
      } else {
        if (listItem) {
          listItem.style.display = '';
        }
        anchor.style.display = '';
      }
    });
  }

  root.TVerWatchedProgramRemoverCore = {
    defaults,
    normalizeSettings,
    getEpisodeLinks,
    applyWatchedVisibility,
  };
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : window));
(function () {
  'use strict';

  const root = typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : window);
  const core = root.TVerWatchedProgramRemoverCore;
  if (!core) return;
  let scheduled = false;

  function isTargetPage() {
    return location.pathname.startsWith('/mypage/fav');
  }

  function scheduleHideWatched() {
    if (scheduled) return;
    scheduled = true;
    setTimeout(() => {
      scheduled = false;
      hideWatched();
    }, 0);
  }

  function hideWatched() {
    if (!isTargetPage()) return;
    core.applyWatchedVisibility({ featureEnabled: true });
  }

  const observer = new MutationObserver(scheduleHideWatched);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  const notifyRouteChange = () => scheduleHideWatched();
  const originalPushState = history.pushState;
  history.pushState = function (...args) {
    const result = originalPushState.apply(this, args);
    notifyRouteChange();
    return result;
  };
  const originalReplaceState = history.replaceState;
  history.replaceState = function (...args) {
    const result = originalReplaceState.apply(this, args);
    notifyRouteChange();
    return result;
  };
  window.addEventListener('popstate', notifyRouteChange);

  setInterval(() => {
    if (isTargetPage()) scheduleHideWatched();
  }, 1500);

  hideWatched();
})();
