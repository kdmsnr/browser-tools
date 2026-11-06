const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
const storageKey = 'tver-watched-program-remover:duration-filter';

function loadUserscript({ saved, rawValue, storageMode = 'available', pathname = '/mypage/fav' } = {}) {
  const stored = new Map();
  if (saved !== undefined) stored.set(storageKey, JSON.stringify(saved));
  if (rawValue !== undefined) stored.set(storageKey, rawValue);
  const calls = [], updates = [], writes = [], pending = [], intervals = [];
  const events = new Map();
  const location = { pathname };
  let onChange, onMutation, removals = 0;

  const history = {
    pushState(state, title, url) {
      location.pathname = new URL(url, 'https://tver.jp').pathname;
      return 'push-result';
    },
    replaceState(state, title, url) {
      location.pathname = new URL(url, 'https://tver.jp').pathname;
      return 'replace-result';
    },
  };
  const globals = {
    location,
    history,
    window: { addEventListener: (type, callback) => events.set(type, callback) },
    setTimeout: callback => pending.push(callback),
    setInterval: (callback, milliseconds) => intervals.push({ callback, milliseconds }),
    TVerWatchedProgramRemoverDurationFilter: {
      create(options) {
        onChange = options.onChange;
        return {
          update: settings => updates.push({ ...settings }),
          remove: () => { removals += 1; },
        };
      },
    },
  };
  if (storageMode !== 'missing') {
    globals.localStorage = {
      getItem(key) {
        if (storageMode === 'throws') throw new Error('Storage is blocked');
        return stored.get(key) ?? null;
      },
      setItem(key, value) {
        if (storageMode === 'throws') throw new Error('Storage is blocked');
        stored.set(key, value);
        writes.push({ key, value });
      },
    };
  }

  const context = vm.createContext(globals);
  vm.runInContext(read('watched-core.js'), context);
  const core = context.TVerWatchedProgramRemoverCore;
  core.applyWatchedVisibility = options => calls.push({ ...options });
  core.watchFavoriteChanges = ({ isTargetPage, onChange }) => {
    let onFavorites = isTargetPage();
    const checkRoute = () => {
      const next = isTargetPage();
      if (next === onFavorites) return false;
      onFavorites = next;
      onChange();
      return true;
    };
    onMutation = () => {
      if (!checkRoute() && onFavorites) onChange();
    };
    return checkRoute;
  };
  vm.runInContext(read('userscript.entry.js'), context);

  return {
    context, calls, updates, writes, stored, history, location, intervals, pending,
    change: settings => onChange(settings),
    dispatch: (type, event) => events.get(type)(event),
    emitRelevantMutation: () => onMutation(),
    flush() { while (pending.length) pending.shift()(); },
    get removals() { return removals; },
  };
}

test('userscript starts without Chrome APIs and restores display preferences without changing progress defaults', () => {
  const defaults = loadUserscript();
  assert.equal('chrome' in defaults.context, false);
  assert.equal(defaults.calls.at(-1).featureEnabled, true);
  assert.equal(defaults.calls.at(-1).showWatchedVideos, false);
  assert.equal(defaults.calls.at(-1).showShortVideos, true);
  assert.equal(defaults.calls.at(-1).shortVideoMinutes, 10);
  assert.equal(defaults.updates.at(-1).showShortVideos, true);

  const restored = loadUserscript({ saved: {
    showWatchedVideos: true,
    showShortVideos: false,
    shortVideoMinutes: 3,
    progressThreshold: 1,
    progressSelector: '.unrelated-saved-selector',
  } });
  assert.equal(restored.calls.at(-1).showWatchedVideos, true);
  assert.equal(restored.calls.at(-1).showShortVideos, false);
  assert.equal(restored.calls.at(-1).shortVideoMinutes, 3);
  assert.equal(restored.calls.at(-1).progressThreshold, 100);
  assert.equal(restored.calls.at(-1).progressSelector,
    restored.context.TVerWatchedProgramRemoverCore.defaults.progressSelector);
});

test('previously saved short-video preferences keep their values and default to hiding watched videos', () => {
  const runtime = loadUserscript({ saved: { showShortVideos: false, shortVideoMinutes: 3 } });
  assert.equal(runtime.calls.at(-1).showWatchedVideos, false);
  assert.equal(runtime.calls.at(-1).showShortVideos, false);
  assert.equal(runtime.calls.at(-1).shortVideoMinutes, 3);
  runtime.change({ showWatchedVideos: true });
  assert.deepEqual(JSON.parse(runtime.stored.get(storageKey)), {
    showWatchedVideos: true,
    showShortVideos: false,
    shortVideoMinutes: 3,
  });
});

test('on-page changes apply immediately and persist only display preferences', () => {
  const runtime = loadUserscript();
  const before = runtime.calls.length;
  runtime.change({ showWatchedVideos: true, showShortVideos: false, shortVideoMinutes: 7 });
  assert.equal(runtime.calls.length, before + 1);
  assert.equal(runtime.calls.at(-1).showWatchedVideos, true);
  assert.equal(runtime.calls.at(-1).showShortVideos, false);
  assert.equal(runtime.calls.at(-1).shortVideoMinutes, 7);
  assert.equal(runtime.updates.at(-1).shortVideoMinutes, 7);
  assert.deepEqual(runtime.writes.map(write => write.key), [storageKey]);
  assert.deepEqual(JSON.parse(runtime.stored.get(storageKey)), {
    showWatchedVideos: true,
    showShortVideos: false,
    shortVideoMinutes: 7,
  });

  const reloaded = loadUserscript({ rawValue: runtime.stored.get(storageKey) });
  assert.equal(reloaded.calls.at(-1).showWatchedVideos, true);
  assert.equal(reloaded.calls.at(-1).showShortVideos, false);
  assert.equal(reloaded.calls.at(-1).shortVideoMinutes, 7);
});

test('invalid or unavailable local storage leaves controls usable with safe defaults', () => {
  for (const options of [
    { rawValue: '{invalid-json' },
    { rawValue: 'null' },
    { saved: { showWatchedVideos: 'true', showShortVideos: 'false', shortVideoMinutes: 0 } },
    { storageMode: 'missing' },
    { storageMode: 'throws' },
  ]) {
    const runtime = loadUserscript(options);
    assert.equal(runtime.calls.at(-1).showWatchedVideos, false);
    assert.equal(runtime.calls.at(-1).showShortVideos, true);
    assert.equal(runtime.calls.at(-1).shortVideoMinutes, 10);
    assert.doesNotThrow(() => runtime.change({ showWatchedVideos: true, showShortVideos: false, shortVideoMinutes: 4 }));
    assert.equal(runtime.calls.at(-1).showWatchedVideos, true);
    assert.equal(runtime.calls.at(-1).showShortVideos, false);
    assert.equal(runtime.calls.at(-1).shortVideoMinutes, 4);
  }
});

test('cross-tab display preference updates and storage clearing reapply the filter', () => {
  const runtime = loadUserscript();
  runtime.stored.set(storageKey, JSON.stringify({ showWatchedVideos: true, showShortVideos: false, shortVideoMinutes: 2 }));
  const before = runtime.calls.length;
  runtime.dispatch('storage', { key: 'unrelated-setting' });
  assert.equal(runtime.calls.length, before);

  runtime.dispatch('storage', { key: storageKey });
  assert.equal(runtime.calls.at(-1).showWatchedVideos, true);
  assert.equal(runtime.calls.at(-1).showShortVideos, false);
  assert.equal(runtime.calls.at(-1).shortVideoMinutes, 2);

  runtime.stored.delete(storageKey);
  runtime.dispatch('storage', { key: null });
  assert.equal(runtime.calls.at(-1).showWatchedVideos, false);
  assert.equal(runtime.calls.at(-1).showShortVideos, true);
  assert.equal(runtime.calls.at(-1).shortVideoMinutes, 10);
});

test('SPA navigation removes controls outside favorites and refreshes them on return', () => {
  const runtime = loadUserscript();
  const initialCalls = runtime.calls.length;
  assert.equal(runtime.history.pushState({}, '', '/episodes/example'), 'push-result');
  runtime.flush();
  assert.equal(runtime.removals, 1);
  assert.equal(runtime.calls.length, initialCalls);

  runtime.history.pushState({}, '', '/episodes/another');
  runtime.emitRelevantMutation();
  assert.equal(runtime.pending.length, 0);

  assert.equal(runtime.history.replaceState({}, '', '/mypage/fav'), 'replace-result');
  runtime.emitRelevantMutation();
  assert.equal(runtime.pending.length, 1);
  runtime.flush();
  assert.equal(runtime.calls.length, initialCalls + 1);
  assert.equal(runtime.updates.length, 2);

  runtime.location.pathname = '/';
  runtime.dispatch('popstate', {});
  runtime.flush();
  assert.equal(runtime.removals, 2);

  runtime.location.pathname = '/mypage/fav';
  runtime.dispatch('popstate', {});
  runtime.flush();
  assert.equal(runtime.calls.length, initialCalls + 2);
  assert.equal(runtime.updates.length, 3);
});

test('relevant changes and same-route navigation coalesce without interval polling', () => {
  const runtime = loadUserscript();
  const initialCalls = runtime.calls.length;
  assert.equal(runtime.intervals.length, 0);
  assert.equal(runtime.pending.length, 0);

  runtime.emitRelevantMutation();
  runtime.emitRelevantMutation();
  assert.equal(runtime.pending.length, 1);
  runtime.flush();
  assert.equal(runtime.calls.length, initialCalls + 1);

  runtime.history.replaceState({}, '', '/mypage/fav?sort=oldest');
  assert.equal(runtime.pending.length, 1);
  runtime.emitRelevantMutation();
  assert.equal(runtime.pending.length, 1);
  runtime.flush();
  assert.equal(runtime.calls.length, initialCalls + 2);
});
