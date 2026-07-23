# Focalboard Modernization — Tài liệu bàn giao (Handoff)

> **Mục đích:** Tài liệu này để bàn giao cho một agent/dev khác (DeepSeek) tiếp tục công việc hiện đại hoá & mở rộng Focalboard. Nó tự chứa (self-contained) — đọc xong là làm tiếp được mà không cần lịch sử hội thoại.
>
> **Ngày cập nhật:** 2026-07-24
> **Branch:** `claude/project-quality-assessment-41e971` (git worktree)
> **Plan gốc (9 phase):** đã copy vào repo tại `docs/modernization/PLAN-9-phases.md` (tự chứa, không phụ thuộc file ngoài).

---

## ⭐ BẮT ĐẦU TỪ ĐÂY (kickoff cho DeepSeek)

**Bước 0 — Xác nhận baseline (chạy trước khi làm gì):**
```bash
git log --oneline -4
# Phải thấy 3 commit: "Phase 3: library modernization...", "Phase 2: React 18 gate",
# "Phase 1: tooling & dependency hygiene". Đây là baseline XANH đã verify.
```
Phase 1–3 đã xong và commit. **Việc tiếp theo là Phase 4** (mục 5 bên dưới). Đọc theo thứ tự: mục 0 (quy tắc vàng) → mục 1 (môi trường) → mục 5 Phase 4.

**Prompt mẫu để khởi động DeepSeek** (dán nguyên văn):
> Bạn tiếp nhận dự án hiện đại hoá Focalboard. Đọc `MODERNIZATION-HANDOFF.md` ở gốc repo TRƯỚC TIÊN, đặc biệt mục 0 (quy tắc vàng — KHÔNG làm bảo mật, giữ 2 run mode + 3 DB), mục 1 (môi trường build + lệnh verify), và mục 5 Phase 4. Chạy `git log --oneline -4` xác nhận baseline (Phase 1–3 đã commit xanh). Sau đó triển khai **Phase 4 (draft-js → TipTap)** theo spec, giữ mỗi phase kết thúc ở trạng thái compile+test xanh rồi mới commit. Không sửa file test/snapshot theo kiểu update bừa — đọc "Bài học test" ở mục 4.

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
| **4** | Editor draft-js → **TipTap** | ⬜ Chưa làm | — |
| **5** | Hiệu năng & cấu trúc (pagination, lazy load, selectors, virtualize table, tách god-file) | ⬜ Chưa làm | — |
| **6** | Quick wins (WIP limit, swimlane, checklist progress, card history UI) | ⬜ Chưa làm | — |
| **7** | Dependencies + Timeline/Gantt view | ⬜ Chưa làm | — |
| **8** | Automation rules engine | ⬜ Chưa làm | — |
| **9** | Formula property | ⬜ Chưa làm | — |

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

## 5. CÁC PHASE CHƯA LÀM — SPEC CHI TIẾT

> Nguồn đầy đủ hơn: `docs/modernization/PLAN-9-phases.md` (trong repo). Dưới đây là bản rút gọn đủ để thực thi.

### ⬜ Phase 4 — Editor: draft-js → TipTap (L)

**Mục tiêu:** Thay `markdownEditorInput.tsx` + thư mục `components/live-markdown-plugin/` (13 file) bằng TipTap. **Định dạng lưu vẫn là markdown text trong `block.title` — KHÔNG migrate data.**

- Component mới `webapp/src/components/markdownEditor/tiptapEditor.tsx` **giữ nguyên props contract** của `MarkdownEditor` hiện tại (`onChange(text)`, `onFocus/onBlur`, `saveOnEnter`, initial text) ⇒ 4 consumer gần như không đổi: `cardDetail/cardDetailContents.tsx`, `cardDetail/commentsList.tsx`, `content/textElement.tsx`, `viewTitle.tsx`.
- Deps: `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-mention`, và `tiptap-markdown` (hoặc `prosemirror-markdown`) để round-trip markdown ↔ doc.
- **Mentions:** TipTap `Mention` extension, suggestion gọi `octoClient.searchTeamUsers`; giữ flow xác nhận thêm board-member như plugin draft-js cũ.
- **Emoji:** extension gợi ý `:emoji:` dùng chung dataset `@emoji-mart/data` (đã có từ Phase 3).
- **Key bindings giữ nguyên hành vi:** Escape=blur, Backspace-khi-rỗng=cancel, Enter=save (khi `saveOnEnter`).
- Live-markdown decorator (hiện `**bold**` có style inline) thay bằng WYSIWYG native của TipTap — chấp nhận đổi UX, không rebuild decorator.
- `components/blocksEditor/` (dùng ở `cardDetail.tsx:319`) chỉ đổi text block sang editor mới, interface giữ nguyên.
- **Xoá:** `draft-js`, `@draft-js-plugins/*`, `components/live-markdown-plugin/` (13 file), `markdownEditorInput.tsx` cũ. Trong test còn `jest.mock('draft-js/lib/generateRandomKey', ...)` — gỡ theo.
- **Rủi ro:** fidelity round-trip markdown (bảng, list lồng, HTML thô) — **tạo corpus fixture từ nội dung card thật TRƯỚC khi chuyển**; IME/composition; paste từ Word.
- **Verify:** jest mới `markdownRoundtrip.test.ts` (parse→serialize idempotent trên corpus); tạo card, gõ mention/emoji/comment nhiều dòng, refresh, kiểm tra persist; `npx webpack` kiểm bundle size không phình bất thường.

### ⬜ Phase 5 — Hiệu năng & cấu trúc (L)

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

### ⬜ Phase 6 — Quick wins (M)

**6a. WIP limit cột kanban:** `blocks/boardView.ts` `BoardViewFields` += `columnWipLimits?: Record<optionId, number>` (default `{}` trong `createBoardView()`). View fields là JSON tự do ⇒ **không cần migration/server change**. UI ở `kanbanColumnHeader.tsx`: hiện `count/limit`, style đỏ khi vượt, menu "Set WIP limit…"; mutator mới `changeViewColumnWipLimit`. V1 chỉ cảnh báo hình ảnh (soft).

**6b. Swimlane (grouping cấp 2):** `BoardViewFields` += `swimlaneById?: string`, `collapsedSwimlanes?: string[]`. Menu "Sub-group by" trong `viewHeader/viewHeaderGroupByMenu.tsx`. Util mới `groupCardsTwoLevels(cards, groupByTpl, swimlaneTpl): Swimlane[]` trong `boardUtils.ts` (+ memo cạnh `centerPanel.tsx:~384`). `kanban.tsx` (~285-324): khi có swimlane, render hàng ngoài chứa dải cột hiện tại; drop handler set **cả 2** property. *(Util này Phase 7 timeline dùng lại.)*

**6c. Checklist progress:** không cần block type mới — nhóm các `checkbox` content blocks sẵn có. Component mới `cardDetail/checklistProgress.tsx`: progress bar (tái dùng logic đếm của `cardBadges.tsx`) trên card contents; badge % trên kanban card từ data badge sẵn có.

**6d. Card history UI:**
- Server: handler mới `handleGetBlockHistory` trong `api/blocks.go` — `GET /api/v2/boards/{boardID}/blocks/{blockID}/history?page=&per_page=`, cưỡi `store.GetBlockHistory` **sẵn có** (đã có pagination); permission `PermissionViewBoard`; đăng ký trong `registerBlocksRoutes` (`api/api.go:~92`); swagger. **KHÔNG cần store method mới ⇒ KHÔNG đụng mattermostauthlayer.**
- Client: thêm method `getBlockHistory()` vào octoClient; UI `cardDetail/cardHistory.tsx` — dialog liệt kê version, diff tính client-side giữa 2 version liên tiếp (title, properties resolve tên template, contentOrder count).

**Verify:** jest cho `groupCardsTwoLevels` + util diff; API test kiểu `api/blocks_test` + app test (CI chạy 3 DB); set WIP/vượt limit, sub-group, kéo chéo lane+cột, xem history.

### ⬜ Phase 7 — Dependencies + Timeline/Gantt (XL)

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

### ⬜ Phase 8 — Automation rules engine (L/XL)

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

### ⬜ Phase 9 — Formula property (M)

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

---

## 9. QUY TRÌNH LÀM VIỆC ĐỀ XUẤT CHO MỖI PHASE

1. Đọc spec phase trong tài liệu này + plan gốc.
2. Làm production code trước, `npx tsc` cho đến khi sạch.
3. Sửa/thêm test, `npx jest` cho đến khi xanh (review kỹ snapshot diff).
4. `npx eslint` (lọc CRLF) + `npx webpack` phải sạch.
5. Nếu chạm server: `go build -tags 'json1 sqlite3' ./...` + `go test` SQLite; nhớ implement store method 2 nơi + `make generate`.
6. Commit với message chi tiết (theo style Phase 1/2). Cập nhật bảng tiến độ mục 2 của tài liệu này.
7. Sang phase kế.
