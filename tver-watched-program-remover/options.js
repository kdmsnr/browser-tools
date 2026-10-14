'use strict';

const core = globalThis.TVerWatchedProgramRemoverCore;
const form = document.getElementById('settings');
const thresholdInput = document.getElementById('threshold');
const selectorInput = document.getElementById('selector');
const saveButton = document.getElementById('save');
const resetButton = document.getElementById('reset');
const status = document.getElementById('status');

function showSettings(settings) {
  thresholdInput.value = settings.progressThreshold;
  selectorInput.value = settings.progressSelector;
  selectorInput.setCustomValidity('');
}

function setBusy(busy) {
  saveButton.disabled = busy;
  resetButton.disabled = busy;
}

async function saveSettings(settings, message) {
  setBusy(true);
  try {
    await chrome.storage.sync.set(settings);
    showSettings(settings);
    status.textContent = message;
  } catch {
    status.textContent = '保存できませんでした。もう一度お試しください。';
  } finally {
    setBusy(false);
  }
}

selectorInput.addEventListener('input', () => selectorInput.setCustomValidity(''));

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const progressSelector = selectorInput.value.trim();
  if (!progressSelector) {
    selectorInput.setCustomValidity('CSSセレクターを入力してください。');
  } else {
    try {
      document.querySelector(progressSelector);
      selectorInput.setCustomValidity('');
    } catch {
      selectorInput.setCustomValidity('CSSセレクターの書式を確認してください。');
    }
  }
  if (!form.reportValidity()) return;
  saveSettings({ progressThreshold: thresholdInput.valueAsNumber, progressSelector },
    '保存しました。開いているTVerにも反映されます。');
});

resetButton.addEventListener('click', () => {
  saveSettings({ ...core.defaults }, '既定値に戻しました。開いているTVerにも反映されます。');
});

(async () => {
  try {
    const settings = await chrome.storage.sync.get(Object.keys(core.defaults));
    showSettings(core.normalizeSettings(settings));
    setBusy(false);
  } catch {
    status.textContent = '設定を読み込めませんでした。このページを再読み込みしてください。';
  }
})();
