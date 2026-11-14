---
title: Sandbox / Trang thử nhà cung cấp (chỉ dev)
route: /workspaces/<ws>/sandbox
area: sandbox
---
# Sandbox, trang thử nhà cung cấp (chỉ môi trường dev)

Block `SandboxPanes` (components/blocks/SandboxPanes, container `index.tsx` + pure `component.tsx`), view model `hooks/sandbox/useSandboxView.ts`, the cards are composites `SandboxAccountsCard`, `SandboxCasesCard`, `SandboxCallsCard`, `SandboxKeyCard`, `SandboxWaitingCard`, `SandboxOpenDrawer`. Drawing approved by the owner (R66, "as shown"); rulings R56, R58, R59, R60, R62, R66; concept `.starciwork/concepts/provider-sandbox.md`. Source written 2026-11-14 and type-checked + linted only: NOT visually verified, no shots yet (`1440.png`, `390.png` to be taken by the screenshot check).

## Dev và production
Vì sao: the sandbox exists only where the dev switch `PROVIDER_SANDBOX_ENABLED` is on. The page asks `providerSandbox { enabled }` once. The navigation entry "Sandbox" (group Cài đặt, owner and manager only) is in the rail ONLY while that answers `true` (`DESTINATIONS` `sandboxOnly`, read in `useConsoleNav`); in production (answer `false`, or the read failing) there is no entry. The direct URL in production draws ONE neutral notice block: title "Sandbox chỉ có ở môi trường dev" (14, weight), line 12 muted "Ở đây không tạo được tài khoản sandbox và không nhận webhook sandbox."; no control, and the header band carries the title alone (no sublabel, no create button). A staff member who types the URL gets the neutral "Trang này dành cho chủ sở hữu và quản lý" notice (the back end refuses every op for staff). A failed switch read is the failure alert with its retry.
Luật: `type-scale-14-12`, `red-budget-links-foreground` (nothing red in the notice), `unhandled-case-tells-customer` (the failure is said in place).
Grammar: `SurfaceCard` body with `ariaLabel`, `EmptyNotice`, `Alert`.

## Đầu trang (header band)
Vì sao: white chrome. Title "Sandbox", sublabel 12 muted "Tài khoản thử, dữ liệu cố định, không gọi ra ngoài", and on the right the ONE primary CTA of the page "Tạo tài khoản sandbox": the only button on the page with an icon (`startGlyph="plus"`), red as the page's one main CTA. It opens a Drawer (a short form: pick the provider, name the account), not a page. While the switch is still being asked the CTA is disabled (the chrome keeps its real words).
Luật: `red-budget-links-foreground`, `page-header-left-sublabel-xs` (only primary CTA buttons have icons), `complex-content-page-not-drawer` (a short form is a drawer).
Grammar: `Page measure="full"` header `actions`, `Button intent="commit" startGlyph`, `Drawer`, `Form`, `SurfaceCard kind="select"` (the provider as a single choice with the checkbox look), `Input`.

## Giếng hồng và các khối trắng
Vì sao: chrome is white, only the middle well is pink, and the blocks are separate white cards on it (no card in a card). Layout: the `main-rail` grid with the rail at the START (compact, the same rail as /contacts) holding "Tài khoản"; the open account's blocks in the main column in this order: "Ca thử", "Sổ lời gọi", "Khoá webhook"; then the full-width block "Run đang chờ" under both. A phone shows the accounts first, then the open account's blocks, then the waiting runs (`collapsedOrder="rail-first"`).
Luật: `pink-page-surface-rule`, `nivo-surface-layering`, `drawings-obey-grammar-laws`.
Grammar: `Grid kind="main-rail"`, `Stack gap="section"`, `SurfaceCard`.

## 1. "Tài khoản" (rail trái)
Vì sao: the sandbox accounts of the workspace grouped by provider (`sandboxAccounts`): one card, one section per provider named by the provider (its label from the app's provider catalogue, the code name when the app has none), each row = the provider's mark (`ProviderLogo`), the account's display name and a plain `Badge` "Sandbox" (a label, not a status: no dot). The open row is the surface-secondary fill (the list's selected state, no check mark); the first account is open until the person picks another, and a new account opens at once. The count chip is shown with the label. No account at all: the card says "Chưa có tài khoản sandbox" with the way to make one, and the right column is not drawn.
Luật: `badge-dot-or-not`, `row-padding`, `type-scale-14-12`.
Grammar: `SurfaceCard` body + `ListBox sections` (single selection, indicator none), `Badge`, branch `ProviderLogo`.

## 2a. "Ca thử"
Vì sao: the provider's hardcoded cases (`sandboxCases(provider)`), one row each: the label (14) over the case id (12 muted: "SEPAY-2"; an outbound case also says what it answers: "INET-2 · renew"), and the row's one command at the end: a neutral `Button` sm, no icon. INBOUND cases: "Gửi" (`sendSandboxCase`), and the inputs the cases take (SePay: "Nội dung", "Số tiền"; Zalo: "userId", "text") stand in the block's HEADER zone as small inputs, prefilled from `sandboxLatestRequest` (the newest request the agent asked the account for) and editable, with the 12 muted line "Yêu cầu gần nhất: <values>"; an input left empty is not sent (the back end prefills it, else the case's own example, which is also the placeholder). OUTBOUND cases (the account can answer a call more than one way): "Chọn" (`setSandboxNextCase`); the header zone names the current next case per operation (12 muted, "Ca kế tiếp của renew: INET-1"), the row that will answer wears a plain Badge "Kế tiếp" and its button is disabled, the default case wears a plain Badge "Mặc định". Sticky until changed; choosing the default goes back to success. The list is a `SurfaceCard kind="list"` (not the select card): the rows are commands with their own side effect, and a select card has no per-row command; the select card is used only for the provider choice in the drawer.
Luật: `surfacecard-zones-api` (inputs and the muted lines are a `custom` header zone, never loose lines), `red-budget-links-foreground` (every row button is neutral sm), `row-padding` (controls included), `type-scale-14-12`.
Grammar: `SurfaceCard kind="list"` with `headers: [{ kind: "custom" }]`, `ListRowData action actionPlacement="end" badges`, `Input size="sm"`, `Text size="xs" tone="muted"`.

## 2b. "Sổ lời gọi"
Vì sao: the account's call log (`sandboxCalls`, at most 500, the back end answers oldest first and the page turns it newest first), ten at a time with "Xem thêm" (a `more` footer zone). A row: what was called or sent (the operation; a webhook sent through the page is "Gửi webhook vào"), and the muted 12 line: the case id (a send carries it in its request) or the call's key, the time, and, when the call threw, a plain Badge "Lỗi" and the reason. "Xoá sổ" (`resetSandboxAccount`) is a neutral `Button` sm in a custom footer zone and asks first in a Grammar `AlertDialog` (neutral tone: it clears the log and the account's state, the next case goes back to the default; the dialog's confirm button is the one red on screen only while it is open). The log is read again every 8 s so what the agents do meanwhile shows.
Luật: `row-padding`, `red-budget-links-foreground`, `type-scale-14-12`.
Grammar: `SurfaceCard kind="list"` with `footers: [{ kind: "more" }, { kind: "custom" }]`, `AlertDialog`.

## 2c. "Khoá webhook"
Vì sao: for tests that call the provider's webhook themselves the account's sandbox key (`sandboxKey`; the back end derives it, stores nothing) is needed. DECISION: the key is NEVER drawn until the owner presses "Hiện khoá": the row shows dots; "Hiện khoá" / "Ẩn khoá" toggles it, and the neutral "Sao chép" copies it without showing it. The key is read into the page's memory for the copy button only. The muted 12 line says where it goes (header `x-nivo-sandbox-key`). The provider's webhook PATH is not in the API (see the gap below), so the line names the header, not the path.
Luật: `red-budget-links-foreground`, `type-scale-14-12`.
Grammar: `SurfaceCard kind="list"` with `ListRowData action` + `control` (a neutral `Button` sm).

## 2d. "Agent đang dùng" (R4, FE-SANDBOX-2; not visually verified)
Vì sao: an account is only useful to the agents it is attached to, so the right column opens with them. One `SurfaceCard kind="list"` row per agent of `SandboxAccount.agents`: the agent's name (14), a plain `Badge` "Mặc định" (no dot: a label, not a live status) only where the agent holds several accounts of this provider and this one is its default (`providerRights.attachments.isDefault`), a neutral `Button` sm "Đặt mặc định" (`setAgentProviderDefault`) on the other accounts of such an agent, and at the end a neutral `Button` sm "Gỡ". "Gỡ" never acts at once: the Grammar `AlertDialog` asks first ("Gỡ agent khỏi tài khoản?", `detachSandboxAccount`: the grant is unbound and the attachment removed; the account's trigger switches stay on). The footer zone holds "Gắn agent" (neutral Button sm), which opens a drawer: a `kind="select"` multiple choice list (HeroUI Checkbox rows) of the agents not yet attached, one commit "Gắn" (`attachSandboxAccount` per agent in turn). The rail row of an account carries a 12 muted line with the agents it is attached to ("Chatbot, Sales", or "Chưa gắn cho agent nào").
Luật: `surfacecard-select-subtitle` (one choice-list pattern), `red-budget-links-foreground` (no red but the drawer's commit), `row-padding`, `type-scale-14-12`, `badge-dot-or-not`.
Grammar: `SurfaceCard kind="list"` with `ListRowData badges action control actionPlacement="end"`, `footers: [{ kind: "custom" }]`, `AlertDialog`, `Drawer`, `SurfaceCard kind="select" selectionMode="multiple"`, `ListBox` item `description`.

## Drawer "Tạo tài khoản sandbox": giao cho agent
Vì sao: `openSandboxAccount.attachTo`: below the provider list and the name, a second choice list "Giao cho agent" (multiple, all agents of the workspace); the chosen agents get the account attached, bound and its triggers on in the one call (all or nothing). Left out while the workspace has no agent.
Luật: `surfacecard-select-subtitle`.

## 3. "Run đang chờ" (full width)
Vì sao: R66: "not paid" is time, so the page ends a wait on purpose. `sandboxWaitingRuns` (bounded, newest first): a row = "<agent> · <người hoặc tuyến>" (14) over "<chờ gì> · còn <thời gian>" (12 muted; "Chờ nhắn tin · còn 5 phút", "đã tới hạn" once the time has come; the time is counted again every 15 s), and a neutral `Button` sm "Hết hạn ngay" (`expireSandboxWait`, the real deadline road). After a press the list is read again: the run may wait again on its next round, or be gone. Empty: "Không có run nào đang chờ." Refreshed every 8 s.
Luật: `row-padding`, `red-budget-links-foreground`, `type-scale-14-12`.
Grammar: `SurfaceCard kind="list"` with `ListRowData action actionPlacement="end"`.

## Thông báo
Vì sao: success in plain words ("Đã gửi ca SEPAY-2", "Đã chọn ca … làm ca kế tiếp", "Đã cho hết hạn chờ", "Đã xoá sổ lời gọi", "Đã tạo tài khoản sandbox", "Đã sao chép khoá"); a typed refusal (`PROVIDER_SANDBOX_OFF`, `_RUN_NOT_WAITING`, `_INPUT_INVALID` …) is shown with the message the back end sent in the reader's language, never the raw code (`useGraphQLWithToast`). A send whose webhook answered 4xx/5xx still succeeded as a call: a warning toast names the status and the path.
Luật: `unhandled-case-tells-customer`.

## Đang tải, rỗng, lỗi
Vì sao: the chrome (title, sublabel, CTA) is real text from the first paint; every block draws its own skeleton (rows of the real shape; inputs and lines appear when the data does) and has its own empty ("Nhà cung cấp này chưa có ca thử.", "Chưa có lời gọi nào.", "Không có run nào đang chờ.") and its own failure notice inside the card with a retry (a failed cases read does not hide the log).
Luật: `page-loading-own-shape`.
Grammar: `SurfaceCard isLoading` / `error`, geometry from placeholder rows.
