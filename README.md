# PseudoChart

自動將 **Python** 程式碼轉成： 
- Flowchart，可互動的流程圖
- Pseudocode，對應的偽代碼

---

## 功能（Features）

- **Python → Flowchart**：使用 Python AST 解析程式，在遍歷(traverse) AST 過程中產生 Mermaid ，並透過 JavaScript 的 module 渲染成 flowchart。
- **Python → Pseudocode**：透過 LLM 將程式碼轉為偽代碼。
- **互動式 Webview**：點擊 flowchart, pseudocode, 編輯器(原始程式碼所在處)任一處，都可在其他區域同步 highlight/定位。

TODO：補上 demo 截圖/動圖（GIF）。

---

## 系統需求（Requirements）

- VS Code：`1.102.0+`
- Python：`3.7+`（extension 會嘗試 `python3` / `python` / `py` 不同命令來 spawn python）
- 網路：若要使用 LLM 產生偽代碼，需要可連線呼叫 API

---

## 安裝（Installation）

### 方式 A：安裝 VSIX

1. 打開 VS Code
2. Extensions → 右上角 `...` → **Install from VSIX...**
3. 選擇提供的 `*.vsix`
4. 重載（Reload）VS Code

### 方式 B：開發模式

```bash
cd PseudoChart
npm install
npm run compile
```
然後用 VS Code 開啟此資料夾，按 `F5` 啟動 Extension Development Host。

---

## 設定（Configuration）

### LLM API Key（目前：Claude / Anthropic）

本專案提供兩種方式設定 API key（擇一）：

1) **VS Code Settings（建議給一般使用者）**
- 在 Settings 搜尋：`pseudoChart.claudeApiKey`
- 或到 Extensions → 本 extension → ⚙ → Extension Settings

2) **環境變數（較安全，不想把 key 存在 Settings 可用這個）**
- `CLAUDE_API_KEY`
- Windows（PowerShell）：
  ```powershell
  setx CLAUDE_API_KEY "<your-key>"
  ```
  重新開啟 VS Code 後生效。

- macOS/Linux（bash/zsh）：
  ```bash
  export CLAUDE_API_KEY="<your-key>"
  ```

3) **本地 `.env`（僅建議開發/自用）**
- 放在 extension 根目錄（同 `package.json`）的 `.env`
- 在 .env 中，用形如 `CLAUDE_API_KEY="<your-key>"` 設定 API key

---

## 使用方式（How to use）

### Flowchart

- 在 `.py` 檔案中右鍵：`Generate Flowchart (WebView)`
- 或命令面板執行：`m5-test2.generate`

### Pseudocode
(須在執行完 `Generate Flowchart (WebView)` 之後)  
- 在 `.py` 檔案中右鍵：`Convert to Pseudocode`
- 或命令面板執行：`code2pseudocode.convertToPseudocode`

---

## 快速驗收（Smoke Test）

1) [ ]安裝/啟用：開啟任一 `.py` → extension 能啟用且無報錯
2) [ ]Flowchart：生成流程圖 → webview 可開啟並渲染
3) [ ]互動：點擊節點 → editor 高亮/定位正常（或有合理提示）
4) [ ]Pseudocode：有 key 時可成功生成；沒 key 時提示清楚且不崩潰
5) [ ]編輯行為：實質修改 vs 純空白/換行變動時，提示/dirty 行為符合預期

---

## 已知問題（Known Issues）

- 若只有空白/換行變動，可能會進入「映射 dirty」狀態，需重新生成 flowchart/pseudocode 才能完全同步。
- 若系統找不到 Python（PATH 未設定），流程圖生成會失敗。
- LLM 服務可能因網路/額度/rate limit (跟自行配置的 API有關)失敗；失敗時會顯示錯誤訊息。

---

## 開發指令（Scripts）

```bash
npm run compile
npm run watch
npm run lint
npm test
```

TODO：清理沒有用的 scripts（例如 watch/lint/test 是否要保留）。

---

## TODO / 後續改進

- [ ]補 README 截圖/動圖
- [ ]統一 LLM provider 設定（目前 Claude 為主；Gemini 設定待整理）
- [ ]把 log 轉為 OutputChannel，並加入 debug 開關
- [ ]未來重構 將 python runtime file 抽出，不要再 runtime 再建立臨時文件執行，看能不能先編譯成 binary，整合進整體框架。
- [ ]調整錯誤處理機制
- [ ]調整 name style 並統一

---

## 其他

- 其他 flowchart 實作方式可參考封存的 branch: `archive/other-flowchart-implement`。
- `feature/typescript-language-support` 只有實做到一半，因為時間關係並沒有完成，無法真的支援 ts。

---

## 聯絡/維護

- 維護者：TODO
- 版本：TODO（ version / commit hash / 打包日期）




npm install  
npm i -D @vscode/vsce  
npx vsce package  
