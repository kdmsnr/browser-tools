const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');

function loadCore() {
  const context = vm.createContext({});
  vm.runInContext(read('watched-core.js'), context);
  return context.TVerWatchedProgramRemoverCore;
}

test('defaults and invalid saved settings preserve the original behavior', () => {
  const core = loadCore();
  assert.equal(core.normalizeSettings().progressThreshold, 100);
  for (const value of [0, -1, 101, NaN, Infinity, '95', null]) {
    assert.equal(core.normalizeSettings({progressThreshold: value}).progressThreshold, 100);
  }
  assert.equal(core.normalizeSettings({progressThreshold: 95}).progressThreshold, 95);
  assert.equal(core.normalizeSettings({progressSelector: '  .custom  '}).progressSelector, '.custom');
  assert.equal(core.normalizeSettings({progressSelector: ''}).progressSelector, core.defaults.progressSelector);
});

test('content script loads settings and reapplies sync changes, deletion and toggles', () => {
  const core = loadCore();
  const calls = [];
  let onChanged, onMessage;
  const context = vm.createContext({
    TVerWatchedProgramRemoverCore: {...core, applyWatchedVisibility: options => calls.push(options)},
    location: {pathname: '/mypage/fav'},
    document: {body: {}},
    MutationObserver: class { observe() {} },
    queueMicrotask: fn => fn(),
    chrome: {
      runtime: {onMessage: {addListener: fn => {onMessage = fn;}}},
      storage: {
        onChanged: {addListener: fn => {onChanged = fn;}},
        sync: {get: (keys, cb) => cb({progressThreshold: 95, progressSelector: '.custom'})},
      },
    },
  });
  vm.runInContext(read('main.js'), context);
  assert.equal(calls.at(-1).progressThreshold, 95);
  assert.equal(calls.at(-1).progressSelector, '.custom');
  onChanged({progressThreshold: {newValue: 90}}, 'sync');
  assert.equal(calls.at(-1).progressThreshold, 90);
  const count = calls.length;
  onChanged({progressThreshold: {newValue: 10}}, 'local');
  assert.equal(calls.length, count);
  onChanged({progressThreshold: {}, progressSelector: {}}, 'sync');
  assert.equal(calls.at(-1).progressThreshold, 100);
  assert.equal(calls.at(-1).progressSelector, core.defaults.progressSelector);
  onChanged({featureEnabled: {newValue: false}}, 'sync');
  assert.equal(calls.at(-1).featureEnabled, false);
  onMessage({type: 'toggleFeature', featureEnabled: true});
  assert.equal(calls.at(-1).featureEnabled, true);
  context.location.pathname = '/';
  const before = calls.length;
  onChanged({progressThreshold: {newValue: 80}}, 'sync');
  assert.equal(calls.length, before);
});
