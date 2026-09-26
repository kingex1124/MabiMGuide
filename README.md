# 瑪奇 M · 冒險手札

依根目錄 `Spec20260925.md` 開發的純靜態攻略網站，僅使用 HTML、CSS 與原生 JavaScript，沒有套件或建置需求。既有 `Tool/` 是獨立資料管理工具。

## 開啟網站

使用 IDE 的靜態網站預覽（例如 Live Server），將專案根目錄作為網站根目錄，開啟 `index.html`。網站自動讀取 `Data/mabim-workshop.json`。

也可直接雙擊 `index.html`；若瀏覽器阻擋本機 JSON 讀取，依畫面提示選取 `Data/mabim-workshop.json` 即可使用。手動選取的資料只在當次頁面使用，不會修改檔案。

首頁為 `index.html`，道具查詢為獨立的 `items.html`，可從選單切換或直接開啟。查詢頁支援網址參數，例如 `items.html?q=鐵錠` 或 `items.html?tag=tag-0003&tag=tag-0005`；舊的 `index.html#items` 查詢連結也會轉往新頁面。直接開啟本機 HTML 時，各頁需分別選取 JSON 資料檔。

部署時將 `index.html`、`items.html`、`styles.css`、`guide-data.js`、`app.js` 與 `Data/` 放在同一個靜態網站目錄即可；不需要部署 `Tool/`。目前未發佈至外部服務。

## 功能

- 首頁：資料統計、道具查詢入口及素材、武器、防具快捷分類。
- 搜尋：名稱、ID 或說明的部分比對，忽略英文大小寫；多選標籤採 AND 交集，可搜尋標籤或個別移除已選條件。
- 結果：每頁 24 件，支援 ID／名稱排序；搜尋條件保存在網址，可分享或重新整理。
- 明細：左右兩棵樹分別顯示組成素材及可製作成品，分支可逐層展開；道具連結可切換明細，並返回前一件道具。
- 樹狀關聯：以目前路徑偵測循環，保留各分支的共同成品；延遲建立下層節點，避免一次展開大型關聯網。
- 手機版、鍵盤操作、原生對話框 Escape 關閉，以及資料載入錯誤與無結果提示。

配方完全依 JSON 的 `components` ID 陣列建立反向用途索引；資料未提供數量，不推算數量、取得地點或未記錄的配方。空素材／用途表示未有資料紀錄。

## 驗證

有 Node.js 時執行：

```sh
node --test tests/guide-data.test.cjs
node --check app.js
node --check guide-data.js
```

測試涵蓋實際資料索引、鐵礦石／鐵錠雙向關聯、欄位搜尋、標籤交集、多層分支、循環保護與不合法引用。
