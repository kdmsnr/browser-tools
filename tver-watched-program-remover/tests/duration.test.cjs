const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadCore() {
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'watched-core.js'), 'utf8'), context);
  return context.TVerWatchedProgramRemoverCore;
}

const durationSelector = '[class^="Duration_duration__"], [class*=" Duration_duration__"]';

function makeDocument(core, episodes) {
  const rows = episodes.map(({duration, durationClass = 'Duration_duration__test', width, hasListItem = true}) => {
    const listItem = hasListItem ? {style: {display: ''}} : null;
    const anchor = {
      style: {display: ''},
      closest: selector => selector === 'li' ? listItem : null,
      querySelector(selector) {
        if (selector === durationSelector) {
          const hasDurationClass = durationClass.startsWith('Duration_duration__') ||
            durationClass.includes(' Duration_duration__');
          return duration !== undefined && hasDurationClass ? {textContent: duration} : null;
        }
        assert.equal(selector, core.defaults.progressSelector);
        return width === undefined ? null : {style: {width}};
      },
    };
    return {anchor, listItem, target: listItem || anchor};
  });
  const doc = {
    querySelector(selector) {
      if (selector === '[') throw new SyntaxError('Invalid selector');
      return null;
    },
    querySelectorAll(selector) {
      assert.ok(['a[class^="EpisodeItem_"]', 'li > a[href^="/episodes/"]'].includes(selector));
      return rows.map(row => row.anchor);
    },
  };
  return {doc, rows};
}

test('Japanese durations parse hours, minutes and seconds without inferring unknown values', () => {
  const core = loadCore();
  for (const [text, expected] of [
    ['3分', 180], ['41分', 2460], ['10分', 600], ['10分1秒', 601],
    ['1時間5分', 3900], ['45秒', 45], ['1時間', 3600], ['90分', 5400],
    [' 1 時間 5 分 2 秒 \n', 3902], ['0分1秒', 1],
  ]) {
    assert.equal(core.parseDurationSeconds(text), expected, text);
  }
  for (const text of [undefined, null, '', ' ', '0分', '0秒', '0時間0分0秒',
    '-3分', '3.5分', '10:00', '約3分', '3分ほど', '3秒2分', '3分4分',
    '動画 3分', '99999999999999999999時間']) {
    assert.equal(core.parseDurationSeconds(text), null, String(text));
  }
});

test('short-video filtering includes the boundary and preserves longer and unknown durations', () => {
  const core = loadCore();
  const {doc, rows} = makeDocument(core, [
    {duration: '3分'}, {duration: '10分'}, {duration: '10分1秒'}, {duration: '41分'},
    {duration: '45秒'}, {duration: '1時間5分'}, {}, {duration: '不明'}, {duration: '0分'},
    {duration: '3分', durationClass: 'Label_label__test Duration_duration__test'},
    {duration: '3分', durationClass: 'Episode_description__test'},
    {duration: '3分', hasListItem: false},
  ]);
  core.applyWatchedVisibility({doc});
  assert.ok(rows.every(row => row.target.style.display === ''), 'defaults leave unwatched videos visible');

  core.applyWatchedVisibility({doc, showShortVideos: false});
  assert.deepEqual(rows.map(row => row.target.style.display),
    ['none', 'none', '', '', 'none', '', '', '', '', 'none', '', 'none']);

  core.applyWatchedVisibility({doc, showShortVideos: false, shortVideoMinutes: 65});
  assert.equal(rows[5].target.style.display, 'none', 'hour-based duration uses the configured threshold');
});

test('filter and feature toggles restore unwatched rows without exposing watched rows', () => {
  const core = loadCore();
  const {doc, rows} = makeDocument(core, [
    {duration: '3分'}, {duration: '41分', width: '100%'}, {width: '100%'},
    {duration: '3分', width: '50%'}, {duration: '3分', hasListItem: false},
  ]);
  const visible = () => rows.map(row => row.target.style.display);
  core.applyWatchedVisibility({doc, showShortVideos: false});
  assert.deepEqual(visible(), ['none', 'none', 'none', 'none', 'none']);
  core.applyWatchedVisibility({doc, showShortVideos: true});
  assert.deepEqual(visible(), ['', 'none', 'none', '', '']);
  core.applyWatchedVisibility({doc, showShortVideos: false, shortVideoMinutes: 1});
  assert.deepEqual(visible(), ['', 'none', 'none', '', '']);
  core.applyWatchedVisibility({doc, showShortVideos: false, featureEnabled: false});
  assert.deepEqual(visible(), ['', '', '', '', '']);
  core.applyWatchedVisibility({doc, showShortVideos: false, progressSelector: '['});
  assert.deepEqual(visible(), ['none', 'none', 'none', 'none', 'none'], 'invalid selector retains watched and short filtering');
});

test('watched and short-video visibility remain independent across all checkbox combinations', () => {
  const core = loadCore();
  const {doc, rows} = makeDocument(core, [
    {duration: '3分', width: '100%'}, {duration: '41分', width: '100%'},
    {duration: '3分', width: '50%'}, {duration: '41分'},
  ]);
  const visible = () => rows.map(row => row.target.style.display);
  core.applyWatchedVisibility({doc});
  assert.deepEqual(visible(), ['none', 'none', '', ''], 'defaults preserve watched hiding');
  for (const [showWatchedVideos, showShortVideos, expected] of [
    [false, false, ['none', 'none', 'none', '']],
    [false, true, ['none', 'none', '', '']],
    [true, false, ['none', '', 'none', '']],
    [true, true, ['', '', '', '']],
  ]) {
    const settings = {doc, showWatchedVideos, showShortVideos};
    core.applyWatchedVisibility(settings);
    assert.deepEqual(visible(), expected, JSON.stringify({showWatchedVideos, showShortVideos}));
    core.applyWatchedVisibility({...settings, featureEnabled: false});
    assert.deepEqual(visible(), ['', '', '', ''], 'global feature off restores every video');
  }
});
