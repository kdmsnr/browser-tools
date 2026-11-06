const root = typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : window);

if (!root.__tverWatchedRemoverInitialized) {
  root.__tverWatchedRemoverInitialized = true;

  const core = root.TVerWatchedProgramRemoverCore;
  let durationFilter;
  let featureEnabled = true;
  let settings = core.normalizeSettings();
  let scheduled = false;

  function isTargetPage() {
    return location.pathname.startsWith('/mypage/fav');
  }

  function applyVisibility() {
    if (!isTargetPage()) {
      durationFilter?.remove();
      return;
    }
    if (!durationFilter && root.TVerWatchedProgramRemoverDurationFilter) {
      durationFilter = root.TVerWatchedProgramRemoverDurationFilter.create({
        onChange(changes) {
          settings = core.normalizeSettings({ ...settings, ...changes });
          applyVisibility();
          chrome.storage.sync.set(changes, () => {
            if (chrome.runtime.lastError) {
              console.warn('TVer Watched Remover: display settings could not be saved.');
            }
          });
        },
      });
    }
    durationFilter?.update(settings);
    core.applyWatchedVisibility({ featureEnabled, ...settings });
  }

  function scheduleApplyVisibility() {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      applyVisibility();
    });
  }

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'toggleFeature' && message.featureEnabled !== featureEnabled) {
      featureEnabled = message.featureEnabled;
      applyVisibility();
    }
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'sync') return;
    const nextEnabled = changes.featureEnabled ? changes.featureEnabled.newValue ?? true : featureEnabled;
    const updated = { ...settings };
    for (const key of Object.keys(settings)) {
      if (changes[key]) updated[key] = changes[key].newValue;
    }
    const nextSettings = core.normalizeSettings(updated);
    if (nextEnabled === featureEnabled && Object.keys(settings).every(key => settings[key] === nextSettings[key])) return;
    featureEnabled = nextEnabled;
    settings = nextSettings;
    applyVisibility();
  });

  chrome.storage.sync.get(['featureEnabled', ...Object.keys(settings)], (result) => {
    featureEnabled = result.featureEnabled ?? true;
    settings = core.normalizeSettings(result);
    core.watchFavoriteChanges({
      isTargetPage,
      onChange: scheduleApplyVisibility,
      getProgressSelector: () => featureEnabled && !settings.showWatchedVideos ? settings.progressSelector : null,
    });
    applyVisibility();
  });
}
