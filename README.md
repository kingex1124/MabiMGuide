# 瑪奇 M · 冒險手札

依根目錄 `Spec20260925.md` 開發的純靜態攻略網站，僅使用 HTML、CSS 與原生 JavaScript，沒有執行期套件需求。SEO 靜態頁已產生；更新資料時使用 Node.js 重新產生，GitHub Actions 也會自動處理。既有 `Tool/` 是獨立資料管理工具。

## 開啟網站

使用 IDE 的靜態網站預覽（例如 Live Server），將專案根目錄作為網站根目錄，開啟 `index.html`。網站自動讀取 `Data/mabim-workshop.json`。

也可直接雙擊 `index.html`；若瀏覽器阻擋本機 JSON 讀取，依畫面提示選取 `Data/mabim-workshop.json` 即可使用。手動選取的資料只在當次頁面使用，不會修改檔案。

首頁為 `index.html`，道具查詢為獨立的 `items.html`，可從選單切換或直接開啟。查詢頁支援網址參數，例如 `items.html?q=鐵錠` 或 `items.html?tag=tag-0003&tag=tag-0005`；舊的 `index.html#items` 查詢連結也會轉往新頁面。直接開啟本機 HTML 時，各頁需分別選取 JSON 資料檔。

部署需包含 `index.html`、`items.html`、`catalog.html`、`about.html`、`item/`、`styles.css`、`guide-data.js`、`app.js`、`Data/`、`sitemap.xml`、`robots.txt`、`llms.txt` 與 `.nojekyll`。GitHub Actions 會選取這些公開檔案，不發佈 `Tool/` 與測試、開發檔案。目前僅完成本機開發，尚未推送或發佈。

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
node --test tests/*.test.cjs
node --check app.js
node --check guide-data.js
```

測試涵蓋實際資料索引、鐵礦石／鐵錠雙向關聯、欄位搜尋、標籤交集、多層分支、循環保護與不合法引用。

## SEO 與 GEO（生成式搜尋最佳化）

- 首頁、查詢頁、完整目錄、來源說明及 659 件道具頁均有獨立標題、description、Open Graph、Twitter Card 與 canonical。
- 每件道具都有 `item/<ID>.html` 固定網址，初始 HTML 直接包含名稱、ID、分類、說明、配方、用途及來源限制，無需 JavaScript 即可讀取。互動明細內亦提供獨立頁連結。
- `catalog.html` 列出全部道具的真實連結，素材與用途連結建立雙向導覽。搜尋／標籤參數網址統一 canonical 至 `items.html`，sitemap 僅列主要固定頁面。
- JSON-LD 使用 WebSite、WebPage、CollectionPage、AboutPage、Thing 與 BreadcrumbList，僅描述實際可見內容；不捏造商品價格、評分、作者或官方背書。
- `about.html` 與道具頁說明資料來源、匯出時間及未知資訊。匯出時間不是遊戲版本更新時間；sitemap 不以每次部署時間冒充 lastmod。
- `llms.txt` 提供可選的內容導覽，屬補充性檔案，並非 Google 或所有 AI 搜尋採用的標準。沒有特殊 GEO 標記或收錄、排名、AI 引用保證。
- 搜尋與一般爬蟲可讀取公開頁面，未特別新增 AI 訓練用途的封鎖政策。robots.txt 並非存取控制。

### 網址與內容更新

目前依專案名稱設定 `https://kingex1124.github.io/MabiMGuide/`。若儲存庫名稱不同，修改 `seo.config.json` 的 `siteUrl`（含子目錄），再執行：

```sh
node scripts/build-seo.cjs
node --test tests/*.test.cjs
```

資料更新後也須執行以上步驟，讓公開 HTML 與 JSON 同步。請在 `scripts/build-seo.cjs` 調整產生內容，不要直接修改 `item/`、`catalog.html`、`about.html` 或 HTML 中 SEO／REFERENCE 標記區塊。刪除資料中的道具時，應一併刪除對應的舊 `item/<ID>.html`。所有輸出仍是純靜態檔案。分享卡片目前提供文字中繼資料，未指定未存在的預覽圖片。

### GitHub Pages 部署

1. 將專案推送至 `kingex1124/MabiMGuide`（或實際儲存庫）。
2. 到儲存庫 **Settings → Pages → Build and deployment → Source** 選擇 **GitHub Actions**。
3. 推送到 `main`／`master`，或從 Actions 手動執行 `Deploy static guide to GitHub Pages`。
4. 工作流程先測試，依 GitHub Pages 回報的真實網址重新產生 canonical、sitemap 與結構化資料，再上傳靜態網站。儲存庫名稱與自訂網域會以部署設定為準。
5. 部署完成後，在 Google Search Console 與 Bing Webmaster Tools 驗證網站並提交 `https://kingex1124.github.io/MabiMGuide/sitemap.xml`（若網址不同，改用實際網址）。檢查網址索引狀態與結構化資料。

**GitHub Pages 子目錄的 robots.txt 限制：** 爬蟲只讀取網域根目錄的 `https://kingex1124.github.io/robots.txt`，不會把 `/MabiMGuide/robots.txt` 視為網域爬蟲政策。若要套用，需在 `kingex1124.github.io` 使用者網站儲存庫的根目錄合併本站產生的規則，保留其他專案規則；或者使用自己的網域根目錄部署。沒有根目錄 robots.txt 通常不會阻止索引，可直接提交 sitemap。本專案工作流程不會修改你的其他儲存庫。

SEO 測試會檢查所有公開頁的結構化資料、canonical、內部 HTML 連結、資料內容、sitemap 完整性及子目錄網址；線上索引、效能及 GitHub Actions 執行結果仍須在實際發佈後驗證。

### 部署出現 `Get Pages site failed` / `HttpError: Not Found`

若錯誤發生於 `Configure Pages`，表示工作流程無法讀取 GitHub Pages 網站設定，通常是尚未啟用 Pages。這個步驟在網站測試與產生之前執行。

1. 開啟 [儲存庫 Pages 設定](https://github.com/kingex1124/MabiMGuide/settings/pages)。
2. 在 **Build and deployment → Source** 選擇 **GitHub Actions**。
3. 回到 Actions 的失敗紀錄，按 **Re-run all jobs**。若有更新工作流程，先推送修改，讓新的執行使用新版設定；重跑舊紀錄仍使用舊版本。
4. 若設定完成仍出現 404，檢查帳號的管理權限、儲存庫所屬方案是否支援目前可見性下的 Pages，以及組織是否限制 Pages。

工作流程使用 `configure-pages@v6` 與 `setup-node@v6`（Action 執行環境為 Node.js 24），網站產生與測試仍使用指定的 Node.js 22。未設定 `enablement: true`，因為該功能需要額外的高權限 token，普通 `GITHUB_TOKEN` 無法完成首次啟用。Ubuntu 執行環境固定為 `ubuntu-24.04`。

參考：[Google AI 搜尋與網站](https://developers.google.com/search/docs/appearance/ai-features)、[可爬取連結](https://developers.google.com/search/docs/crawling-indexing/links-crawlable)、[canonical 設定](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)、[GitHub Pages 工作流程](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)。
