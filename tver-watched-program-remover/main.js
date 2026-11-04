const root = typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : window);

if (!root.__tverWatchedRemoverInitialized) {
  root.__tverWatchedRemoverInitialized = true;

  let observer;
  let durationFilter;
  let featureEnabled = true;
  let settings = root.TVerWatchedProgramRemoverCore.normalizeSettings();
  let scheduled = false;

  function isTargetPage() {
    return location.pathname.startsWith('/mypage/fav');
  }

  function applyVisibility() {
    const core = root.TVerWatchedProgramRemoverCore;
    if (!core) return;
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

  function initObserver() {
    if (observer) return;
    observer = new MutationObserver(() => {
      if (!isTargetPage()) {
        durationFilter?.remove();
        return;
      }
      scheduleApplyVisibility();
    });

    const target = document.body || document.documentElement;
    if (target) {
      observer.observe(target, { childList: true, subtree: true });
    }
  }

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'toggleFeature') {
      featureEnabled = message.featureEnabled;
      applyVisibility();
    }
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'sync') return;
    if (changes.featureEnabled) featureEnabled = changes.featureEnabled.newValue ?? true;
    for (const key of Object.keys(settings)) {
      if (changes[key]) settings[key] = changes[key].newValue;
    }
    settings = root.TVerWatchedProgramRemoverCore.normalizeSettings(settings);
    applyVisibility();
  });

  chrome.storage.sync.get(['featureEnabled', ...Object.keys(settings)], (result) => {
    featureEnabled = result.featureEnabled ?? true;
    settings = root.TVerWatchedProgramRemoverCore.normalizeSettings(result);
    initObserver();
    applyVisibility();
  });
}
