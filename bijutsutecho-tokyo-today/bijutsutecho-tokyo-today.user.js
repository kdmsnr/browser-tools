// ==UserScript==
// @name         美術手帖 展覧会検索
// @namespace    https://kdmsnr.com
// @version      1.6.0
// @description  指定地域の展覧会検索に今日の日付を設定し、一覧を画面幅に広げます。
// @match        https://bijutsutecho.com/exhibitions/search*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // 対象地域のコード。検索 URL の regions に合わせて変更してください。
  const REGION_CODE = '1300';

  const url = new URL(window.location.href);
  if (url.pathname !== '/exhibitions/search' || url.searchParams.get('regions') !== REGION_CODE) {
    return;
  }

  const now = new Date();
  const today = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');

  const periods = url.searchParams.getAll('period');
  if (periods.length !== 1 || periods[0] !== today) {
    url.searchParams.set('period', today);
    window.location.replace(url.href);
    return;
  }

  const style = document.createElement('style');
  style.textContent = `
    #body.exhibitions > .exhibitions_pickup {
      display: none;
    }

    .l_main-sidebar__sidebar {
      display: none;
    }

    .c_exhibitions-search__panel-conds:has(.bt-favorites-option) {
      flex-wrap: wrap;
      gap: 12px 16px;
    }

    .c_exhibitions-search__panel-conds:has(.bt-favorites-option) > .c_exhibitions-search__panel-cond {
      margin-left: 0;
    }

    .bt-favorites-option .bt-favorites-toggle {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 14px;
      cursor: pointer;
    }

    .bt-favorites-toggle input {
      appearance: auto;
      width: 16px;
      height: 16px;
      margin: 0;
      opacity: 1;
      position: static;
    }

    .bt-favorites-list:not(:empty) {
      margin-bottom: 48px;
    }

    .bt-favorites-first .l_main-sidebar__main .exhibitions_items:not(.bt-favorites-list)
      > .exhibitions_item:has(button[title="行きたいを解除する"]) {
      display: none;
    }

    @media (min-width: 768px) {
      .l_container:has(> .l_main-sidebar),
      #body.exhibitions > .l_container.l_main-sidebar {
        width: calc(100% - 48px);
        max-width: none;
      }

      .l_main-sidebar {
        flex-direction: column;
      }

      .l_main-sidebar__main {
        width: 100%;
        min-width: 0;
      }

      .l_main-sidebar__main .exhibitions_items {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: 48px 32px;
      }

      .l_main-sidebar__main .exhibitions_items > .exhibitions_item {
        box-sizing: border-box;
        width: auto;
        min-width: 0;
        margin-top: 0;
        padding: 12px;
        border: 1px solid #e1e1e1;
        border-radius: 4px;
      }

      .l_main-sidebar__main .exhibitions_items > .exhibitions_item > article {
        width: 100%;
      }
    }
  `;
  document.documentElement.appendChild(style);

  function setupFavorites() {
    const listSelector = '.l_main-sidebar__main .exhibitions_items:not(.bt-favorites-list)';
    const favoriteSelector = 'button[title="行きたいを解除する"]';
    const favoriteList = document.createElement('div');
    favoriteList.className = 'exhibitions_items bt-favorites-list';

    const option = document.createElement('li');
    option.className = 'c_exhibitions-search__panel-cond bt-favorites-option';
    const toggle = document.createElement('label');
    toggle.className = 'bt-favorites-toggle';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = true;
    toggle.append(checkbox, document.createTextNode('お気に入りを上にする'));
    option.append(toggle);

    let scheduled = false;
    let displayedCards = [];
    let displayedMarkup = [];

    function scheduleUpdate() {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        update();
      });
    }

    function makeCopy(card) {
      const copy = card.cloneNode(true);
      copy.removeAttribute('id');
      copy.querySelectorAll('[id]').forEach((element) => element.removeAttribute('id'));
      copy.querySelectorAll('[aria-labelledby], [aria-describedby], [aria-controls]').forEach((element) => {
        element.removeAttribute('aria-labelledby');
        element.removeAttribute('aria-describedby');
        element.removeAttribute('aria-controls');
      });

      const originalButtons = card.querySelectorAll('button');
      copy.querySelectorAll('button').forEach((button, index) => {
        button.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          originalButtons[index]?.click();
        });
      });

      copy.addEventListener('click', (event) => {
        if (event.target.closest('a, button')) return;
        copy.querySelector('h3 a[href]')?.click();
      });
      return copy;
    }

    function update() {
      const endedOption = document.querySelector('#sp-exhibitions-search-cond-6')
        ?.closest('li.c_exhibitions-search__panel-cond');
      if (endedOption && option.previousElementSibling !== endedOption) {
        endedOption.insertAdjacentElement('afterend', option);
      }

      const lists = [...document.querySelectorAll(listSelector)];
      const firstList = lists[0];
      if (firstList && favoriteList.nextElementSibling !== firstList) {
        firstList.before(favoriteList);
      }

      document.documentElement.classList.toggle('bt-favorites-first', checkbox.checked);
      if (!checkbox.checked || !firstList) {
        if (displayedCards.length) favoriteList.replaceChildren();
        displayedCards = [];
        displayedMarkup = [];
        return;
      }

      const favorites = lists.flatMap((list) =>
        [...list.querySelectorAll(':scope > .exhibitions_item')]
          .filter((card) => card.querySelector(favoriteSelector))
      );
      const markup = favorites.map((card) => card.outerHTML);
      if (favorites.length === displayedCards.length && favorites.every((card, index) =>
        card === displayedCards[index] && markup[index] === displayedMarkup[index]
      )) return;
      favoriteList.replaceChildren(...favorites.map(makeCopy));
      displayedCards = favorites;
      displayedMarkup = markup;
    }

    checkbox.addEventListener('change', scheduleUpdate);

    const observer = new MutationObserver((mutations) => {
      const relevant = mutations.some((mutation) => {
        const target = mutation.target.nodeType === Node.ELEMENT_NODE
          ? mutation.target
          : mutation.target.parentElement;
        if (target?.closest('.bt-favorites-list, .bt-favorites-option')) return false;
        if (mutation.type === 'attributes') return Boolean(target?.closest(listSelector));
        const changedNodes = [...mutation.addedNodes, ...mutation.removedNodes];
        return changedNodes.some((node) => node !== favoriteList && node !== option);
      });
      if (relevant) scheduleUpdate();
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['title'],
    });
    update();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupFavorites, { once: true });
  } else {
    setupFavorites();
  }
})();
