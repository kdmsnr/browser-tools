const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function watchFavorites() {
  let receive;
  let onFavorites = true;
  let passes = 0;
  const observations = [];
  const context = vm.createContext({
    MutationObserver: class {
      constructor(callback) { receive = callback; }
      observe(target, options) { observations.push(options); }
    },
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'watched-core.js'), 'utf8'), context);
  const core = context.TVerWatchedProgramRemoverCore;
  const checkRoute = core.watchFavoriteChanges({
    doc: { documentElement: {} },
    isTargetPage: () => onFavorites,
    onChange: () => { passes += 1; },
  });
  return {
    core, observations, checkRoute,
    receive: records => receive(records),
    setRoute: value => { onFavorites = value; },
    get passes() { return passes; },
  };
}

const element = overrides => ({
  nodeType: 1, closest: () => null, matches: () => false, querySelector: () => null, ...overrides,
});
const children = (target, addedNodes = [], removedNodes = []) => ({
  type: 'childList', target, addedNodes, removedNodes,
});
const style = target => ({ type: 'attributes', target, attributeName: 'style' });

test('unrelated mutations and the filter’s own display changes do not rescan favorites', () => {
  const runtime = watchFavorites();
  const sidebar = element();
  const row = element();
  const episode = element({ closest: () => episode });
  const thumbnail = element({ closest: () => episode });
  for (let i = 0; i < 100; i += 1) {
    runtime.receive([children(sidebar, [element()]), style(row), style(episode), style(thumbnail)]);
  }
  assert.equal(runtime.passes, 0);
});

test('card and toolbar replacement, progress styles, and duration text still reapply filters', () => {
  const runtime = watchFavorites();
  const parent = element();
  const episode = element({ closest: () => episode });
  const progress = element({
    closest: () => episode,
    matches: selector => selector === runtime.core.defaults.progressSelector,
  });
  const toolbar = element({ matches: selector => selector.includes('FavoriteTool_standardOnly__') });
  runtime.receive([children(parent, [element({ querySelector: () => episode })]), style(progress)]);
  assert.equal(runtime.passes, 1, 'one update for the mutation batch');
  runtime.receive([style(progress)]);
  assert.equal(runtime.passes, 2, 'progress width can change without replacing the card');
  runtime.receive([{ type: 'characterData', target: { nodeType: 3, parentElement: episode } }]);
  assert.equal(runtime.passes, 3);
  runtime.receive([children(parent, [], [toolbar])]);
  assert.equal(runtime.passes, 4);
});

test('leaving favorites stops attribute observation, and returning reapplies once', () => {
  const runtime = watchFavorites();
  assert.ok(runtime.observations[0].attributes);
  runtime.setRoute(false);
  assert.equal(runtime.checkRoute(), true);
  assert.equal(runtime.passes, 1);
  assert.ok(!runtime.observations.at(-1).attributes);
  runtime.receive([children(element(), [element({ matches: () => true })])]);
  assert.equal(runtime.passes, 1);
  runtime.setRoute(true);
  runtime.receive([children(element(), [element({ matches: () => true })])]);
  assert.equal(runtime.passes, 2);
  assert.ok(runtime.observations.at(-1).attributes);
});
