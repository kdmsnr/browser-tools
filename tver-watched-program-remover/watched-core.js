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
