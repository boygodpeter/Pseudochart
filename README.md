# PseudoChart

自動將 **Python** 程式碼轉成： 
- Flowchart，可互動的流程圖
- Pseudocode，對應的偽代碼

---

## 功能

- **Python → Flowchart**：使用 Python AST 解析程式，在遍歷(traverse) AST 過程中產生 Mermaid ，並透過 JavaScript 的 module 渲染成 flowchart。
- **Python → Pseudocode**：透過 LLM 將程式碼轉為偽代碼。
- **互動式 Webview**：點擊 flowchart, pseudocode, 編輯器(原始程式碼所在處)任一處，都可在其他區域同步 highlight/定位。

---

## 系統需求

- VS Code：`1.102.0+`
- Python：`3.7+`（extension 會嘗試 `python3` / `python` / `py` 不同命令來 spawn python）
- 網路：若要使用 LLM 產生偽代碼，需要可連線呼叫 API

---






## 設定API Key

### LLM API Key（目前：Claude / Anthropic）

本專案目前主要使用環境變數：
- `CLAUDE_API_KEY`

設定方式：



1) **本地 `.env`**
- 放在 extension 根目錄的 `.env`
- 在 .env 中，用形如 `CLAUDE_API_KEY="<your-key>"` 設定 API key

2) **環境變數**
- Windows（PowerShell）：
  ```powershell
  setx CLAUDE_API_KEY "<your-key>"
  ```

- macOS/Linux（bash/zsh）：
  ```bash
  export CLAUDE_API_KEY="<your-key>"
  ```
  重新開啟 VS Code 後生效。

## 安裝/使用方法


### 方式 A

```bash
cd PseudoChart
npm install
npm run compile
```
然後用 VS Code 開啟此資料夾，按 `F5` 啟動 Extension Development Host。


### 方式 B (只想使用功能)

1.在Github上面下載 PseudoChart, Code2Pseudocode & Flowchart Generator  
2. 打開 VS Code  
3. Extensions → 右上角 `...` → **Install from VSIX...**  
4. 選擇提供的 `*.vsix`  
5. 重載（Reload）VS Code  

---

## 使用方式

### Flowchart

- 在 `.py` 檔案中右鍵後點選下拉選單中的：`Generate Flowchart (WebView)`

### Pseudocode
(須在執行完 `Generate Flowchart (WebView)` 之後)  
- 在 `.py` 檔案中右鍵後點選下拉選單中的：`Convert to Pseudocode`







---

## 注意事項

- 對python code進行更改之後，需要儲存並重新右健重新生成對應的pseudocode和flowchart。
- 若系統找不到 Python（PATH 未設定），流程圖生成會失敗。
- LLM 服務可能因網路/額度/rate limit (跟自行配置的 API有關)失敗；失敗時會顯示錯誤訊息。



---
