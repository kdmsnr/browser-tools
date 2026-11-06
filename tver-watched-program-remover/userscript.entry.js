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
