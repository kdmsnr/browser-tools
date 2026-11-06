// ==UserScript==
// @name         Remove Watched Programs for TVer
// @namespace    https://kdmsnr.com
// @version      1.3.2
// @description  Remove watched programs from TVer's My Page
// @author       kdmsnr
// @match        https://tver.jp/*
// @grant        none
// @run-at       document-end
// ==/UserScript==
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
(function (root) {
  'use strict';

  const controlId = 'tver-watched-remover-duration-filter';
  const nativeLabelText = '本編のみ表示';

  function create({ doc = document, onChange = () => {} } = {}) {
    const core = root.TVerWatchedProgramRemoverCore;
    const slotSelector = core.favoriteToolbarSelector;
    let settings = core.normalizeSettings();
    let container;
    let nativeLabel;
    let watchedCheckbox;
    let checkbox;
    let minutes;

    function remove() {
      container?.remove();
      container = nativeLabel = watchedCheckbox = checkbox = minutes = undefined;
    }

    function validMinutes(value) {
      return Number.isInteger(value) && value >= 1 && value <= 1440;
    }

    function notifyChange() {
      const value = minutes.valueAsNumber;
      if (!validMinutes(value)) minutes.value = String(settings.shortVideoMinutes);
      onChange({
        showWatchedVideos: watchedCheckbox.checked,
        showShortVideos: checkbox.checked,
        shortVideoMinutes: validMinutes(value) ? value : settings.shortVideoMinutes,
      });
    }

    function mount(slot) {
      container = doc.createElement('div');
      container.id = controlId;
      container.setAttribute('role', 'group');
      container.setAttribute('aria-label', '動画の表示設定');

      const style = doc.createElement('style');
      style.textContent = `
        :where(div):has(> #${controlId}) {
          flex-wrap: wrap;
          gap: 8px 12px;
          min-width: 0;
        }
        #${controlId} {
          display: inline-flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 6px 8px;
          min-width: 0;
          color: inherit;
          font: inherit;
          font-size: 14px;
          line-height: 1.5;
        }
        #${controlId} label, #${controlId} .duration-limit {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          margin: 0;
          white-space: nowrap;
        }
        #${controlId} .short-controls {
          display: inline-flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 6px 8px;
          min-width: 0;
        }
        #${controlId} label { cursor: pointer; }
        #${controlId} input[type="checkbox"] {
          appearance: auto;
          width: 16px;
          height: 16px;
          margin: 0;
          cursor: pointer;
        }
        #${controlId} input[type="number"] {
          box-sizing: border-box;
          width: 64px;
          height: 26px;
          padding: 2px 4px;
          border: 1px solid #999;
          border-radius: 4px;
          background: transparent;
          color: inherit;
          font: inherit;
        }
        #${controlId} input:focus-visible {
          outline: auto;
          outline-offset: 2px;
        }
      `;

      const watchedLabel = doc.createElement('label');
      watchedLabel.title = 'チェックを入れると視聴済みの動画を表示します。短い動画の表示設定も適用されます。';
      watchedCheckbox = doc.createElement('input');
      watchedCheckbox.type = 'checkbox';
      watchedCheckbox.id = `${controlId}-watched`;
      watchedLabel.htmlFor = watchedCheckbox.id;
      const watchedText = doc.createElement('span');
      watchedText.textContent = '視聴済みの動画を表示';
      watchedLabel.append(watchedCheckbox, watchedText);

      const label = doc.createElement('label');
      label.title = 'チェックを外すと、未視聴も含めて指定時間以下の動画を隠します。';
      checkbox = doc.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = `${controlId}-show`;
      label.htmlFor = checkbox.id;
      const labelText = doc.createElement('span');
      labelText.textContent = '短い動画を表示';
      label.append(checkbox, labelText);

      const durationLimit = doc.createElement('span');
      durationLimit.className = 'duration-limit';
      minutes = doc.createElement('input');
      minutes.type = 'number';
      minutes.min = '1';
      minutes.max = '1440';
      minutes.step = '1';
      minutes.setAttribute('aria-label', '短い動画の上限（分）');
      const suffix = doc.createElement('span');
      suffix.textContent = '分以下';
      durationLimit.append(minutes, suffix);

      watchedCheckbox.addEventListener('change', notifyChange);
      checkbox.addEventListener('change', notifyChange);
      minutes.addEventListener('change', notifyChange);
      const shortControls = doc.createElement('span');
      shortControls.className = 'short-controls';
      shortControls.append(label, durationLimit);
      container.append(style, watchedLabel, shortControls);
      slot.append(container);
    }

    function ensureMounted() {
      const mountedSlot = container?.parentElement;
      if (container?.isConnected && mountedSlot?.matches(slotSelector) && nativeLabel &&
          mountedSlot.contains(nativeLabel) && nativeLabel.textContent.trim() === nativeLabelText) {
        return true;
      }

      for (const slot of doc.querySelectorAll(slotSelector)) {
        const label = Array.from(slot.querySelectorAll('label')).find(
          element => element.textContent.trim() === nativeLabelText
        );
        if (!label) continue;
        if (!container?.isConnected || mountedSlot !== slot) {
          remove();
          mount(slot);
        }
        nativeLabel = label;
        return true;
      }

      remove();
      return false;
    }

    function update(nextSettings) {
      const next = core.normalizeSettings(nextSettings);
      const thresholdChanged = settings.shortVideoMinutes !== next.shortVideoMinutes;
      settings = next;
      if (!ensureMounted()) return;
      if (watchedCheckbox.checked !== settings.showWatchedVideos) watchedCheckbox.checked = settings.showWatchedVideos;
      if (checkbox.checked !== settings.showShortVideos) checkbox.checked = settings.showShortVideos;
      // Page updates must not overwrite a number being edited.
      if (doc.activeElement !== minutes || thresholdChanged) {
        const value = String(settings.shortVideoMinutes);
        if (minutes.value !== value) minutes.value = value;
      }
    }

    return { update, remove };
  }

  root.TVerWatchedProgramRemoverDurationFilter = { create };
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : window));
(function () {
  'use strict';

  const root = typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : window);
  const core = root.TVerWatchedProgramRemoverCore;
  if (!core) return;
  const storageKey = 'tver-watched-program-remover:duration-filter';
  let settings = readSettings();
  const durationFilter = root.TVerWatchedProgramRemoverDurationFilter?.create({
    onChange(changes) {
      settings = core.normalizeSettings({ ...settings, ...changes });
      hideWatched();
      try {
        root.localStorage.setItem(storageKey, JSON.stringify({
          showWatchedVideos: settings.showWatchedVideos,
          showShortVideos: settings.showShortVideos,
          shortVideoMinutes: settings.shortVideoMinutes,
        }));
      } catch {
        // Keep the controls usable even when browser storage is unavailable.
      }
    },
  });
  let scheduled = false;

  function readSettings() {
    try {
      const saved = JSON.parse(root.localStorage.getItem(storageKey) || '{}');
      return core.normalizeSettings({
        showWatchedVideos: saved?.showWatchedVideos,
        showShortVideos: saved?.showShortVideos,
        shortVideoMinutes: saved?.shortVideoMinutes,
      });
    } catch {
      return core.normalizeSettings();
    }
  }

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
    if (!isTargetPage()) {
      durationFilter?.remove();
      return;
    }
    durationFilter?.update(settings);
    core.applyWatchedVisibility({ featureEnabled: true, ...settings });
  }

  const checkRoute = core.watchFavoriteChanges({
    isTargetPage,
    onChange: scheduleHideWatched,
    getProgressSelector: () => settings.showWatchedVideos ? null : settings.progressSelector,
  });
  const notifyRouteChange = () => {
    if (!checkRoute() && isTargetPage()) scheduleHideWatched();
  };
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
  window.addEventListener('storage', (event) => {
    if (event.key !== storageKey && event.key !== null) return;
    settings = readSettings();
    hideWatched();
  });

  hideWatched();
})();
