(function (root) {
  'use strict';

  const legacyEpisodeSelector = 'a[class^="EpisodeItem_"]';
  const episodeLinkSelector = 'a[href^="/episodes/"]';
  const episodeSelector = `${legacyEpisodeSelector}, li > ${episodeLinkSelector}`;
  const favoriteToolbarSelector = '[class^="FavoriteTool_standardOnly__"], [class*=" FavoriteTool_standardOnly__"]';
  const favoriteChangesSelector = `${legacyEpisodeSelector}, ${episodeLinkSelector}, ${favoriteToolbarSelector}`;

  const defaults = Object.freeze({
    progressThreshold: 100,
    progressSelector: 'span[class^="ProgressBar_progress"], span[class*=" ProgressBar_progress"], ' +
      'span[class^="Thumbnail_progress__"], span[class*=" Thumbnail_progress__"]',
    showWatchedVideos: false,
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
      showWatchedVideos: settings.showWatchedVideos === true,
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
    return Array.from(doc.querySelectorAll(episodeSelector));
  }

  function affectsFavorites(record, getProgressSelector) {
    const { target, type } = record;
    if (type === 'attributes' && record.attributeName === 'style') {
      const progressSelector = getProgressSelector();
      if (!progressSelector) return false;
      const episode = target.closest(episodeSelector);
      // Ignore display styles written by this script on the card or its list item.
      if (!episode || target === episode) return false;
      try {
        return target.matches(progressSelector);
      } catch {
        return target.matches(defaults.progressSelector);
      }
    }

    const element = target.nodeType === 1 ? target : target.parentElement;
    if (element?.closest(favoriteChangesSelector)) return true;
    if (type !== 'childList') return false;
    for (const nodes of [record.addedNodes, record.removedNodes]) {
      for (const node of nodes) {
        if (node.nodeType === 1 &&
            (node.matches(favoriteChangesSelector) || node.querySelector(favoriteChangesSelector))) return true;
      }
    }
    return false;
  }

  function watchFavoriteChanges({
    doc = document, isTargetPage, onChange, getProgressSelector = () => defaults.progressSelector,
  }) {
    let onFavorites = isTargetPage();
    const target = doc.documentElement || doc.body;
    const observer = new MutationObserver(records => {
      if (!checkRoute() && onFavorites && records.some(record => affectsFavorites(record, getProgressSelector))) {
        onChange();
      }
    });

    function observe() {
      if (!target) return;
      observer.observe(target, onFavorites ? {
        childList: true, subtree: true, characterData: true,
        attributes: true, attributeFilter: ['style', 'class', 'href'],
      } : { childList: true, subtree: true });
    }

    function checkRoute() {
      const next = isTargetPage();
      if (next === onFavorites) return false;
      onFavorites = next;
      observe();
      onChange();
      return true;
    }

    observe();
    return checkRoute;
  }

  function applyWatchedVisibility(options = {}) {
    const { featureEnabled = true, doc = document } = options;
    const {
      progressThreshold, progressSelector, showWatchedVideos, showShortVideos, shortVideoMinutes,
    } = normalizeSettings(options);
    const hideWatched = featureEnabled && !showWatchedVideos;
    const hideShort = featureEnabled && !showShortVideos;

    // Invalid stored selectors fall back to the built-in selector.
    let selector = progressSelector;
    if (hideWatched && selector !== defaults.progressSelector) {
      try {
        doc.querySelector(selector);
      } catch {
        selector = defaults.progressSelector;
      }
    }

    getEpisodeLinks(doc).forEach((anchor) => {
      const listItem = anchor.closest('li');
      const width = hideWatched ? anchor.querySelector(selector)?.style.width || '' : '';
      const progress = width.endsWith('%') ? Number(width.slice(0, -1)) : NaN;
      const isWatched = Number.isFinite(progress) && progress >= progressThreshold && progress <= 100;
      const duration = hideShort && !isWatched ? getEpisodeDurationSeconds(anchor) : null;
      const shouldHide = isWatched || (duration !== null && duration <= shortVideoMinutes * 60);

      const target = listItem || anchor;
      const display = shouldHide ? 'none' : '';
      if (target.style.display !== display) target.style.display = display;
      if (!shouldHide && listItem && anchor.style.display) anchor.style.display = '';
    });
  }

  root.TVerWatchedProgramRemoverCore = {
    defaults,
    favoriteToolbarSelector,
    normalizeSettings,
    parseDurationSeconds,
    getEpisodeDurationSeconds,
    getEpisodeLinks,
    watchFavoriteChanges,
    applyWatchedVisibility,
  };
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : window));
