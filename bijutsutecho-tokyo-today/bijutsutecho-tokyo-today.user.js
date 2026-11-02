// ==UserScript==
// @name         美術手帖 展覧会検索
// @namespace    https://kdmsnr.com
// @version      1.5.0
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
})();
