(function (root) {
  'use strict';

  const defaults = Object.freeze({
    progressThreshold: 100,
    progressSelector: 'span[class^="ProgressBar_progress"], span[class*=" ProgressBar_progress"], ' +
      'span[class^="Thumbnail_progress__"], span[class*=" Thumbnail_progress__"]',
    showShortVideos: true,
    shortVideoMinutes: 10,
  });

  function normalizeSettings(settings = {}) {
    const threshold = settings.progressThreshold;
    return {
      progressThreshold: typeof threshold === 'number' && Number.isFinite(threshold) &&
        threshold > 0 && threshold <= 100 ? threshold : defaults.progressThreshold,
      progressSelector: typeof settings.progressSelector === 'string' && settings.progressSelector.trim()
        ? settings.progressSelector.trim() : defaults.progressSelector,
      showShortVideos: typeof settings.showShortVideos === 'boolean'
        ? settings.showShortVideos : defaults.showShortVideos,
      shortVideoMinutes: Number.isInteger(settings.shortVideoMinutes) &&
        settings.shortVideoMinutes >= 1 && settings.shortVideoMinutes <= 1440
        ? settings.shortVideoMinutes : defaults.shortVideoMinutes,
    };
  }

  function parseDurationSeconds(text) {
    if (typeof text !== 'string') return null;
    const match = text.match(/^\s*(?:(\d+)\s*時間\s*)?(?:(\d+)\s*分\s*)?(?:(\d+)\s*秒\s*)?$/);
    if (!match) return null;
    const seconds = Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3] || 0);
    return Number.isSafeInteger(seconds) && seconds > 0 ? seconds : null;
  }

  function getEpisodeDurationSeconds(anchor) {
    const duration = anchor.querySelector('[class^="Duration_duration__"], [class*=" Duration_duration__"]');
    return parseDurationSeconds(duration?.textContent);
  }

  function getEpisodeLinks(doc = document) {
    const links = new Set();

    doc.querySelectorAll('a[class^="EpisodeItem_"]').forEach((link) => links.add(link));
    doc.querySelectorAll('li > a[href^="/episodes/"]').forEach((link) => links.add(link));

    return [...links];
  }

  function applyWatchedVisibility(options = {}) {
    const { featureEnabled = true, doc = document } = options;
    const { progressThreshold, progressSelector, showShortVideos, shortVideoMinutes } = normalizeSettings(options);

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
      const duration = showShortVideos ? null : getEpisodeDurationSeconds(anchor);
      const isShortVideo = duration !== null && duration <= shortVideoMinutes * 60;
      const shouldHide = featureEnabled && (isWatched || isShortVideo);

      (listItem || anchor).style.display = shouldHide ? 'none' : '';
      if (!shouldHide) anchor.style.display = '';
    });
  }

  root.TVerWatchedProgramRemoverCore = {
    defaults,
    normalizeSettings,
    parseDurationSeconds,
    getEpisodeDurationSeconds,
    getEpisodeLinks,
    applyWatchedVisibility,
  };
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : window));
