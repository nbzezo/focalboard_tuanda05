# Plan: Hiện đại hoá & mở rộng Focalboard (trừ hạng mục bảo mật)

## Context

Focalboard (repo này) đã ngừng bảo trì chính thức; đánh giá tổng thể cho thấy nền tảng cũ (Go 1.21, React 17, draft-js/react-beautiful-dnd/moment đã chết), hiệu năng board lớn kém (tải toàn bộ blocks một lần, không virtualize), và thiếu các tính năng nghiệp vụ chủ chốt (timeline/dependencies, automation, formula). Plan này triển khai **toàn bộ** các hạng mục nâng cấp + tính năng đã thống nhất, **ngoại trừ bảo mật** (rate-limit login, 2FA, lockout — user tự làm sau).

**Quyết định đã chốt với user:**
- Editor thay draft-js: **TipTap**
- Tính năng: đủ 4 nhóm — quick wins (WIP limit, swimlane, checklist progress, card history UI) + Timeline/Gantt + dependencies + Automation rules + Formula property
- DB: giữ đủ **SQLite + PostgreSQL + MySQL** (mọi migration/index/test phủ cả 3)
- **Cả 2 chế độ chạy phải xanh**: standalone server VÀ Mattermost plugin mode (`mattermostauthlayer`, `ws/plugin_adapter.go`, `notify/plugindelivery` giữ nguyên, compile + test pass). Mọi method mới trên interface `store.Store` phải implement ở **cả** `sqlstore` lẫn `mattermostauthlayer`.

**Sự thật nền đã xác minh (không cần khảo sát lại):**
- Migration hiện tại kết thúc ở `000040` → migration mới bắt đầu **000041**. Helper index đa-DB: `createIndexIfNeeded` (`server/services/store/sqlstore/migrate.go:284`).
- Pagination đã có sẵn "ống nước": `sqlstore/blocks.go` `getBlocks` áp `Offset/Limit` (dòng 73-79) nhưng caller không truyền; `model.QueryBlocksOptions` đã có `Page/PerPage` (`server/model/block.go:212`); **chưa có ORDER BY**; index blocks duy nhất là `(board_id, parent_id)`.
- Client mở board = 1 call `GET /api/v2/boards/{id}/blocks?all=true` (`octoClient.ts getAllBlocks:303` ← `store/initialLoad.ts loadBoardData:64` ← `boardPage.tsx:189,198`).
- Hook automation: mọi mutation đi qua `app/blocks.go` `blockChangeNotifier.Enqueue` → `notifyBlockChanged` (:309) tạo `notify.BlockChangeEvent{Action, Board, Card, BlockChanged, BlockOld, ModifiedBy}` fan-out tới danh sách `notify.Backend` (interface tại `services/notify/service.go:34`). Automation engine = một Backend mới, không sửa call site.
- History: mọi mutation đã ghi `blocks_history`; store có `GetBlockHistory` (+pagination sẵn); user-facing mới chỉ có undelete. Card-history UI = endpoint mới + client + UI, **không cần store method mới**.
- Dead deps webapp (0 tham chiếu): `fstream`, 6 gói `imagemin-*`, `image-webpack-loader` — xoá thẳng.
- draft-js surface: `markdownEditorInput.tsx` + 13 file `live-markdown-plugin/`; 4 consumer: `cardDetail/cardDetailContents.tsx`, `cardDetail/commentsList.tsx`, `content/textElement.tsx`, `viewTitle.tsx`. Định dạng lưu là **markdown text trong `block.title`** — giữ nguyên, không migrate data. `blocksEditor/` (cardDetail.tsx:319) vẫn uỷ quyền text cho MarkdownEditor.
- react-router v5: 41 file/148 chỗ; `FBRoute` tự viết ở `route.tsx`. react-beautiful-dnd: chỉ 3 file sidebar. moment: 5 file (+ react-day-picker v7 adapter). emoji-mart v3: 4 file + SCSS.
- mutator.ts (1224 dòng) / octoClient.ts (1091 dòng): singleton default export — tách module theo domain, re-export qua facade cũ để không sửa hàng trăm import site.
- View model `blocks/boardView.ts`: field view là JSON tự do (server không validate enum) → WIP limit/swimlane/timeline config nằm trong view fields, không cần migration.

---

## Thứ tự phase (mỗi phase kết thúc ở trạng thái ship được, cả 2 run mode xanh)

| # | Phase | Cỡ | Lý do đứng ở đây |
|---|-------|----|------------------|
| 1 | Vệ sinh tooling & deps | S | Nền zero-behavior-change; mọi thứ sau compile trên TS5/Go 1.22 |
| 2 | Cổng React 18 | L | TipTap/dnd mới nhắm React 18 — làm trước editor để chỉ build 1 lần |
| 3 | Hiện đại hoá thư viện (router v6, dnd, dayjs, emoji-mart 5) | L | Độc lập với editor, chạy song song được với P4 |
| 4 | Editor draft-js → TipTap | L | Sau P2; độc lập với P3 |
| 5 | Hiệu năng & cấu trúc (pagination, lazy load, selectors, virtualize, tách god-file) | L | Trước feature lớn — swimlane/timeline nhân chi phí render; tách file cho feature có chỗ ở sạch |
| 6 | Quick wins: WIP limit, swimlane, checklist progress, card history | M | Tạo util grouping 2 cấp (timeline dùng lại) + history API |
| 7 | Dependencies + Timeline/Gantt view | XL | Cần P5 perf + P6 grouping; dependencies làm trước trong phase vì Gantt vẽ nó |
| 8 | Automation rules engine | L/XL | Sau P6/P7 để trigger tham chiếu được dependency/checklist; cưỡi `notify.Backend` |
| 9 | Formula property | M | Cô lập hoàn toàn trong PropertyType registry; không gì phụ thuộc nó |

---

## Phase 1 — Vệ sinh tooling & dependencies (S)

- `webapp/package.json`: xoá `fstream`, 6 `imagemin-*`, `image-webpack-loader`; `npm dedupe`, sinh lại lockfile.
- TypeScript 4.6 → 5.x + bump `@typescript-eslint/*`; sửa lỗi strict mới (chủ yếu `catch (e: unknown)`, lib.dom). Giữ `jsx: "react"` (đổi ở P2).
- `server/go.mod`: `go 1.21` → **1.22** (dừng ở 1.22 cho tới khi rủi ro modernc/libc được gỡ); `mattn/go-sqlite3 v2.0.3+incompatible` → `v1.14.22` (tag v2 là lỗi upstream). Giữ build tags `json1 sqlite3`.
- Pin version golangci-lint trong `Makefile`; `.golangci.yml`: thay `exportloopref` (deprecated) → `copyloopvar`.
- Rủi ro: khác biệt CGO mattn v1.14 trên Windows; TS5 lộ lỗi type tiềm ẩn ở `webapp/src/blocks/*`.
- **Verify**: `make server-lint`; `make server-test` (đủ 4 target sqlite/mysql/mariadb/postgres qua docker); `make webapp-ci`; `go build -tags 'json1 sqlite3' ./...` trong `server/` (phủ mattermostauthlayer + plugin_adapter); boot server, mở board, sửa card.

## Phase 2 — Cổng React 18 (L)

- Bump: `react`/`react-dom` 18.2, `react-intl` 5→6, `react-redux` 7→8, `@testing-library/react` 11→14, jest 27→29 (thêm dep `jest-environment-jsdom`, đổi timer API), Cypress 9→13 (`cypress.json` → `cypress.config.ts`).
- `ReactDOM.render` → `createRoot`: `webapp/src/main.tsx:42` và `webapp/src/components/blocksEditor/devmain.tsx:110`.
- tsconfig: `jsx: "react"` → `"react-jsx"`.
- Sửa fallout StrictMode double-invoke (đặc biệt WS subscribe/unsubscribe trong `pages/boardPage/boardPage.tsx` — làm effect idempotent, không tắt StrictMode).
- Rủi ro: react-redux 8 đổi timing re-render với selector lớn ở `store/cards.ts`; migration fake-timer jest 29 chạm nhiều test.
- **Verify**: `make webapp-ci`; full Cypress; manual: CRUD board, card dialog, comments, calendar, share dialog; cả 2 mode compile.

## Phase 3 — Hiện đại hoá thư viện (L)

1. **react-router v5→v6** (1 PR duy nhất — v5/v6 không sống chung): viết lại `FBRoute` (`route.tsx`) theo `<Route element>`; `useHistory`→`useNavigate`, `Switch`→`Routes`, `Redirect`→`<Navigate>`; 41 file.
2. **react-beautiful-dnd → `@hello-pangea/dnd`** (fork drop-in, React-18-safe): 3 file `components/sidebar/{sidebar,sidebarCategory,sidebarBoardItem}.tsx`.
3. **react-dnd 14→16**: ~12 file + `hooks/sortable.tsx` (API ổn định, đổi import path/generic).
4. **moment → dayjs** (plugin relativeTime/duration/localeData): `utils.ts` (fromNow), `properties/date/date.tsx` + `components/viewHeader/dateFilter.tsx` (locale, longDateFormat), `components/calculations/calculations.ts` (humanize). **Cùng PR**: nâng react-day-picker v7 → v9 (adapter moment chết theo), viết lại 2 call site picker.
5. **emoji-mart 3→5**: `main.tsx` (bỏ `store.setHandlers`, dùng `data`/`init` v5), `widgets/emojiPicker.tsx`, migrate key localStorage trong `userSettings.ts` (đọc key cũ 1 lần, ghi key mới), cập nhật SCSS `.emoji-mart-*`.
- Rủi ro: các trang có guard (login/permalink board) regress âm thầm — phủ bằng Cypress nav spec; picker mới đổi a11y bàn phím.
- **Verify**: jest + Cypress full; manual matrix: deep-link card URL, đổi team, sửa date property với locale không-US, emoji recents còn giữ.

## Phase 4 — Editor: draft-js → TipTap (L)

- Component mới `webapp/src/components/markdownEditor/tiptapEditor.tsx` giữ **nguyên props contract** của `MarkdownEditor` hiện tại (`onChange(text)`, `onFocus/onBlur`, `saveOnEnter`, initial text) → 4 consumer gần như không đổi.
- Extension: StarterKit + `tiptap-markdown` (round-trip markdown ↔ doc; **markdown trong `block.title` vẫn là định dạng lưu — không migrate data**).
- Mentions: TipTap `Mention` extension, suggestion gọi `octoClient.searchTeamUsers`; giữ flow xác nhận thêm board-member như plugin cũ.
- Emoji: extension gợi ý `:emoji:` dùng chung dataset emoji-mart v5 (P3).
- Key bindings giữ nguyên hành vi: Escape=blur, Backspace-khi-rỗng=cancel, Enter=save khi `saveOnEnter`.
- Live-markdown decorator (hiện `**bold**` có style) thay bằng WYSIWYG native của TipTap — chấp nhận đổi UX, không rebuild decorator.
- `blocksEditor/` chỉ đổi text block sang editor mới, interface giữ nguyên.
- Xoá: `draft-js`, `@draft-js-plugins/*`, `components/live-markdown-plugin/` (13 file), `markdownEditorInput.tsx` cũ.
- Rủi ro: fidelity round-trip markdown (bảng, list lồng, HTML thô) — tạo corpus fixture từ nội dung card thật TRƯỚC khi chuyển; IME/composition; paste từ Word.
- **Verify**: jest mới `markdownRoundtrip.test.ts` (parse→serialize idempotent trên corpus); Cypress: tạo card, gõ mention, emoji, comment nhiều dòng, refresh, kiểm tra persist; check bundle size sau `make webapp`.

## Phase 5 — Hiệu năng & cấu trúc (L)

**5a. Server pagination — migration `000041_blocks_pagination_index`:**
- Index mới `{{.prefix}}blocks (board_id, id)` qua helper `createIndexIfNeeded` (phủ cả 3 DB); down migration drop index.
- `sqlstore/blocks.go` `getBlocks`: thêm `ORDER BY board_id, id` (luôn thêm — vô hại); dùng `opts.Page/PerPage` sẵn có.
- `api/blocks.go` `handleGetBlocks`: parse query `page`, `per_page` → `QueryBlocksOptions`; cập nhật `server/swagger/swagger.yml`.

**5b. Webapp windowed load:**
- Bước 1 (trong suốt): `octoClient.getAllBlocks` loop từng trang 500 tới trang ngắn; `loadBoardData` dispatch blocks tăng dần.
- Bước 2 (defer contents): load đầu chỉ fetch blocks `type=view`, `type=card`, **và `type=checkbox`** (call thứ 3 — bắt buộc vì `cardBadges.tsx` đếm checkbox từ content blocks); content/comment của card fetch khi mở card dialog (`cardDetail.tsx` mount effect, `GET /boards/{id}/blocks?parent_id={cardID}&all=true`).
- WS **giữ broadcast toàn board** (không làm subset-aware): reducer đã upsert block bất kỳ, block chưa hold tới qua WS thì cứ lưu — rẻ.

**5c. Redux + render perf:**
- `store/cards.ts`: tách memo filter+search+sort thành chuỗi `createSelector` (filtered → searched → sorted) theo view; memoize `getCurrentBoardCards`; `CardBadges` dùng `createCachedSelector` (re-reselect) key theo cardId.
- `components/table/tableRows.tsx`: bỏ pattern `key={card.id+card.updateAt}` (key theo `card.id`, memo `TableRow`); bọc table body không-group bằng `react-window` `VariableSizeList` (giữ trong `ColumnResizeProvider`). **Kanban virtualization hoãn** (phức tạp dnd-ref — ghi vào out-of-scope).

**5d. Tách god-file (không đổi import site):** `mutator.ts` → `webapp/src/mutators/{blocks,boards,members,properties,views,cards,categories,subscriptions,userConfig}.ts` re-export qua singleton facade cũ; tương tự `octoClient.ts` → `webapp/src/octoClient/*.ts`.

- Rủi ro: ORDER BY đổi thứ tự ngầm (client sort theo `cardOrder`/`contentOrder` nên an toàn — vẫn audit reducer); lazy contents vỡ badge nếu thiếu checkbox blocks (đã xử lý bằng call thứ 3).
- **Verify**: `make server-test` đủ DB (migration up/down 2 chiều cả 3 engine); seed board 1.000 card bằng script API (để trong scratchpad) rồi Cypress + manual: mở board lớn, scroll table, mở card, sửa live từ browser thứ 2 (WS).

## Phase 6 — Quick wins (M)

**6a. WIP limit cột kanban:** `blocks/boardView.ts` `BoardViewFields` += `columnWipLimits?: Record<optionId, number>` (default `{}` trong `createBoardView()`; view fields là JSON — không cần migration/server change). UI ở `kanbanColumnHeader.tsx`: hiện `count/limit`, style đỏ khi vượt, menu "Set WIP limit…"; mutator mới `changeViewColumnWipLimit` trong `mutators/views.ts`. V1 chỉ cảnh báo hình ảnh (soft).

**6b. Swimlane (grouping cấp 2):** `BoardViewFields` += `swimlaneById?: string`, `collapsedSwimlanes?: string[]`. Menu "Sub-group by" trong `viewHeader/viewHeaderGroupByMenu.tsx`. Util mới `groupCardsTwoLevels(cards, groupByTpl, swimlaneTpl): Swimlane[]` trong `boardUtils.ts` (+ memo cạnh `centerPanel.tsx:384`). `kanban.tsx` (285-324): khi có swimlane, render hàng ngoài chứa dải cột hiện tại; drop handler set **cả 2** property.

**6c. Checklist progress:** không cần block type mới — nhóm các `checkbox` content blocks. Component mới `cardDetail/checklistProgress.tsx`: progress bar (tái dùng logic đếm của `cardBadges.tsx`) trên card contents; badge % trên kanban card từ data badge sẵn có.

**6d. Card history UI:**
- Server: handler mới `handleGetBlockHistory` trong `api/blocks.go` — `GET /api/v2/boards/{boardID}/blocks/{blockID}/history?page=&per_page=`, cưỡi `store.GetBlockHistory` sẵn có (pagination sẵn); permission `PermissionViewBoard`; đăng ký trong `registerBlocksRoutes` (`api/api.go:92`); swagger. **Không method store mới → không đụng mattermostauthlayer.**
- Client: `octoClient/blocks.ts` `getBlockHistory()`; UI `cardDetail/cardHistory.tsx` — dialog liệt kê version, diff tính client-side giữa 2 version liên tiếp (title, properties resolve tên template, contentOrder count).
- Rủi ro: DnD 2 cấp edge case (drop lên lane đang collapse); history payload lớn — dựa per_page=25.
- **Verify**: jest cho `groupCardsTwoLevels` + util diff; API test kiểu `api/blocks_test` + app test chạy đủ DB; Cypress: set WIP, vượt limit, sub-group, kéo chéo lane+cột, xem history; 2 mode compile.

## Phase 7 — Dependencies + Timeline/Gantt (XL)

**7a. Dependencies (tối giản, không có relation property):**
- Lưu trên **card bị chặn**: `card.fields.blockedBy?: string[]` (cùng board, v1) — cưỡi JSON blocks, **không migration**, history miễn phí qua `blocks_history`, chạy cả 3 DB.
- Chiều ngược derive bằng selector `getCardDependencyMap(boardId)` trong `store/cards.ts` (memoized).
- Mutator `addCardDependency/removeCardDependency` (`mutators/cards.ts`) với check vòng (DFS trên map memo) trước khi commit; lọc ID chết khi đọc.
- UI: section "Dependencies" trong card detail (`cardDetail/cardDependencies.tsx`): "Blocked by" (picker tìm card trong board) + "Blocks" (derived, read-only); badge "blocked" trên kanban/table card.

**7b. Timeline view — TỰ BUILD (đã cân nhắc):** FullCalendar v6 timeline là premium (loại vì license); frappe-gantt/vis-timeline (loại: imperative, React fit kém, stale wrapper). Codebase đã tự build table/kanban/gallery — timeline custom khớp pattern, tái dùng react-dnd v16 cho kéo/resize bar.
- `blocks/boardView.ts`: `IViewType` += `'timeline'`; fields mới `timelineDatePropertyId?: string` (date property — format value đã hỗ trợ `{from,to}`), `timelineZoom?: 'day'|'week'|'month'|'quarter'`, `showDependencies?: boolean`.
- Thư mục mới `webapp/src/components/timeline/`: `timeline.tsx` (đăng ký vào switch `centerPanel.tsx:454-509` + menu add-view), `timelineRow.tsx` (bar 1 card; drag=dời ngày, edge-drag=resize → mutator set date property), `timelineHeader.tsx` (thang thời gian), `dependencyArrows.tsx` (SVG overlay blocker-end → blocked-start, đỏ khi blocked bắt đầu trước khi blocker kết thúc), `timelineUtils.ts` (toán date↔pixel trên dayjs).
- Swimlane tái dùng `groupCardsTwoLevels` (P6). Card không có date property → khay "Unscheduled" (kéo vào timeline để lên lịch). Virtualize hàng bằng `react-window` từ đầu (hàng cao cố định — dễ hơn kanban).
- Rủi ro: timezone/DST trong date↔pixel (date property lưu UTC ms — normalize tại biên util, test fixture DST); overlay mũi tên vs hàng virtualized (chỉ vẽ cho cặp hàng visible).
- **Verify**: jest dày cho `timelineUtils` (các mức zoom, fixture DST) + cycle detection; Cypress: tạo timeline view, kéo bar, resize, tạo dependency, thấy mũi tên, badge blocked; server không đổi API/schema → chỉ chạy regression `make server-test`.

## Phase 8 — Automation rules engine (L/XL)

**Data — migration `000042_create_automation_rules` (+`000043_create_automation_runs` nếu đủ thời gian):**
- Bảng `{{.prefix}}automation_rules`: `id varchar(36) PK, board_id varchar(36) NOT NULL, name varchar(255), enabled boolean, trigger_type varchar(64), trigger_config JSON, actions JSON, created_by, modified_by, create_at/update_at/delete_at bigint`; index `(board_id)` qua `createIndexIfNeeded`; kiểu cột JSON theo đúng pattern per-DB của `blocks.fields`. `000043`: run log `id, rule_id, card_id, status, error, create_at`, index `(rule_id, create_at)`.

**Engine — cưỡi `notify.Backend`:**
- Package mới `server/services/automation/`: `engine.go` implement Backend (`Start/ShutDown/Name/BlockChanged(evt)` — `services/notify/service.go:34`), đăng ký trong `server/server/server.go` cạnh các backend hiện có → **giống hệt nhau ở cả 2 run mode**.
- `matcher.go`: khớp `BlockChangeEvent` với rule của board (cache per-board, invalidate khi CRUD rule; v1 TTL 30s — ghi chú hạn chế multi-node). Trigger v1: `card-created`, `property-changed` (propertyId + from/to tuỳ chọn), `moved-to-group`, `checklist-completed`, `dependency-unblocked` (mọi card trong `blockedBy` đạt "done" — v1 "done" = property+value cấu hình trong trigger_config).
- `actions.go`: thực thi QUA tầng `app` (inject interface, mirror cách `notifysubscriptions` nhận backend params — tránh import cycle). Action v1: `set-property`, `move-to-group`, `add-comment` (template token `{{card.title}}`…), `notify-user` (tái dùng đường notification/webhook sẵn).
- **Chống loop**: mutation của engine dùng bot userID riêng; event có `ModifiedBy == automationBotID` không bao giờ match (cap 1 hop) + rate limit in-memory 10/phút/card/rule.
- Store: `store.go` interface += `GetAutomationRules(boardID)`, `GetAutomationRule(id)`, `UpsertAutomationRule`, `DeleteAutomationRule` → implement `sqlstore/automation.go` **VÀ passthrough `mattermostauthlayer`**; chạy lại `make generate` (mockstore).
- API: `server/api/automation.go` — `GET/POST /api/v2/boards/{boardID}/automation/rules`, `PUT/DELETE .../rules/{ruleID}`; write cần `PermissionManageBoardProperties`, read cần `PermissionViewBoard`; swagger.
- Frontend: `webapp/src/components/automation/` (`ruleList.tsx` vào board settings/view-header menu, `ruleEditor.tsx` — trigger picker + action builder dùng property selector sẵn có); `octoClient/automation.ts`; slice `store/automationRules.ts`.
- Rủi ro: mutation engine đua với user (đi chung đường mutation `app` nên thứ tự `blockChangeNotifier` được giữ); cache staleness multi-node (đã ghi chú TTL).
- **Verify**: unit test matcher (table-driven trên fixture BlockChangeEvent) + loop protection; store test thêm vào `storetests/` suite (tự chạy đủ 4 DB target); integration: tạo rule qua API → mutate card → assert action áp + không re-trigger; Cypress flow rule editor; 2 mode compile + test delegation mattermostauthlayer.

## Phase 9 — Formula property (M)

- `blocks/board.ts:86` `PropertyTypeEnum` += `'formula'`; `IPropertyTemplate` += `formula?: string` (expression trên template, **evaluate per-card lúc render — không lưu giá trị, không đổi server, không migration**).
- `webapp/src/properties/formula/`: `property.ts` + `formula.tsx` (PropertyType subclass, đăng ký trong `properties/index.tsx`, hiển thị read-only), `lib/tokenizer.ts`, `lib/parser.ts` (Pratt parser tự viết — không thêm dep; grammar: literal number/string/bool, `+ - * / %`, so sánh, `and/or/not`, `if(c,a,b)`, `concat()`, `prop("Tên")`, `now()`, `dateAdd/dateBetween` (dayjs), `round/abs/min/max`, `length/contains`), `lib/evaluator.ts` memo theo `(card.id, card.updateAt, template.formula)`.
- Resolve giá trị tập trung: thêm hook `getCalculationValue(card, template, board)` trên `PropertyType` (`properties/types.tsx`) và route 5 điểm đọc qua nó: `calculations.ts getCardProperty`, `cardFilter.ts`, `store/cards.ts sortCards`, `boardUtils.ts groupCardsByOptions`, `PropertyValueElement` → formula sort/filter/group như giá trị thật.
- Editor template: input formula + hiển thị lỗi parse inline trong menu setting property.
- Rủi ro: formula tham chiếu formula khác — cho phép lồng tối đa depth 4 + phát hiện vòng lúc đăng ký parse.
- **Verify**: jest exhaustive tokenizer/parser/evaluator (gồm case lỗi); jest sort/filter/group với cột formula; Cypress: tạo formula property, thấy giá trị tính, group theo nó; server không đổi → regression `make server-test`.

---

## Ngoài phạm vi (chốt rõ)

- **Toàn bộ bảo mật**: rate-limit login, 2FA, account lockout (user làm sau).
- Relation property + rollup formula (chặn bởi relation chưa có — làm sau khi có relation).
- FullCalendar v6 / premium timeline (license).
- WebSocket subset-aware (giữ broadcast toàn board theo thiết kế).
- Kanban virtualization (hoãn từ P5; mở lại nếu profiling đòi hỏi).
- Formula evaluate phía server, dependency đa-board, invalidate cache automation cluster-wide (follow-up).

## Verification tổng (chạy cuối mỗi phase)

1. `make server-lint` && `make server-test` (4 DB target qua docker) — trong `server/`: `go build -tags 'json1 sqlite3' ./...`
2. `make webapp-ci` (eslint + stylelint + jest) và Cypress (`npm run cypress:ci`)
3. Boot standalone: `make prebuild && make && ./bin/focalboard-server` → smoke test board/card/comment/view switching
4. Plugin mode: compile + test pass cho `mattermostauthlayer`, `ws/plugin_adapter`, `notify/plugindelivery` (mỗi khi store interface đổi phải có passthrough tương ứng)

## File then chốt

- `server/app/blocks.go` (:309 `notifyBlockChanged` — hook automation)
- `server/services/store/sqlstore/blocks.go` (:73-79 pagination + ORDER BY)
- `server/services/store/store.go` (interface — mọi method mới phải implement 2 nơi)
- `webapp/src/blocks/boardView.ts` (viewType union + fields WIP/swimlane/timeline)
- `webapp/src/components/markdownEditorInput.tsx` (bề mặt draft-js cần thay)
- `webapp/src/store/cards.ts` (refactor selector + dependency map + sort formula-aware)
- `webapp/src/mutator.ts`, `webapp/src/octoClient.ts` (tách facade)
