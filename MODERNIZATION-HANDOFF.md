# Focalboard Modernization — Tài liệu bàn giao (Handoff)

> **Mục đích:** Tài liệu này để bàn giao cho một agent/dev khác (DeepSeek) tiếp tục công việc hiện đại hoá & mở rộng Focalboard. Nó tự chứa (self-contained) — đọc xong là làm tiếp được mà không cần lịch sử hội thoại.
>
> **Ngày cập nhật:** 2026-07-24 (sau Phase 9 — TOÀN BỘ 9 PHASE ĐÃ XONG)
> **Branch:** `claude/project-quality-assessment-41e971` (git worktree)
> **Plan gốc (9 phase):** đã copy vào repo tại `docs/modernization/PLAN-9-phases.md` (tự chứa, không phụ thuộc file ngoài).

---

## ⭐ BẮT ĐẦU TỪ ĐÂY

**Toàn bộ 9 phase của plan gốc đã hoàn thành và commit** (Phase 5 cố ý dừng ở MỘT PHẦN — xem mục 4c để biết chính xác cái gì còn thiếu và tại sao an toàn khi bỏ qua). Không còn phase nào "tiếp theo" theo plan gốc — nếu có việc mới, đó là: (a) hoàn thiện nốt phần Phase 5 còn thiếu (5b bước 2, 5c phần còn lại, 5d tách god-file — xem mục 4c), (b) nợ kỹ thuật ở mục 7, hoặc (c) yêu cầu tính năng mới ngoài phạm vi plan gốc.

**Bước 0 — Xác nhận baseline (chạy trước khi làm gì):**
```bash
git log --oneline -10
# Phải thấy (từ mới nhất): "Phase 9: formula property", "Phase 8: automation rules engine",
# "Phase 7b: Timeline/Gantt view", "Phase 7a: card dependencies...",
# "Phase 6: quick wins...", "docs: record Phase 5 partial completion...",
# "Phase 5 (partial): server pagination...", ...
# Đây là baseline XANH đã verify (Phase 1-4 xong, Phase 5 MỘT PHẦN — cố ý, xem mục 4c —
# Phase 6-9 xong, một số phạm vi thu hẹp có ghi chú — xem mục 4d/4e/4f/4g).
```

Đọc theo thứ tự khi cần hiểu một phase cụ thể: mục 0 (quy tắc vàng) → mục 1 (môi trường) → mục 4c/4d/4e/4f/4g (Phase 5/6/7/8/9 đã làm gì, KHÔNG làm gì, và TẠI SAO) → mục 5 (spec gốc, giữ để đối chiếu — phần Phase 5 còn thiếu nếu muốn quay lại).

**Nếu chạy trên MÁY KHÁC** (không phải máy đã setup): xem mục 1 để biết yêu cầu phiên bản (Go 1.22, gcc cho CGO, Node 20+) và các cờ npm đặc thù; các đường dẫn tuyệt đối trong mục 1 là của máy gốc, cần thay bằng path máy bạn.

---

## 0. QUY TẮC VÀNG (đọc trước khi làm bất cứ gì)

1. **KHÔNG làm bảo mật.** Toàn bộ hạng mục security (rate-limit login, 2FA, account lockout) do chủ dự án tự làm sau. Bỏ qua hoàn toàn.
2. **Giữ CẢ HAI chế độ chạy xanh:** standalone personal server **VÀ** Mattermost plugin mode. Cụ thể: `server/services/store/mattermostauthlayer`, `server/ws/plugin_adapter.go`, `server/services/notify/plugindelivery` phải compile + test pass. **Mọi method mới thêm vào interface `store.Store` (`server/services/store/store.go`) phải được implement ở CẢ HAI:** `sqlstore` (`server/services/store/sqlstore/`) và `mattermostauthlayer` (delegate/passthrough). Sau đó chạy lại `make generate` để cập nhật mock.
3. **Giữ đủ 3 database:** SQLite, PostgreSQL, MySQL. Mọi migration/index/query mới phải viết & test cho cả 3. Migration mới bắt đầu từ số **000041** (hiện tại kết thúc ở 000040). Dùng helper đa-DB `createIndexIfNeeded` (`server/services/store/sqlstore/migrate.go:284`).
4. **Mỗi phase kết thúc ở trạng thái ship được** (compile + test xanh) rồi mới commit và sang phase kế.
5. **Định dạng lưu markdown của card là text trong `block.title`** — không bao giờ migrate/đổi định dạng dữ liệu này (quan trọng cho Phase 4 TipTap).

---

## 1. MÔI TRƯỜNG BUILD (máy Windows này KHÔNG có sẵn Go/gcc/docker trong PATH)

> **Yêu cầu phiên bản (nếu setup máy khác):** Go **1.22.x** (khớp `server/go.mod`), một trình biên dịch **C (gcc)** cho CGO (sqlite3), **Node 20+** & npm, và (tuỳ chọn) **Docker** để test MySQL/Postgres/MariaDB. Không có Docker vẫn làm được — chỉ test SQLite local, CI Linux lo phần 3 DB còn lại. Bảng đường dẫn dưới đây là **của máy gốc** — thay bằng path máy bạn.

Đã cài sẵn user-scope (không cần admin) trên máy gốc:

| Công cụ | Đường dẫn | Ghi chú |
|---|---|---|
| **Go 1.22.12** | `%LOCALAPPDATA%\Programs\go1.22.12\go\bin\go.exe` | Thêm vào PATH trước khi chạy `go` |
| **gcc (mingw-w64 14.2 ucrt)** | `%LOCALAPPDATA%\Programs\winlibs\mingw64\bin` | Cần cho CGO (`server/main` import `"C"`, `mattn/go-sqlite3`). Set `CGO_ENABLED=1` |
| **Node** | có sẵn trong PATH | v24, npm 12 |
| **Docker** | **KHÔNG CÓ** | ⇒ không chạy được test MySQL/Postgres/MariaDB tại chỗ; chỉ test SQLite local. CI Linux (GitHub Actions) mới chạy đủ 4 DB |

### Các "gotcha" đặc thù môi trường

- **npm bị chặn git/remote deps:** phải thêm cờ `--allow-remote=all` khi `npm install` trong `webapp/` (vì `eslint-plugin-mattermost` là tarball URL). Ví dụ:
  ```bash
  cd webapp && CYPRESS_INSTALL_BINARY=0 npm install --allow-remote=all --no-audit --no-fund
  ```
- **`core.autocrlf=true`** ⇒ file trên đĩa là CRLF ⇒ eslint báo ~58k lỗi giả `linebreak-style` trên Windows (CI Linux không bị). **Luôn lọc** khi verify: `... | grep -v "linebreak-style"`.
- **Cypress:** đặt `CYPRESS_INSTALL_BINARY=0` để bỏ qua tải binary (không chạy E2E local được, chỉ compile/lint spec).
- **Test binary `sqlstore` bị Windows Application Control chặn** với hash mặc định. Workaround: thêm `-ldflags "-s"` để đổi hash binary:
  ```powershell
  go test -tags 'json1 sqlite3' -ldflags "-s" -count=1 ./services/store/sqlstore/
  ```
- **`TestGetFilePath` (server/app) FAIL trên Windows** do so sánh dấu phân cách đường dẫn (`/` vs `\`). Đây là lỗi Windows-only có sẵn từ trước, **KHÔNG phải do các thay đổi này**. CI Linux pass bình thường. Bỏ qua.

### Lệnh verify chuẩn (copy-paste)

**Frontend (trong `webapp/`):**
```bash
# 1) Typecheck (phải sạch)
npx tsc -p tsconfig.json --noEmit

# 2) ESLint (lọc nhiễu CRLF của Windows)
npx eslint --ext .tsx,.ts src --quiet --format unix 2>/dev/null | grep -v "linebreak-style" | grep -v "^$"

# 3) Unit test (Jest 29)
npx jest --coverage=false --ci

# 4) Build production bundle
npx cross-env NODE_ENV=dev webpack --config webpack.dev.js
```

**Backend (PowerShell, trong `server/`):**
```powershell
$env:PATH = "$env:LOCALAPPDATA\Programs\go1.22.12\go\bin;$env:LOCALAPPDATA\Programs\winlibs\mingw64\bin;$env:PATH"
$env:CGO_ENABLED = "1"

# Build đầy đủ (cgo + sqlite3) — bao gồm cả code plugin-mode
go build -tags 'json1 sqlite3' ./...

# Test toàn bộ trên SQLite (dùng -ldflags "-s" nếu gặp Application Control block)
go test -tags 'json1 sqlite3' -ldflags "-s" -count=1 ./...
```

---

## 2. TIẾN ĐỘ TỔNG QUAN

| Phase | Nội dung | Trạng thái | Commit |
|---|---|---|---|
| **1** | Vệ sinh tooling & deps (dead deps, TS5, Go 1.22, lint pin) | ✅ **XONG, đã commit** | `b3181364` |
| **2** | Cổng React 18 (react-intl 6, react-redux 8, jest 29, createRoot, JSX tự động) | ✅ **XONG, đã commit** | `7d4e16c7` |
| **3** | Hiện đại hoá thư viện (router v6, dnd, dayjs, emoji-mart 5, react-day-picker v8) | ✅ **XONG, đã commit** | `edea4b07` |
| **4** | Editor draft-js → **TipTap v3** | ✅ **XONG, đã commit** | `0c7aa346` |
| **5** | Hiệu năng & cấu trúc (pagination, lazy load, selectors, virtualize table, tách god-file) | 🟡 **MỘT PHẦN, đã commit** (5a+5b bước 1+5c một phần; còn lại xem mục 4c) | `248fefa6` |
| **6** | Quick wins (WIP limit, swimlane, checklist progress, card history UI) | ✅ **XONG, đã commit** | `e714c4ba` |
| **7** | Dependencies + Timeline/Gantt view | ✅ **XONG, đã commit** (một số phạm vi thu hẹp có ghi chú — xem mục 4e) | `c8470ebd` (7a) + `7e79fd4f` (7b) |
| **8** | Automation rules engine | ✅ **XONG, đã commit** | `42c7219f` |
| **9** | Formula property | ✅ **XONG, đã commit** (kèm 1 bug fix thật ở `createBoard()` — xem mục 4g) | `c1365cea` |

---

## 3. ĐÃ HOÀN THÀNH — CHI TIẾT

### ✅ Phase 1 — Tooling & dependency hygiene (commit `b3181364`)

- **Xoá dead deps** khỏi `webapp/package.json`: `fstream`, 6×`imagemin-*`, `image-webpack-loader`, `file-loader`, `ts-jest`, `@types/react-intl`, khối `jest.globals.ts-jest` chết.
- **TypeScript 4.6 → 5.4.5**; `@typescript-eslint/*` 5 → 7; eslint → 8.57; webpack → 5.9x (fix xung đột type với `@types/node` 20).
- Thêm devDep tường minh: `@swc/core`, `@types/node@20`; pin `@types/react-transition-group@4.4.9` (React 17 types compat, sẽ gỡ được sau).
- **Server:** `go.mod` → Go 1.22 + `mattn/go-sqlite3 v1.14.22`. Vì `mattermost/server/v8` ghim `v2.0.3+incompatible` (tag lỗi, code cũ hơn v1.14.x), đã thêm directive `exclude github.com/mattn/go-sqlite3 v2.0.3+incompatible` trong `go.mod`.
- **Lint:** pin `golangci-lint v1.59.1` trong `Makefile` (có kiểm tra version), đổi `exportloopref` (deprecated ở Go 1.22) → `copyloopvar` trong `server/.golangci.yml`.
- **CI:** 3 workflow (`dev-release.yml`, `prod-release.yml`, `lint-server.yml`) đồng bộ Go 1.22 + golangci-lint v1.59.1.
- **Verify đã đạt:** tsc sạch, jest 816/816, webpack OK, go build (cgo) OK, go test SQLite xanh.

### ✅ Phase 2 — React 18 gate (commit `7d4e16c7`)

- `react`/`react-dom` 17 → **18.2**; `createRoot` thay `ReactDOM.render` ở `webapp/src/main.tsx` và `webapp/src/components/blocksEditor/devmain.tsx`.
- `react-intl` 5→6, `react-redux` 7→8 (bỏ `@types/react-redux`), `@testing-library/react` 11→14, `@testing-library/jest-dom` 6, **jest 27→29** (+`jest-environment-jsdom`), `jest-mock` 29 (đổi `mocked(x, true)` → `mocked(x, {shallow: true})` ở 48 chỗ), **Cypress 9→13** (`cypress.json` → `cypress.config.ts`, gộp `plugins/index.js` vào `setupNodeEvents`).
- **JSX transform:** `tsconfig.json` `jsx: "react"` → `"react-jsx"`; `@swc/jest` cấu hình `runtime: automatic`; gỡ `import React` thừa ở **264 file**; tắt rule `react/react-in-jsx-scope` + `jsx-uses-react`.
- Fix type React 18: annotate tham số `useCallback` (13 chỗ), `children` trên test Wrapper FC, `route.tsx` redirect typing.
- **`skipLibCheck: true`** bật tạm (vì react-day-picker@7 types tham chiếu `React.SFC` đã bị xoá — Phase 3 nâng lên v8 sẽ gỡ nhu cầu này, nhưng hiện vẫn để bật).
- Fix test cho React 18 act semantics (markdownEditor, workspace, shareBoard, blocksEditor); polyfill `scrollIntoView` cho jsdom trong `webapp/jest.setup.js`; regenerate snapshots.
- **Giữ `@testing-library/user-event` ở v13** (KHÔNG lên v14) để tránh viết lại async API ở 64 file test — đây là **nợ kỹ thuật, follow-up sau**.
- **Verify đã đạt:** tsc sạch, eslint sạch (trừ nhiễu CRLF), jest 139 suite / 820 test / 457 snapshot, webpack OK.

---

## 4. ✅ Phase 3 — Hiện đại hoá thư viện (ĐÃ XONG, đã commit)

**Verify đã đạt:** tsc 0 lỗi, eslint sạch (trừ nhiễu CRLF), **jest 139 suite / 820 test / 457 snapshot xanh (cả song song lẫn `--runInBand`)**, webpack build OK. DeepSeek bắt đầu Phase 4 từ baseline này.

- **package.json:** thêm `@hello-pangea/dnd@16`, `dayjs@1.11`, `date-fns@3`, `@emoji-mart/data@1`, `@emoji-mart/react@1`, `emoji-mart@5`, `react-day-picker@8`, `react-dnd@16` (+ backends), `react-router-dom@6`. Xoá `moment`, `react-beautiful-dnd`, `@types/react-beautiful-dnd`, `@types/react-router-dom`, `@types/emoji-mart`.
- **File mới:**
  - `webapp/src/dateHelpers.ts` — helper dayjs chung: `loadDayjsLocale`, `localeDateFormat`, `parseInputDate`, `relativeDate`, `humanizeDuration`, `getDateFnsLocale`. **Mọi thao tác ngày mới dùng file này.** Có `require('dayjs/locale/en.js')` ở đầu vì locale 'en' mặc định của dayjs thiếu `formats` (longDateFormat).
  - `webapp/src/routeCompat.ts` — **compat layer router v5→v6**: `useAppRouteMatch()` (thay `useRouteMatch`; đọc `UNSAFE_LocationContext` phòng thủ để KHÔNG throw ngoài Router — khớp location với danh sách route pattern để lấy `match.path` cho `generatePath`) + `useAppNavigation()` (thay `useHistory`; đọc `UNSAFE_NavigationContext`, có `push/replace/goBack`, no-op ngoài Router) + type `AppRouteMatch`, `AppHistory`. **QUAN TRỌNG:** khi thêm/sửa route, phải sync `routePatterns` ở đây với `<Routes>` trong `router.tsx`.
  - `webapp/src/emojiMart.d.ts` — type declarations cho `@emoji-mart/data` và `@emoji-mart/react` (v5 không ship types).
  - `webapp/src/test/emojiMartReactMock.tsx` — stub cho `@emoji-mart/react`, map qua `moduleNameMapper` trong jest config (Picker thật render async qua preact, cần IntersectionObserver/matchMedia → không tương thích jsdom, gây flaky/crash worker).
- **route.tsx / router.tsx:** viết lại cho v6 — `FBRoute` (render-prop) → `FBRouteGuard` (`<Navigate>` + `useParams`); `<Switch>`→`<Routes>`, `element={...}`, `<Router history>`→`<BrowserRouter basename>`.
- **Quét toàn bộ:** `useHistory`→`useAppNavigation`, `useRouteMatch`→`useAppRouteMatch` (16 file), `<Redirect>`→`<Navigate>`. `Utils.showBoard` đổi type param sang `AppHistory`/`AppRouteMatch`.
- **Date:** viết lại `properties/date/date.tsx` + `components/viewHeader/dateFilter.tsx` cho DayPicker v8 (`selected`, `defaultMonth`, `onDayClick`, `footer` cho nút Today, `getDateFnsLocale`); CSS `.DayPicker-*` → `.rdp-*`. **`handleDayClick` set `setHours(12,0,0,0)`** vì v8 giao ngày ở 00:00 (v7 ở 12:00 để tránh DST) — quan trọng cho giá trị lưu. Xoá `widgets/editableDayPicker.tsx` + `.scss` (dead code).
- **Emoji:** viết lại `widgets/emojiPicker.tsx` cho v5; gỡ `emojiMartStore.setHandlers` khỏi `main.tsx`.
- **dnd v16:** fix generic `useDrop<Card, void, {isOver: boolean}>` ở `kanbanColumn.tsx`, `tableGroup.tsx`.

### Bài học test cho các Phase sau (RẤT QUAN TRỌNG khi sửa test)

1. **jest transform ESM:** react-dnd@16/@hello-pangea/dnd/emoji-mart ship ESM `.js`. Config jest đã sửa: `transform` khớp cả `.js` (`^.+\\.(t|j)sx?$`) + `transformIgnorePatterns` whitelist các package này. Nếu thêm dep ESM mới bị "Unexpected token 'export'", thêm tên nó vào `transformIgnorePatterns` trong `package.json`.
2. **Test mock router:** test render component dùng `useAppRouteMatch`/`useAppNavigation` mà KHÔNG bọc Router → dùng `{wrapper: MemoryRouter}` HOẶC `jest.mock('../..routeCompat', ...)` trả `{params, path, url}` (path phải là pattern hợp lệ để `generatePath` không throng). Mẫu: `shareBoard.test.tsx`, `workspace.test.tsx`, `viewHeaderSearch.test.tsx`.
3. **`jest.mock('../utils')` auto-mock** khiến `getBoardPagePath` trả undefined → v6 `generatePath(undefined)` throw `endsWith`. Nếu test mock Utils, thêm `mockedUtils.getBoardPagePath.mockImplementation((p) => p)`.
4. **jsdom thiếu API:** `webapp/jest.setup.js` polyfill `scrollIntoView`, `matchMedia`, `IntersectionObserver`. Thêm vào đây nếu gặp `X is not defined` từ thư viện.
5. **Nondeterministic snapshot flaky song song:** thường do 1 suite crash worker (async lifecycle như emoji-mart). Chẩn đoán bằng `npx jest --runInBand` — nếu serial xanh mà song song đỏ khác nhau mỗi lần → là worker crash, tìm & stub thư viện gây crash (đừng update snapshot bừa).

### Nợ kỹ thuật Phase 3 mở ra (cleanup khi tiện)
- `skipLibCheck: true` vẫn bật (từ Phase 2). react-day-picker đã lên v8 (bỏ `React.SFC`) — thử tắt xem còn lỗi lib không.
- `.npmrc` `legacy-peer-deps=true` — thử xoá + `npm install --allow-remote=all` lại xem còn xung đột peer không.

---

## 4b. ✅ Phase 4 — Editor: draft-js → TipTap v3 (ĐÃ XONG, commit `0c7aa346`)

**Verify đã đạt:** tsc 0 lỗi, eslint sạch (trừ nhiễu CRLF), **jest 140 suite / 836 test / 457 snapshot xanh**, `npx cross-env NODE_ENV=production webpack --config webpack.prod.js` build production OK (chỉ có 3 warning kích thước bundle sẵn có từ trước, không phải lỗi mới). **Cộng với manual browser smoke test đầy đủ** (xem bên dưới) — đây là bước bắt buộc, không chỉ dựa vào jest/tsc/eslint.

- **Component mới, giữ nguyên props contract:** `webapp/src/components/markdownEditor/tiptapEditor.tsx` implement đúng interface cũ (`onChange(text)`, `onFocus/onBlur`, `onEditorCancel`, `saveOnEnter`, initial text) ⇒ `webapp/src/components/markdownEditor.tsx` chỉ đổi **1 dòng** (`React.lazy(() => import('./markdownEditor/tiptapEditor'))`), 4 consumer (`cardDetail/cardDetailContents.tsx`, `cardDetail/commentsList.tsx`, `content/textElement.tsx`, `viewTitle.tsx`) **không đổi gì**.
- **Deps thêm:** `@tiptap/core@3.28`, `@tiptap/react@3.28`, `@tiptap/starter-kit@3.28`, `@tiptap/suggestion@3.28`, `@tiptap/pm@3.28`, `markdown-it@14.1`, `prosemirror-markdown@1.13`; devDep `@types/lodash@4.17`, `@types/markdown-it@14.1`.
- **Xoá:** `draft-js`, `@draft-js-plugins/editor`, `@draft-js-plugins/emoji`, `@draft-js-plugins/mention`, `@types/draft-js`, `components/live-markdown-plugin/` (13 file), `components/markdownEditorInput/` (cũ, cả thư mục). Gỡ `jest.mock('draft-js/lib/generateRandomKey', ...)` khỏi 12 file test.
- **Markdown bridge tự viết — KHÔNG dùng `tiptap-markdown` package:** `webapp/src/components/markdownEditor/markdownBridge.ts` build trực tiếp trên `prosemirror-markdown` + `markdown-it`, thay vì cộng đồng package `tiptap-markdown`.
  - **Lý do (quan trọng, đọc kỹ):** `tiptap-markdown`'s UMD build throw `Cannot read properties of undefined (reading 'Extension')` khi webpack bundle production — bug interop ESM/CJS với `@tiptap/core`'s dual package exports. **Jest KHÔNG bắt được bug này** vì jest's CJS module resolution đi qua path khác trong package "exports" map so với webpack. Bug này chỉ lộ ra khi build bundle thật + chạy trong browser thật — được phát hiện bằng manual testing SAU KHI toàn bộ tsc/eslint/jest đã xanh.
  - Node/mark mapping trong `markdownBridge.ts` lấy từ chính source code `prosemirror-markdown`'s default parser/serializer rules, re-key theo tên node/mark chính xác mà TipTap StarterKit dùng (`bulletList` không phải `bullet_list`, `codeBlock` attr `language` không phải `params`, `orderedList` attr `start` không phải `order`) — verify bằng cách đọc trực tiếp `node_modules/@tiptap/extension-*` source, KHÔNG đoán tên.
  - `tightLists: true` được set qua type-cast (`as ConstructorParameters<typeof MarkdownSerializer>[2]`) vì gap trong published type của `prosemirror-markdown` — field này được đọc runtime nhưng thiếu trong type.
- **Mentions & emoji — plain-text insertion, KHÔNG dùng ProseMirror Node riêng:**
  - Dùng `@tiptap/suggestion`'s low-level `Suggestion` plugin trực tiếp (không dùng `@tiptap/extension-mention` cấp cao hơn), với `props.mount()` (floating-ui built-in, không cần tippy.js thủ công).
  - `mentionExtension.ts` (trigger `@`, gọi `octoClient.searchTeamUsers` qua `loadMentionSuggestions()`) chèn `@username ` dạng **text thuần**, KHÔNG phải custom node. `emojiExtension.ts` (trigger `:`, dataset `@emoji-mart/data` có sẵn từ Phase 3) chèn unicode emoji thuần.
  - **Lý do chọn plain-text thay vì Node type:** khớp CHÍNH XÁC hành vi lưu trữ cũ của draft-js (`block.title` chỉ chứa text/markdown thuần, không có cấu trúc mention riêng) và loại bỏ hoàn toàn rủi ro serialization markdown cho mention/emoji content.
  - Flow xác nhận thêm board-member khi mention người ngoài board (`ConfirmAddUserForNotifications`) giữ nguyên, wiring qua `mentionExtension.ts`'s `onNeedsConfirmAddUser` callback.
- **Key bindings giữ nguyên hành vi cũ:** Escape=blur (`view.dom.blur()`), Backspace-khi-rỗng=cancel (gọi `onEditorCancel`), Enter=save khi `saveOnEnter` — tất cả trong `editorProps.handleKeyDown` của `tiptapEditor.tsx`.
- **`@types/lodash` thêm làm devDependency tường minh:** trước đây chỉ là transitive/hoisted dependency **vô tình** (qua `draft-js`'s dependency tree) — vô hình cho tới khi xoá draft-js thì lộ ra lỗi thiếu type ở 8 file khác (`blocks/block.ts`, `blocks/board.ts`, `searchDialog.tsx`, `sidebarCategory.tsx`, `tutorial_tour_tip/hooks.ts`, `mutator.ts`, `store/views.ts`, `theme.ts`). Bài học: KHÔNG dựa vào transitive type hoisting — khai báo tường minh mọi type dep thực sự dùng tới.

### Bài học Phase 4 (RẤT QUAN TRỌNG — đọc trước khi test browser)

1. **jest/tsc/eslint xanh KHÔNG đủ để coi phase xong nếu phase đó chạm code chạy trong browser.** Bug `tiptap-markdown` ở trên CHỈ lộ ra khi build webpack production bundle thật + mở trong browser thật. Luôn thêm bước: build production (`npx cross-env NODE_ENV=production webpack --config webpack.prod.js`) + mở app thật, thao tác qua feature vừa sửa.
2. **Công cụ gõ phím tự động (browser automation `type` action) có thể KHÔNG mô phỏng đúng gõ phím thật của user** — trong quá trình test tay Phase 4, gõ chuỗi `**bold**` bằng action `type` (chèn hàng loạt ký tự cùng lúc) khiến ProseMirror's Bold InputRule crash với `RangeError: Position X out of range`. Nghi ngờ + verify bằng cách gõ **từng ký tự một** qua action `key` (mô phỏng keydown thật) — KHÔNG crash, input rule hoạt động đúng, tạo `<strong>bold</strong>` sạch sẽ. Kết luận: đây là **artifact của tool test, không phải bug sản phẩm thật**. Bài học cho phase sau: khi nghi ngờ 1 crash trong browser test tự động liên quan đến ProseMirror InputRule (hoặc bất kỳ logic nhạy cảm với thứ tự keystroke), **luôn verify lại bằng gõ từng-ký-tự-một** trước khi kết luận là bug thật.
3. **`key: "Space"` và `key: "Return"` là no-op trong môi trường browser automation này** (đã ghi nhận từ trước với "Return"; Phase 4 phát hiện thêm "Space" cũng vậy) — dùng action `type` với 1 ký tự space thay vì `key: "Space"` khi cần trigger input rule cần dấu cách (ví dụ bullet list `- `).
4. **Full manual verify checklist đã chạy và ĐẠT** (không tìm thấy bug sản phẩm thật nào): bold/italic/strike/inline-code marks, heading, bullet list 2 item, mention `@` (suggestion dropdown đúng, chèn plain text, không crash), emoji `:` (suggestion dropdown đúng, chèn unicode), multi-line comment (soft break `Shift+Enter`, hard break serialize đúng `\\\n`) — **tất cả đã kiểm tra persist đúng qua 2 lần full page reload** (description card + comment).

### Nợ kỹ thuật Phase 4 mở ra (cleanup khi tiện)
- Live-markdown decorator cũ (gõ `**bold**` thấy style ngay lập tức trong khi gõ, trước khi hoàn tất) đã được thay bằng WYSIWYG native của TipTap (input rule áp style ngay khi gõ xong ký tự đóng) — chấp nhận đổi UX nhỏ này, không rebuild lại decorator kiểu cũ.
- `components/confirmAddUserForNotifications.test.tsx` (có sẵn từ trước) test component đó độc lập; KHÔNG có test riêng cho wiring mention→confirm-modal trong `tiptapEditor.tsx` (chỉ verify bằng manual browser test) — cân nhắc thêm 1 test tích hợp nếu có thời gian.

---

## 4c. 🟡 Phase 5 — Hiệu năng & cấu trúc — MỘT PHẦN đã xong (commit `248fefa6`)

**Verify đã đạt cho phần đã làm:** go build/vet/test (server) xanh — gồm cả cycle up/down của migration 000041 (chạy 2 lần qua `foundation` test harness, mỗi test tear-down tự áp down-migration); tsc 0 lỗi; eslint sạch (trừ CRLF); **jest 140 suite / 838 test / 457 snapshot xanh** (2 test mới cho `getAllBlocks`); webpack production build OK. **Cộng với manual smoke test qua browser thật**: rebuild server binary, tạo board + card qua UI thật, reload trang, xác nhận card persist đúng qua HTTP request paginated `?all=true&page=0&per_page=500` thật (không phải chỉ mock).

### Đã làm (5a — server pagination, HOÀN TẤT)
- Migration mới `server/services/store/sqlstore/migrations/000041_blocks_pagination_index.{up,down}.sql` — index `idx_blocks_board_id_id` qua `createIndexIfNeeded` (phủ cả 3 DB).
- `sqlstore/blocks.go` `getBlocks()`: thêm `.OrderBy("board_id", "id")` — luôn áp, kể cả khi không phân trang (vô hại, cần cho kết quả phân trang ổn định).
- `api/blocks.go` `handleGetBlocks`: parse `page`/`per_page` từ query.
- `app/blocks.go` `GetBlocks()`: **viết lại hoàn toàn** — thay vì định tuyến qua 3 store method riêng (`GetBlocksWithParentAndType`/`WithType`/`WithParent`, đều KHÔNG hỗ trợ phân trang), giờ luôn build `model.QueryBlocksOptions{BoardID, ParentID, BlockType, Page, PerPage}` và gọi thẳng `a.store.GetBlocks(opts)` — method này **đã tồn tại sẵn** trên interface `store.Store` (đã có Page/PerPage, đã implement, đã mock, đã dùng ở `app/cards.go`/`app/import.go`), nên **KHÔNG cần sửa interface `store.Store`, KHÔNG cần đụng `mattermostauthlayer` hay `mockstore`** — đây là lý do 5a xong nhanh và an toàn hơn spec gốc dự tính. 3 store method cũ (`GetBlocksWithParentAndType` v.v.) vẫn còn nguyên trên interface (storetests + mockstore vẫn test/mock chúng), chỉ đơn giản là app layer không gọi tới nữa.
- `api/blocks.go` case `all != ""` (client `getAllBlocks`) cũng đổi sang gọi `a.app.GetBlocks(boardID, "", "", page, perPage)` thay vì `a.app.GetBlocksForBoard(boardID)` — hai cách này trả kết quả **giống hệt nhau** khi page/perPage=0 (đã verify bằng cách đọc `getBlocksWithParent`'s SQL: `ParentID=""` nghĩa là KHÔNG áp filter parent_id, y hệt "toàn bộ block của board"), nhưng giờ path này CÓ hỗ trợ phân trang. `app.GetBlocksForBoard` (dùng bởi `export.go`, nhiều integration test, `storetests/`) **giữ nguyên signature/hành vi cũ**, không đụng.
- Swagger cập nhật (`page`, `per_page` query params trên `getBlocks` operation).

### Đã làm (5b — CHỈ bước 1, "transparent")
- `webapp/src/octoClient.ts` `getAllBlocks()`: viết lại thành loop `page=0,1,2,...` với `per_page=500`, dừng khi 1 trang trả về ít hơn 500 item. Không đổi return type/behavior nhìn từ ngoài (`loadBoardData` và mọi reducer nghe `loadBoardData.fulfilled` **không đổi 1 dòng nào**) — chỉ đổi CÁCH lấy dữ liệu (nhiều request nhỏ thay vì 1 request khổng lồ), giải quyết đúng rủi ro chính: 1 query/1 response không giới hạn kích thước cho board rất lớn.
- Test mới trong `octoClient.test.ts`: verify dừng đúng khi trang ngắn, verify loop đúng khi có ≥2 trang.

### ❌ CHƯA làm — 5b bước 2 (defer content load) — LÝ DO, đọc kỹ trước khi làm
Spec gốc: "load đầu chỉ fetch `type=view/card/checkbox`; content/comment fetch khi mở card dialog." **Đã kiểm tra call site TRƯỚC khi làm và phát hiện việc này sẽ VỠ tính năng khác nếu làm ngay:**
- `components/cardBadges.tsx`, `components/gallery/galleryCard.tsx`, `properties/updatedBy/updatedBy.tsx`, `properties/updatedTime/updatedTime.tsx` — **tất cả đọc content block của MỌI card trên board** (không chỉ card đang mở): gallery cần preview nội dung của TẤT CẢ card hiển thị; cardBadges cần đếm checkbox/text của TẤT CẢ card (không chỉ card đang mở) để hiện badge trên kanban/table; updatedBy/updatedTime tương tự.
- Nếu defer content load như spec gốc mô tả mà KHÔNG sửa 4 consumer trên trước, gallery view sẽ mất preview và badges sẽ trống cho MỌI card trừ card đang mở — regression trực tiếp, dễ thấy.
- **Việc cần làm trước khi defer content**: thiết kế lại 4 consumer trên để tự lazy-fetch content riêng cho từng card chúng cần hiển thị (ví dụ mỗi `GalleryCard`/`TableRow` tự gọi 1 API nhỏ lấy content của card đó nếu chưa có trong store), hoặc giữ nguyên việc luôn tải `type=checkbox` + `type=text` (không chỉ `checkbox`) trong initial load, giảm bớt lợi ích "defer" nhưng an toàn hơn. **Chưa quyết định hướng nào — để agent tiếp theo cân nhắc.**

### Đã làm (5c — MỘT PHẦN: sửa bug memo bị vô hiệu hoá bởi key không ổn định)
- **Phát hiện quan trọng:** `TableRow` (`components/table/tableRow.tsx`) và `GalleryCard` (`components/gallery/galleryCard.tsx`) **ĐÃ ĐƯỢC** bọc `React.memo` từ trước — nhưng `tableRows.tsx` và `gallery.tsx` render chúng với `key={card.id + card.updateAt}`, khiến React coi mỗi lần `updateAt` đổi là 1 element HOÀN TOÀN MỚI ⇒ unmount/remount thay vì diff props ⇒ `React.memo` KHÔNG BAO GIỜ có cơ hội chạy. Sửa: đổi key thành `card.id` ở cả 2 file — giờ sửa 1 card không còn ép re-render/re-mount các card khác không liên quan.
- `components/cardBadges.tsx`: gọi `getCardContents(card.id)` (factory trả về 1 `createSelector` MỚI) trực tiếp trong thân render ⇒ tạo 1 Reselect selector MỚI (cache rỗng) mỗi lần render ⇒ mất hết lợi ích memoization của Reselect qua các lần render. Sửa bằng `useMemo(() => getCardContents(card.id), [card.id])` để giữ NGUYÊN 1 selector instance qua các lần render (thay vì thêm dependency `re-reselect` như spec gốc gợi ý — `useMemo` đạt hiệu quả tương đương, không cần thêm package mới). `getCardComments`/`getLastCardContent` KHÔNG cần sửa vì chúng vốn là closure thường (không dùng `createSelector`), đã trả về tham chiếu ổn định sẵn.

### ❌ CHƯA làm — 5c phần còn lại
- Tách chuỗi `createSelector` filter→search→sort trong `store/cards.ts` (`getCurrentViewCardsSortedFilteredAndGroupedWithoutLimit`). **Lý do quan trọng cần hiểu trước khi làm:** tách thành chuỗi Reselect KHÔNG tự động giải quyết "sửa 1 card re-sort cả board", vì `getCurrentBoardCards` (input đầu chuỗi) đã đổi tham chiếu output mỗi khi BẤT KỲ card nào trong board đổi (do cách `Object.values`/filter tạo mảng mới) — cache Reselect ở các bước sau vẫn miss. Muốn giảm thật sự chi phí re-sort cần: (a) hoặc chấp nhận re-sort là rẻ (so sánh vài nghìn phần tử) và tập trung tránh RE-RENDER (đã làm ở trên qua key+memo), (b) hoặc đổi cấu trúc dữ liệu sâu hơn (structural sharing tốt hơn ở tầng reducer) — việc lớn hơn nhiều so với "tách selector" đơn thuần mà spec gốc mô tả.
- Virtualize `react-window` `VariableSizeList` cho `tableRows.tsx` khi không group.
- Kanban virtualization (đã note "HOÃN" từ spec gốc — giữ nguyên, chưa làm).

### ❌ CHƯA làm — 5d (tách god-file `mutator.ts`/`octoClient.ts`)
Lý do: thuần refactor tổ chức file, KHÔNG có lợi ích hiệu năng/tính năng, quy mô lớn (1224 + 1091 dòng, hàng trăm import site dùng `mutator.method()`/`octoClient.method()` trực tiếp), rủi ro lỗi cơ học (sai sót khi di chuyển method, quên bind `this`, circular import giữa các file con) cao so với lợi ích. Cân nhắc kỹ thuật khi làm: nếu giữ nguyên class `Mutator`/`OctoClient` + facade export như spec gốc mô tả, cách AN TOÀN NHẤT để không phá vỡ `this` binding là dùng `Object.assign(Mutator.prototype, blocksMethods, ...)` (method thường, không phải arrow function, để `this` bind đúng khi gọi qua `mutator.method()`) thay vì cố tách thành các function độc lập nhận `this` làm tham số tường minh.

---

## 4d. ✅ Phase 6 — Quick wins (ĐÃ XONG, commit `e714c4ba`)

**Verify đã đạt:** tsc 0 lỗi, eslint sạch (trừ CRLF), jest xanh (toàn bộ suite, gồm test mới cho `groupCardsTwoLevels`/`checklistUtils`/`cardHistory`), webpack build OK. Server: `GetBlockHistory` API mới không đổi interface `store.Store` (dùng method sẵn có) ⇒ không đụng `mattermostauthlayer`.

- **6a. WIP limit:** `blocks/boardView.ts` `BoardViewFields` += `columnWipLimits?: Record<string, number>`, default `{}` trong `createBoardView()`. UI ở `kanbanColumnHeader.tsx` + `kanban.tsx`.
- **6b. Swimlane:** `BoardViewFields` += `swimlaneById?: string`, `collapsedSwimlanes?: string[]`. Util `groupCardsTwoLevels` + `groupCardsByOptions` (export) trong `boardUtils.ts`. Menu mới `viewHeader/viewHeaderSubGroupByMenu.tsx`. `kanban.tsx` render 2 cấp, drop handler set cả 2 property cùng lúc.
- **6c. Checklist progress:** `checklistUtils.ts` (mới, tách logic đếm checkbox ra khỏi `cardBadges.tsx` để dùng chung) + `cardDetail/checklistProgress.tsx`.
- **6d. Card history UI:** `server/api/blocks.go` `handleGetBlockHistory` + `server/app/blocks.go` `GetBlockHistory` (cưỡi store method **sẵn có**, không sửa interface) + `cardDetail/cardHistory.tsx` (mới).
- **Bug thật tìm thấy qua jest (không phải do Phase 6 gây ra nhưng lộ ra khi thêm field mới):** `KanbanColumnHeader`/`kanban.tsx` đọc `undefined.columnWipLimits[...]`/`.collapsedSwimlanes.includes(...)` crash trên `BoardView` object dựng tay trong test (bypass `createBoardView()`). Sửa bằng guard `?.`/`|| []` tại điểm đọc — **an toàn cho data thật** vì `octoUtils.tsx`'s `fixBlock` luôn route block tải từ server qua `createBoardView()`/`createCard()` nên field default luôn được set; chỉ test fixture tự dựng object mới thiếu field.

### Nợ kỹ thuật Phase 6 mở ra
- Timeline (Phase 7) tái dùng `groupCardsTwoLevels` nhưng **KHÔNG dùng** trong Timeline view (xem mục 4e — swimlane trong Timeline chưa làm).

---

## 4e. ✅ Phase 7 — Dependencies + Timeline/Gantt (ĐÃ XONG, commit `c8470ebd` phần 7a + `7e79fd4f` phần 7b)

**Verify đã đạt:** tsc 0 lỗi, eslint sạch, **jest 151 suite / 899 test / 457 snapshot xanh**. Server không đổi (7a+7b đều thuần webapp) ⇒ không cần chạy lại go test. **Manual browser smoke test đầy đủ đã chạy** (xem bên dưới) — bắt buộc vì Timeline đụng code chạy trong browser (drag/resize qua raw mouse event, không phải chỉ logic thuần).

### 7a. Card dependencies (commit `c8470ebd`)
- `blocks/card.ts`: `CardFields` += `blockedBy?: string[]`, default `[]` trong `createCard()`.
- `cardDependencyUtils.ts` (mới): `wouldCreateCycle(cardsById, cardId, candidateBlockerId)` — DFS thuần, dùng chung giữa mutator (check trước khi commit) và UI picker (lọc option sẽ tạo vòng).
- `store/cards.ts`: `getCardDependencyMap` — **1 selector global KHÔNG tham số hoá theo boardId** (khác với factory pattern `(boardId) => selector` — cố ý tránh anti-pattern gọi factory trong thân render tạo selector mới mỗi lần, xem bài học Phase 5 mục 4c).
- `mutator.ts`: `addCardDependency`/`removeCardDependency` — check vòng qua `store.getState()` làm safety net cuối trước khi commit.
- UI: `cardDetail/cardDependencies.tsx` ("Blocked by" picker + "Blocks" derived read-only), badge "blocked" trong `cardBadges.tsx` (dùng `CompassIcon icon='lock-outline'`).

### 7b. Timeline/Gantt view (commit `7e79fd4f`)
- `blocks/boardView.ts`: `IViewType` += `'timeline'`; `ITimelineZoom = 'day'|'week'|'month'|'quarter'`; `BoardViewFields` += `timelineZoom` (default `'week'`), `showDependencies` (default `true`).
- **Quyết định quan trọng — tái dùng `dateDisplayPropertyId` thay vì field riêng:** spec gốc dự tính `timelineDatePropertyId` riêng; thực tế tái dùng field `dateDisplayPropertyId` **đã có sẵn** (dùng chung với Calendar view) — giảm phạm vi (không cần UI picker mới, `viewHeaderDisplayByMenu.tsx` dùng nguyên), và **tái dùng `DatePropertyType.getDateFrom/getDateTo`** (`properties/types.tsx`/`properties/date/property.tsx`) thay vì tự parse JSON — abstraction này đã giải quyết sẵn quirk "date property lưu ở 12pm UTC, normalize về local midnight" mà Calendar's `fullCalendar.tsx` đã dùng.
- Thư mục mới `webapp/src/components/timeline/`: `timelineUtils.ts` (toán date↔pixel qua `dayjs(...).startOf('day').diff(...)`, KHÔNG chia mili-giây thô — an toàn qua DST, có test fixture đổi `process.env.TZ` runtime), `timelineRow.tsx` (bar 1 card, drag=dời/resize qua raw `mousedown`→`document.mousemove/mouseup`, commit qua `mutator.changePropertyValue` khi `mouseup`), `timelineHeader.tsx` (thang thời gian), `dependencyArrows.tsx` (SVG `<line>` overlay, đỏ khi vi phạm thứ tự), `timeline.tsx` (view chính — tách scheduled/unscheduled, khay "Unscheduled" cho card chưa có ngày).
- Wiring: `viewMenu.tsx` (thêm vào menu "Add view"), `viewHeader.tsx` (hiện Display by/Sort by giống Calendar), `workspace.tsx` (auto-fallback `dateDisplayProperty` giống Calendar), `centerPanel.tsx` (case render mới).

### Deviations so với spec gốc (cố ý, đã cân nhắc — đọc trước khi mở rộng Timeline)
1. **Drag/resize dùng raw mouse event, KHÔNG dùng react-dnd** — react-dnd được thiết kế cho reorder qua drop-target rời rạc, không hợp với kéo tự do theo tỷ lệ pixel liên tục.
2. **Không có arrowhead marker trên dependency line** — SVG `<marker>` + `currentColor` có vấn đề portability qua theme, đơn giản hoá thành `<line>` trơn.
3. **Swimlane (Phase 6) KHÔNG tái dùng trong Timeline** — chỉ 1 cấp hàng.
4. **KHÔNG virtualize hàng bằng `react-window`** — spec gốc đề xuất làm từ đầu vì dễ hơn kanban, nhưng chưa làm (số card thực tế trong board cá nhân nhỏ, chưa thấy cần).

### Manual browser verify đã chạy (bắt buộc, không chỉ dựa jest)
- Rebuild webpack production bundle + restart server thật, mở board "Personal Tasks" thật qua UI.
- Thêm date property qua UI thật, set ngày cho 2 card có quan hệ blocked-by (từ Phase 7a) → mở Timeline view → xác nhận: vị trí/độ rộng bar khớp chính xác với ngày (đối chiếu pixel qua `getBoundingClientRect` với công thức `pxPerDay`), badge `--blocked` hiện đúng, dependency arrow hiện với style `--violated` đúng khi thứ tự bị vi phạm.
- Kéo bar qua sự kiện mouse thật (`mousedown`→`mousemove`→`mouseup` cách nhau, KHÔNG dồn 1 lần — xem "bài học test" bên dưới) → ngày cập nhật đúng, **persist qua restart server thật** (không chỉ qua reload client-side).
- **Bài học test (browser automation, không phải bug sản phẩm):** nếu dispatch `mousedown`+`mousemove`+`mouseup` dồn trong CÙNG MỘT lần gọi script đồng bộ (không có khoảng cách để React flush state + effect), component có thể kẹt ở trạng thái "dragging" vì `useEffect` gắn listener `document.mouseup` chưa kịp chạy trước khi mouseup được dispatch. Đây là **artifact của cách test tự động dồn sự kiện, không phải bug thật** — người dùng thật luôn có khoảng cách giữa 2 native event. Xác nhận bằng cách tách 3 sự kiện thành 3 lần gọi script riêng (hoặc dispatch thêm 1 `mouseup` riêng) → hoạt động đúng ngay. Bài học chung (nối tiếp bài học Phase 4 #2): khi test kéo-thả/nhiều-bước qua browser automation mà thấy hành vi lạ, luôn nghi ngờ cách dồn sự kiện của tool test trước khi kết luận là bug sản phẩm.

---

## 4f. ✅ Phase 8 — Automation rules engine (ĐÃ XONG, commit `42c7219f`)

**Verify đã đạt:** `go build -tags 'json1 sqlite3' ./...` sạch trên TOÀN BỘ module (gồm `mattermostauthlayer`/`ws/plugin_adapter`/`notify/plugindelivery`); `go vet` sạch; go test package `services/automation` (unit, fakes tự viết thay vì gomock vì interface hẹp) + `services/store/sqlstore` (bao gồm `AutomationStore` mới trong `storetests/`, chạy migration up thật trên SQLite) đều xanh; webapp tsc/eslint/jest (153 suite/910 test/457 snapshot) xanh. **Verify thủ công trên server thật**: tạo rule "khi Occurrence đổi → set Completed=true" qua UI, đổi Occurrence trên card thật → xác nhận qua server log CẢ hai việc: (1) action chạy đúng (PATCH Completed thật), VÀ (2) **action của chính automation KHÔNG tự kích hoạt lại notifyBlockChanged** (log chỉ xuất hiện 1 lần, không đệ quy) — bằng chứng cơ chế chống loop hoạt động đúng, không chỉ đúng trên giấy.

- **Kiến trúc:** `server/services/automation/` là một `notify.Backend` mới, gắn vào ĐÚNG hook `blockChangeNotifier` đã có sẵn (không thêm call site mới). Đăng ký NGAY TRONG `server.New()` (cùng chỗ `notifylogger` được thêm) — nghĩa là **không cần sửa `linux/main.go` hay plugin wrapper**, tự động chạy ở cả 2 run mode.
- **Vấn đề circular dependency & cách giải:** `app.New()` cần `notify.Service` (chứa backend automation) đã tồn tại trước, nhưng backend automation cần `*app.App` để THỰC THI action (PatchBlock/InsertBlock). Giải bằng deferred setter: `Backend.SetActionExecutor(app)` gọi NGAY SAU `app.New()` trả về trong `server.go`, không phải qua constructor. Phần ĐỌC rule (`GetAutomationRules`, dùng để match trigger) không bị vướng vì đó chỉ là `store.Store` — có sẵn TRƯỚC cả app lẫn notify.Service.
- **`store.Store` interface += 6 method** (`GetAutomationRules/GetAutomationRule/UpsertAutomationRule/DeleteAutomationRule/CreateAutomationRun/GetAutomationRuns`) → implement trong `sqlstore/automation.go` (private method + `go run ./generators/main.go` sinh `public_methods.go` — đã CHẠY THẬT, không phải viết tay), mock qua `mockgen` (đã cài `go install github.com/golang/mock/mockgen@v1.6.0`, chạy thật, không viết tay). **`mattermostauthlayer` KHÔNG cần sửa gì** — struct này `embed store.Store` trực tiếp nên method mới tự động pass-through, xác nhận bằng `go build ./...` sạch trên toàn module.
- **Migration `000042_create_automation_rules` + `000043_create_automation_runs`**: bảng rules (trigger_type/trigger_config JSON/actions JSON) + bảng run log (để UI xem lịch sử chạy).
- **Chống loop — quyết định khác với draft ban đầu:** thay vì chỉ dựa vào check `ModifiedBy == automationBotID` trong matcher (như draft plan mô tả), mọi write của automation dùng `PatchBlockAndNotify(..., disableNotify=true)`/`InsertBlockAndNotify(..., disableNotify=true)` — flag NÀY ĐÃ CÓ SẴN trong `app/blocks.go`, chỉ bỏ qua bước gọi `notifyBlockChanged` (vẫn broadcast websocket/webhook bình thường). Nghĩa là write của automation KHÔNG BAO GIỜ sinh ra `BlockChangeEvent` mới → không thể tự kích hoạt lại CHÍNH NÓ hay bất kỳ rule nào khác — đơn giản và chắc chắn hơn hẳn so với check theo bot userID (vẫn giữ check đó làm lớp phòng thủ thứ 2, không hại gì). Đánh đổi: KHÔNG hỗ trợ rule-A-kích-hoạt-rule-B (chain nhiều hop) — chấp nhận cho v1.
- **Trigger v1 (4 loại, matcher.go):** `card-created`, `property-changed`/`moved-to-group` (cùng 1 cơ chế — "group by" chỉ là 1 property select bình thường trong data model này, không có khái niệm riêng ở server), `checklist-completed` (chỉ đếm checkbox block riêng, KHÔNG đếm checkbox markdown nhúng trong text — xem ghi chú checklistUtils.ts gốc), `dependency-unblocked` (quét toàn bộ card trên board tìm ai có `blockedBy` chứa card vừa "done", kiểm tra TẤT CẢ blocker của nó đã done chưa).
- **Action v1 (actions.go):** `set-property`/`move-to-group` (PATCH properties — **phải clone rồi merge 1 key**, vì `BlockPatch.UpdatedFields` merge nông ở cấp TOP-LEVEL của `Fields`, truyền cả object `properties` mới sẽ ĐÈ MẤT các property khác), `add-comment` (tạo block `TypeComment` mới, thay token `{{card.title}}`), `notify-user` (chỉ tạo Subscription cho user đó — có tác dụng thật ở CẢ 2 mode vì "follow" card hoạt động độc lập; delivery thông báo thật CHỈ có ở plugin mode do standalone không có kênh gửi, giống hệt hạn chế `notifysubscriptions`/`notifymentions` đã có từ trước — `NotifyBackends: nil` trong `linux/main.go`).
- **Rate limiter (ratelimit.go):** 10 lần/phút/(rule,card) — phòng thủ bổ sung (KHÔNG phải cơ chế chống loop chính, vì disableNotify đã chặn loop từ gốc), phòng trường hợp fan-out gián tiếp hiếm gặp.
- **API (`api/automation.go`):** CRUD `GET/POST /boards/{boardID}/automation/rules`, `PUT/DELETE .../rules/{ruleID}`, `GET .../rules/{ruleID}/runs` — quyền đọc `PermissionViewBoard`, ghi `PermissionManageBoardProperties`.
- **Webapp:** `store/automationRules.ts` (RTK slice + `createAsyncThunk`), `components/automation/` (`ruleList.tsx` liệt kê/xoá, `ruleEditor.tsx` form trigger+action dùng select/input thường — KHÔNG có schema-driven form builder, đủ dùng cho v1), nút "Automation" cạnh nút Share trên header board (ẩn khi `readonly`).

### Nợ kỹ thuật Phase 8 mở ra
- Rule cache (TTL 30s per board trong `engine.go`) chỉ invalidate LOCAL NODE khi CRUD qua API cùng node đó — multi-node deployment có độ trễ tới 30s, đã ghi chú trong code.
- `notify-user` action không có delivery thật ở standalone mode (xem trên).
- Không hỗ trợ rule-kích-hoạt-rule (multi-hop) do thiết kế disableNotify.

---

## 4g. ✅ Phase 9 — Formula property (ĐÃ XONG, commit `c1365cea`)

**Verify đã đạt:** tsc 0 lỗi, eslint sạch, **jest 157 suite / 951 test / 457 snapshot xanh** (thêm 1 regression test cho bug `createBoard()` bên dưới). Server KHÔNG đổi (đúng như plan — cô lập hoàn toàn phía webapp). **Verify thủ công trên server thật** phát hiện 1 bug thật (xem bên dưới), đã sửa và verify lại full cycle (save → evaluate → hiện giá trị NGAY không cần reload → đổi tên property → giá trị VẪN ĐÚNG sau reload) trước khi coi phase xong.

- `blocks/board.ts`: `PropertyTypeEnum += 'formula'`; `IPropertyTemplate += formula?: string` (biểu thức, lưu trên TEMPLATE, không lưu giá trị trên từng card).
- `properties/formula/lib/`: engine tự viết, KHÔNG thêm dependency — `tokenizer.ts`, `parser.ts` (recursive-descent, KHÔNG phải bảng Pratt như draft mô tả — cho cùng kết quả với grammar cố-định-độ-ưu-tiên này, ít rủi ro viết sai tay hơn), `evaluator.ts`. Ngữ pháp: số/chuỗi/bool, `+ - * / %`, so sánh `== != < <= > >=`, từ khoá `and/or/not`, `if(c,a,b)`, `concat()`, `prop("Tên")`, `now()`, `dateAdd/dateBetween` (qua dayjs), `round/abs/min/max`, `length/contains`. `prop()` trên property select/multiSelect trả về NHÃN lựa chọn (không phải ID lưu trong DB); đệ quy vào formula khác tối đa 4 tầng + phát hiện vòng lặp.
- `properties/formula/formula.tsx`: **ô giá trị của property này kiêm luôn UI chỉnh biểu thức** — click vào giá trị đã tính để lộ ô nhập biểu thức formula (kèm thông báo lỗi parse trực tiếp). Đây là cách làm nhất quán với property "select" (ô giá trị của nó cũng kiêm luôn nơi thêm/sửa option board-wide), KHÔNG phải tự nghĩ ra pattern mới.
- **Route qua 3/5 điểm đọc nêu trong draft gốc** (`calculations.ts`, `cardFilter.ts`, `store/cards.ts sortCards`) — **2 điểm còn lại KHÔNG cần sửa**: `boardUtils.ts groupCardsByOptions` không bao giờ nhận property formula vì `canGroup` giữ `false` (mặc định của base class, giống number/text/url) nên menu "Group by" đã tự loại nó; `PropertyValueElement` không cần sửa vì nó vốn đã uỷ quyền hoàn toàn cho `Editor` component của property type (giống hệt cách createdBy/createdTime đã làm từ trước).
- `calculations.ts`: **mọi hàm trong file đều thêm tham số `templates`** (cần cho `prop()`) — thay đổi cơ học nhưng toàn diện vì tất cả hàm đi qua chung 1 helper `getCardProperty()`. **CSV export (`PropertyType.displayValue`) CỐ Ý KHÔNG route qua formula** — chữ ký hàm đó không có cách nào mang theo danh sách property đầy đủ mà `prop()` cần, và mở rộng chữ ký sẽ đụng MỌI property type trong `webapp/src/properties` chỉ vì 1 tính năng phụ (export) — ghi nhận là giới hạn có chủ đích, không phải thiếu sót ẩn.

### 🐛 Bug thật tìm thấy & đã sửa: `createBoard()` xoá mất field `formula` khi clone
- **Vị trí:** `webapp/src/blocks/board.ts`, hàm `createBoard()`, đoạn deep-clone `cardProperties` chỉ copy `{id, name, type, options}` — thiếu MỌI field khác kể cả `formula` mới thêm.
- **Hậu quả:** bất kỳ luồng mutator nào gọi `createBoard(existingBoard)` — ví dụ `changePropertyTypeAndName` (dùng khi **ĐỔI TÊN** property, không chỉ đổi type) — sẽ ÂM THẦM XOÁ biểu thức formula của MỌI property formula khác trên board, kể cả khi user chỉ đang đổi TÊN một property KHÁC không liên quan.
- **Cách phát hiện:** KHÔNG phải từ đọc code — phát hiện khi test tay trên browser thật: đổi tên property formula (không đụng vào formula), reload, thấy formula biến mất. Bài học lặp lại từ Phase 4/7: **luôn test tay trên browser thật cho tính năng chạm UI**, kể cả khi tsc/eslint/jest đã xanh hết.
- **Sửa:** thêm `formula: o.formula` vào object clone trong `createBoard()`. Thêm regression test trong `blocks/board.test.ts` (`describe('createBoard')`) xác nhận field được giữ lại qua clone.

### Nợ kỹ thuật Phase 9 mở ra
- CSV export không hiện giá trị formula (xem trên — giới hạn có chủ đích).
- `person`/`multiPerson` property đọc qua `prop()` trả về raw user ID (không resolve tên hiển thị) — evaluator là module thuần, không có quyền truy cập users store.
- Không có UI riêng cho rollup/aggregate qua formula (đã loại khỏi phạm vi từ draft gốc, chờ relation property).

---

## 5. CÁC PHASE CHƯA LÀM — SPEC CHI TIẾT (phần Phase 5 dưới đây giữ nguyên bản gốc để đối chiếu — xem mục 4c ở trên để biết chính xác cái gì ĐÃ xong)

> Nguồn đầy đủ hơn: `docs/modernization/PLAN-9-phases.md` (trong repo). Dưới đây là bản rút gọn đủ để thực thi.

### 🟡 Phase 5 — Hiệu năng & cấu trúc (L) — spec gốc, xem mục 4c để biết phần nào ĐÃ xong

**5a. Server pagination — migration `000041_blocks_pagination_index`:**
- Tạo `server/services/store/sqlstore/migrations/000041_blocks_pagination_index.{up,down}.sql`. Index mới `{{.prefix}}blocks (board_id, id)` qua `createIndexIfNeeded` (phủ cả 3 DB); down migration drop index.
- `sqlstore/blocks.go` hàm `getBlocks`: **pagination đã có sẵn** ở dòng ~73-79 (áp `Offset(Page*PerPage)`/`Limit`) nhưng **chưa có `ORDER BY`** — thêm `ORDER BY board_id, id` (luôn thêm, vô hại). `model.QueryBlocksOptions` đã có field `Page`/`PerPage` (`server/model/block.go:212`).
- `server/api/blocks.go` hàm `handleGetBlocks`: parse thêm query param `page`, `per_page` → truyền vào `QueryBlocksOptions`. Cập nhật `server/swagger/swagger.yml`.

**5b. Webapp windowed load:**
- Client mở board hiện tại = **1 call** `GET /api/v2/boards/{id}/blocks?all=true` (`octoClient.ts getAllBlocks:~303` ← `store/initialLoad.ts loadBoardData:~64` ← `boardPage.tsx:~189,198`).
- Bước 1 (trong suốt): `getAllBlocks` loop từng trang 500 tới trang ngắn; `loadBoardData` dispatch blocks tăng dần.
- Bước 2 (defer contents): load đầu chỉ fetch blocks `type=view`, `type=card`, **và `type=checkbox`** (call thứ 3 — **bắt buộc** vì `cardBadges.tsx` đếm checkbox từ content blocks); content/comment của card fetch khi mở card dialog (`cardDetail.tsx` mount effect, `GET /boards/{id}/blocks?parent_id={cardID}&all=true`).
- **WS giữ broadcast toàn board** (KHÔNG làm subset-aware): reducer đã upsert block bất kỳ, block chưa hold tới qua WS thì cứ lưu — rẻ, không over-engineer.

**5c. Redux + render perf:**
- `store/cards.ts`: tách memo filter+search+sort (hiện là 1 memo lớn, đổi 1 card là re-sort cả board) thành chuỗi `createSelector` (filtered → searched → sorted) theo view; memoize `getCurrentBoardCards`; `CardBadges` dùng `createCachedSelector` (re-reselect) key theo cardId.
- `components/table/tableRows.tsx`: bỏ pattern `key={card.id+card.updateAt}` (đổi thành key theo `card.id`, memo `TableRow`); bọc table body không-group bằng `react-window` `VariableSizeList` (giữ trong `ColumnResizeProvider`). **Kanban virtualization HOÃN** (phức tạp dnd-ref — ghi out-of-scope).

**5d. Tách god-file (KHÔNG đổi import site):**
- `mutator.ts` (1224 dòng, singleton default export) → tách `webapp/src/mutators/{blocks,boards,members,properties,views,cards,categories,subscriptions,userConfig}.ts` re-export qua singleton facade cũ. `octoClient.ts` (1091 dòng) tương tự → `webapp/src/octoClient/*.ts`. Vì re-export qua facade nên hàng trăm import site không đổi.

**Verify:** `go test` migration up/down 2 chiều (CI chạy đủ 3 DB); seed board 1000 card bằng script API (để trong scratchpad); mở board lớn, scroll table, mở card, sửa live từ browser thứ 2 (WS).

### ✅ Phase 6 — Quick wins (M) — ĐÃ XONG, xem mục 4d để biết chi tiết thực tế đã làm (spec gốc giữ nguyên bên dưới để đối chiếu)

**6a. WIP limit cột kanban:** `blocks/boardView.ts` `BoardViewFields` += `columnWipLimits?: Record<optionId, number>` (default `{}` trong `createBoardView()`). View fields là JSON tự do ⇒ **không cần migration/server change**. UI ở `kanbanColumnHeader.tsx`: hiện `count/limit`, style đỏ khi vượt, menu "Set WIP limit…"; mutator mới `changeViewColumnWipLimit`. V1 chỉ cảnh báo hình ảnh (soft).

**6b. Swimlane (grouping cấp 2):** `BoardViewFields` += `swimlaneById?: string`, `collapsedSwimlanes?: string[]`. Menu "Sub-group by" trong `viewHeader/viewHeaderGroupByMenu.tsx`. Util mới `groupCardsTwoLevels(cards, groupByTpl, swimlaneTpl): Swimlane[]` trong `boardUtils.ts` (+ memo cạnh `centerPanel.tsx:~384`). `kanban.tsx` (~285-324): khi có swimlane, render hàng ngoài chứa dải cột hiện tại; drop handler set **cả 2** property. *(Util này Phase 7 timeline dùng lại.)*

**6c. Checklist progress:** không cần block type mới — nhóm các `checkbox` content blocks sẵn có. Component mới `cardDetail/checklistProgress.tsx`: progress bar (tái dùng logic đếm của `cardBadges.tsx`) trên card contents; badge % trên kanban card từ data badge sẵn có.

**6d. Card history UI:**
- Server: handler mới `handleGetBlockHistory` trong `api/blocks.go` — `GET /api/v2/boards/{boardID}/blocks/{blockID}/history?page=&per_page=`, cưỡi `store.GetBlockHistory` **sẵn có** (đã có pagination); permission `PermissionViewBoard`; đăng ký trong `registerBlocksRoutes` (`api/api.go:~92`); swagger. **KHÔNG cần store method mới ⇒ KHÔNG đụng mattermostauthlayer.**
- Client: thêm method `getBlockHistory()` vào octoClient; UI `cardDetail/cardHistory.tsx` — dialog liệt kê version, diff tính client-side giữa 2 version liên tiếp (title, properties resolve tên template, contentOrder count).

**Verify:** jest cho `groupCardsTwoLevels` + util diff; API test kiểu `api/blocks_test` + app test (CI chạy 3 DB); set WIP/vượt limit, sub-group, kéo chéo lane+cột, xem history.

### ✅ Phase 7 — Dependencies + Timeline/Gantt (XL) — ĐÃ XONG, xem mục 4e để biết chi tiết thực tế đã làm + deviations (spec gốc giữ nguyên bên dưới để đối chiếu)

**7a. Card dependencies (tối giản — KHÔNG có relation property):**
- Lưu trên **card bị chặn**: `card.fields.blockedBy?: string[]` (mảng card ID cùng board, v1) — cưỡi JSON blocks, **không migration**, history miễn phí qua `blocks_history`, chạy cả 3 DB.
- Chiều ngược derive bằng selector `getCardDependencyMap(boardId)` trong `store/cards.ts` (memoized).
- Mutator `addCardDependency/removeCardDependency` với **check vòng (DFS trên map)** trước khi commit; lọc ID chết khi đọc.
- UI: section "Dependencies" trong card detail (`cardDetail/cardDependencies.tsx`): "Blocked by" (picker tìm card trong board) + "Blocks" (derived, read-only); badge "blocked" trên kanban/table card.

**7b. Timeline view — TỰ BUILD (đã cân nhắc, KHÔNG dùng lib):** FullCalendar v6 timeline là **premium/trả phí** (loại vì license); frappe-gantt/vis-timeline (loại: imperative, React fit kém). Codebase đã tự build table/kanban/gallery ⇒ timeline custom khớp pattern, tái dùng react-dnd v16 cho kéo/resize bar.
- `blocks/boardView.ts`: `IViewType` union += `'timeline'` (hiện có `'board'|'table'|'gallery'|'calendar'`); fields mới `timelineDatePropertyId?: string` (một date property — value đã hỗ trợ `{from,to}`), `timelineZoom?: 'day'|'week'|'month'|'quarter'`, `showDependencies?: boolean`.
- Thư mục mới `webapp/src/components/timeline/`: `timeline.tsx` (đăng ký vào switch render `centerPanel.tsx:~454-509` + menu add-view), `timelineRow.tsx` (bar 1 card; drag=dời ngày, edge-drag=resize → mutator set date property), `timelineHeader.tsx` (thang thời gian), `dependencyArrows.tsx` (SVG overlay blocker-end → blocked-start, đỏ khi blocked bắt đầu trước khi blocker kết thúc), `timelineUtils.ts` (toán date↔pixel trên dayjs).
- Swimlane tái dùng `groupCardsTwoLevels` (Phase 6). Card không có date property → khay "Unscheduled" (kéo vào để lên lịch). **Virtualize hàng bằng `react-window` từ đầu** (hàng cao cố định — dễ hơn kanban).
- **Rủi ro:** timezone/DST trong date↔pixel (date property lưu UTC ms — normalize tại biên util, test fixture DST); overlay mũi tên chỉ vẽ cho cặp hàng visible.

**Verify:** jest dày cho `timelineUtils` (các mức zoom, fixture DST) + cycle detection; tạo timeline view, kéo bar, resize, tạo dependency, thấy mũi tên, badge blocked. Server không đổi API/schema ⇒ chỉ chạy regression.

### ✅ Phase 8 — Automation rules engine (L/XL) — ĐÃ XONG, xem mục 4f để biết chi tiết thực tế đã làm + deviations (spec gốc giữ nguyên bên dưới để đối chiếu)

**Data — migration `000042_create_automation_rules` (+`000043_create_automation_runs` nếu đủ thời gian):**
- Bảng `{{.prefix}}automation_rules`: `id varchar(36) PK, board_id varchar(36) NOT NULL, name varchar(255), enabled boolean, trigger_type varchar(64), trigger_config JSON, actions JSON, created_by, modified_by, create_at/update_at/delete_at bigint`; index `(board_id)` qua `createIndexIfNeeded`. **Kiểu cột JSON phải theo đúng pattern per-DB của `blocks.fields`** (xem migration cũ để copy cú pháp JSON cho từng DB). `000043`: run log `id, rule_id, card_id, status, error, create_at`, index `(rule_id, create_at)`.

**Engine — cưỡi `notify.Backend` (KHÔNG sửa call site):**
- **Hook có sẵn:** mọi mutation block đi qua `server/app/blocks.go` → `blockChangeNotifier.Enqueue` → `notifyBlockChanged` (dòng ~309) tạo `notify.BlockChangeEvent{Action(add/update/delete), TeamID, Board, Card, BlockChanged, BlockOld, ModifiedBy}` fan-out tới danh sách `notify.Backend` (interface tại `server/services/notify/service.go:~34`: `Start/ShutDown/Name/BlockChanged(evt)`).
- Package mới `server/services/automation/`: `engine.go` implement `notify.Backend`, đăng ký trong `server/server/server.go` cạnh các backend hiện có (`notifysubscriptions`, `notifymentions`, `notifylogger`) → **giống hệt ở cả 2 run mode**.
- `matcher.go`: khớp `BlockChangeEvent` với rule của board (cache per-board, invalidate khi CRUD rule; v1 TTL 30s — ghi chú hạn chế multi-node). Trigger v1: `card-created`, `property-changed` (propertyId + from/to tuỳ chọn), `moved-to-group`, `checklist-completed`, `dependency-unblocked` (mọi card trong `blockedBy` đạt "done" — v1 "done" = property+value cấu hình trong trigger_config).
- `actions.go`: thực thi QUA tầng `app` (inject interface, mirror cách `notifysubscriptions` nhận params — tránh import cycle). Action v1: `set-property`, `move-to-group`, `add-comment` (template token `{{card.title}}`…), `notify-user`.
- **Chống loop (bắt buộc):** mutation của engine dùng bot userID riêng; event có `ModifiedBy == automationBotID` KHÔNG bao giờ match (cap 1 hop) + rate limit in-memory 10/phút/card/rule.
- **Store (nhớ 2 nơi):** `store.go` interface += `GetAutomationRules(boardID)`, `GetAutomationRule(id)`, `UpsertAutomationRule`, `DeleteAutomationRule` → implement `sqlstore/automation.go` **VÀ passthrough `mattermostauthlayer/mattermostauthlayer.go`**; chạy lại `make generate` (mockstore).
- API: `server/api/automation.go` — `GET/POST /api/v2/boards/{boardID}/automation/rules`, `PUT/DELETE .../rules/{ruleID}`; write cần `PermissionManageBoardProperties`, read cần `PermissionViewBoard`; swagger.
- Frontend: `webapp/src/components/automation/` (`ruleList.tsx` vào board settings/view-header menu, `ruleEditor.tsx` — trigger picker + action builder dùng property selector sẵn có); thêm method vào octoClient; slice `store/automationRules.ts`.

**Verify:** unit test matcher (table-driven trên fixture `BlockChangeEvent`) + loop protection; store test thêm vào `server/services/store/storetests/` (CI tự chạy 3 DB); integration: tạo rule qua API → mutate card → assert action áp + không re-trigger; 2 mode compile + test delegation mattermostauthlayer.

### ✅ Phase 9 — Formula property (M) — ĐÃ XONG, xem mục 4g để biết chi tiết thực tế đã làm + bug fix (spec gốc giữ nguyên bên dưới để đối chiếu)

- `blocks/board.ts` (dòng ~86) `PropertyTypeEnum` += `'formula'`; `IPropertyTemplate` += `formula?: string` (expression trên template, **evaluate per-card lúc render — không lưu giá trị, không đổi server, không migration**).
- `webapp/src/properties/formula/`: `property.ts` + `formula.tsx` (PropertyType subclass, đăng ký trong `properties/index.tsx`, hiển thị read-only), `lib/tokenizer.ts`, `lib/parser.ts` (Pratt parser tự viết — không thêm dep; grammar: literal number/string/bool, `+ - * / %`, so sánh, `and/or/not`, `if(c,a,b)`, `concat()`, `prop("Tên")`, `now()`, `dateAdd/dateBetween` (dayjs), `round/abs/min/max`, `length/contains`), `lib/evaluator.ts` memo theo `(card.id, card.updateAt, template.formula)`.
- Resolve tập trung: thêm hook `getCalculationValue(card, template, board)` trên `PropertyType` (`properties/types.tsx`) và route **5 điểm đọc** qua nó: `calculations.ts getCardProperty`, `cardFilter.ts`, `store/cards.ts sortCards`, `boardUtils.ts groupCardsByOptions`, `PropertyValueElement` ⇒ formula sort/filter/group như giá trị thật.
- Editor template: input formula + hiển thị lỗi parse inline trong menu setting property.
- **Rollup HOÃN** (documented): chưa có relation property type ⇒ làm sau khi có relation.
- **Rủi ro:** formula tham chiếu formula khác — cho phép lồng tối đa depth 4 + phát hiện vòng lúc đăng ký parse.

**Verify:** jest exhaustive tokenizer/parser/evaluator (gồm case lỗi); jest sort/filter/group với cột formula; server không đổi ⇒ chỉ regression.

---

## 6. NGOÀI PHẠM VI (chốt rõ — đừng làm)

- **Toàn bộ bảo mật:** rate-limit login, 2FA, account lockout.
- Relation property + rollup formula (chặn bởi relation chưa có).
- FullCalendar v6 / premium timeline (license).
- WebSocket subset-aware (giữ broadcast toàn board theo thiết kế).
- Kanban virtualization (hoãn từ Phase 5).
- Formula evaluate phía server, dependency đa-board, invalidate cache automation cluster-wide (follow-up).

---

## 7. NỢ KỸ THUẬT MỞ (cleanup khi tiện)

| Mục | Vị trí | Ghi chú |
|---|---|---|
| `@testing-library/user-event` kẹt ở v13 | `webapp/package.json` | Lên v14 cần viết lại async API ở ~64 file test |
| `skipLibCheck: true` bật tạm | `webapp/tsconfig.json` | react-day-picker đã v8 (bỏ `React.SFC`) — thử tắt xem còn lỗi lib không |
| `.npmrc` `legacy-peer-deps=true` | `webapp/.npmrc` | Thử xoá + `npm install --allow-remote=all` lại xem còn xung đột peer không |
| `@types/react-transition-group` pin `4.4.9`, override | `webapp/package.json` | React 17→18 compat, xem gỡ được chưa |
| `eslint-plugin-mattermost` dùng tarball URL | `webapp/package.json` | Do npm env chặn git deps; trên máy khác có thể đổi lại `github:` |
| `@emoji-mart/react` bị stub trong test | `webapp/package.json` moduleNameMapper + `src/test/emojiMartReactMock.tsx` | Picker thật không chạy được trong jsdom; test emoji chỉ kiểm tích hợp select→callback, không kiểm render emoji-mart |

---

## 8. FILE THEN CHỐT (tham chiếu nhanh)

- `server/app/blocks.go` — `notifyBlockChanged` (~309): hook cho Automation (Phase 8)
- `server/services/store/sqlstore/blocks.go` — `getBlocks` (~73-79): pagination + cần ORDER BY (Phase 5)
- `server/services/store/store.go` — interface: mọi method mới implement 2 nơi
- `server/services/notify/service.go` — `Backend` interface (~34): Automation cưỡi vào đây
- `webapp/src/blocks/boardView.ts` — `IViewType` + `BoardViewFields`: WIP/swimlane/timeline config
- `webapp/src/store/cards.ts` — selector refactor + dependency map + sort formula-aware
- `webapp/src/mutator.ts`, `webapp/src/octoClient.ts` — tách facade (Phase 5)
- `webapp/src/routeCompat.ts` — **compat router v5→v6 (mới, Phase 3)**: sửa route phải sync pattern list ở đây với `router.tsx`
- `webapp/src/dateHelpers.ts` — **helper dayjs (mới, Phase 3)**: mọi thao tác ngày dùng file này
- `webapp/src/components/markdownEditor/tiptapEditor.tsx` — **editor chính (mới, Phase 4)**: mọi consumer đi qua `markdownEditor.tsx` wrapper, không import trực tiếp file này
- `webapp/src/components/markdownEditor/markdownBridge.ts` — **markdown↔ProseMirror bridge tự viết (mới, Phase 4)**: KHÔNG dùng `tiptap-markdown` package (bug webpack/UMD — xem mục 4b); sửa node/mark mapping ở đây nếu thêm extension mới cho editor

---

## 9. QUY TRÌNH LÀM VIỆC ĐỀ XUẤT CHO MỖI PHASE

1. Đọc spec phase trong tài liệu này + plan gốc.
2. Làm production code trước, `npx tsc` cho đến khi sạch.
3. Sửa/thêm test, `npx jest` cho đến khi xanh (review kỹ snapshot diff).
4. `npx eslint` (lọc CRLF) + `npx webpack` phải sạch.
5. Nếu chạm server: `go build -tags 'json1 sqlite3' ./...` + `go test` SQLite; nhớ implement store method 2 nơi + `make generate`.
6. Commit với message chi tiết (theo style Phase 1/2). Cập nhật bảng tiến độ mục 2 của tài liệu này.
7. Sang phase kế.
