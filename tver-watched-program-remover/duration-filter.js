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
