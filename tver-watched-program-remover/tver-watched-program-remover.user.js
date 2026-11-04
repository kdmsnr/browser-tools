// ==UserScript==
// @name         Remove Watched Programs for TVer
// @namespace    https://kdmsnr.com
// @version      1.3.0
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
    const links = new Set();

    doc.querySelectorAll('a[class^="EpisodeItem_"]').forEach((link) => links.add(link));
    doc.querySelectorAll('li > a[href^="/episodes/"]').forEach((link) => links.add(link));

    return [...links];
  }

  function applyWatchedVisibility(options = {}) {
    const { featureEnabled = true, doc = document } = options;
    const {
      progressThreshold, progressSelector, showWatchedVideos, showShortVideos, shortVideoMinutes,
    } = normalizeSettings(options);

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
      const shouldHide = featureEnabled && ((!showWatchedVideos && isWatched) || isShortVideo);

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
(function (root) {
  'use strict';

  const controlId = 'tver-watched-remover-duration-filter';
  const slotSelector = '[class^="FavoriteTool_standardOnly__"], [class*=" FavoriteTool_standardOnly__"]';

  function create({ doc = document, onChange = () => {} } = {}) {
    const core = root.TVerWatchedProgramRemoverCore;
    let settings = core.normalizeSettings();
    let container;
    let watchedCheckbox;
    let checkbox;
    let minutes;

    function remove() {
      container?.remove();
      container = watchedCheckbox = checkbox = minutes = undefined;
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
          accent-color: #009f66;
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
          outline: 2px solid #009f66;
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

    function update(nextSettings) {
      const next = core.normalizeSettings(nextSettings);
      const thresholdChanged = settings.shortVideoMinutes !== next.shortVideoMinutes;
      settings = next;
      const label = Array.from(doc.querySelectorAll('label')).find(
        element => element.textContent.trim() === '本編のみ表示'
      );
      const slot = label?.closest(slotSelector);
      if (!slot) {
        remove();
        return;
      }
      if (!container?.isConnected || container.parentElement !== slot) {
        remove();
        mount(slot);
      }
      watchedCheckbox.checked = settings.showWatchedVideos;
      checkbox.checked = settings.showShortVideos;
      // Mutation observers and userscript polling must not overwrite a number being edited.
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
  window.addEventListener('storage', (event) => {
    if (event.key !== storageKey && event.key !== null) return;
    settings = readSettings();
    hideWatched();
  });

  setInterval(() => {
    if (isTargetPage()) scheduleHideWatched();
  }, 1500);

  hideWatched();
})();
