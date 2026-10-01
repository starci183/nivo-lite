# NIVO Prototype UI Rulebook (apps/prototype)

Sources: nivo-fe `apps/app` (layout, providers, globals, GroupChatPage, AgentOSModuleIntake), `packages/ui` (@nivo/ui),
`@starci/grammar@0.5.0` dist, nivo-backend `.starciwork/brand/index.yaml` (rev 1, owner-accepted 2026-09-21) and
`.starciwork/shell/index.yaml`, StarCi `knowledge/ui/**` and `ops/interface.draw.yaml` / `interface.implement.yaml`.

---

## A. Setup (mirror apps/app exactly)

**package.json** (`apps/prototype/package.json`, name `@nivo/prototype`):
```json
"scripts": { "dev": "next dev -p 3068", "build": "next build --webpack", "lint": "eslint", "typecheck": "tsc --noEmit" },
"dependencies": {
  "@heroui/react": "^3.2.6", "@heroui/styles": "^3.2.6", "@nivo/ui": "*",
  "@starci/grammar": "^0.5.0", "framer-motion": "^13.1.0", "next": "16.1.6",
  "next-intl": "^4.13.5", "next-themes": "^0.4.6", "react": "19.2.3", "react-dom": "19.2.3"
},
"devDependencies": { "@tailwindcss/postcss": "^4", "tailwindcss": "^4", "typescript": "^5", "eslint": "^9",
  "@types/node": "^20", "@types/react": "^19", "@types/react-dom": "^19" }
```
- GOTCHA: root-hoisted `node_modules/@starci/grammar` is **0.4.11**; apps/app and packages/ui each get a nested **0.5.0**.
  Declare `^0.5.0` so npm nests 0.5.0 under `apps/prototype/node_modules`. Verify after `npm install` from repo root.
- Port 3067 is apps/app; pick another (3068).

**next.config.ts** (copy of apps/app minus what you don't use):
```ts
const nextConfig: NextConfig = {
  outputFileTracingRoot: resolve(import.meta.dirname, "../.."),
  transpilePackages: ["@nivo/ui", "@starci/grammar"],   // @nivo/ui ships TS source
  turbopack: { root: resolve(import.meta.dirname, "../..") },
  experimental: { optimizePackageImports: ["@heroui/react"], rootParams: true },
  webpack: (config) => { config.resolve.symlinks = false; return config },
}
export default createNextIntlPlugin("./src/modules/i18n/request.ts")(nextConfig) // only if using next-intl
```
**postcss.config.mjs**: `export default { plugins: { "@tailwindcss/postcss": {} } }` (Tailwind v4, no tailwind.config file).
**tsconfig.json**: `extends: "../../tsconfig.json"`, `plugins: [{ name: "next" }]`, `paths: { "@/*": ["./src/*"] }`.

**src/app/globals.css** — ORDER MATTERS, copy verbatim:
```css
@import "@nivo/ui/styles.css";
@import "tailwindcss";
@import "@heroui/styles/css";          /* semantic utilities bg-surface, text-muted... resolve to nothing without it */
@import "@starci/grammar/common.css";
@import "@nivo/ui/family.css";         /* the ONLY owner of --nivo-* values */
@source "../../../../packages/ui/src";            /* Tailwind must scan @nivo/ui source */
@source "../../node_modules/@starci/grammar/dist"; /* app-level nested grammar, NOT root copy */
@custom-variant dark (&:where(.dark, .dark *));
.starci-dashboard-theme { min-height: 100dvh; background: var(--background); color: var(--foreground);
  font-family: var(--font-open-sans), var(--nivo-font-console); }
.starci-dashboard-theme .button--icon-only { display:inline-flex; align-items:center; justify-content:center; padding:0; }
.starci-dashboard-theme .button--icon-only > [data-slot="icon"] { display:block; flex:none; }
body { background: var(--background); color: var(--foreground); font-family: var(--nivo-font-interface); }
```
NEVER import `@starci/grammar/core.css` (brand-forbidden; paints StarCi purple).

**Fonts**: only Open Sans via `next/font/google`, `Open_Sans({ subsets: ["latin", "vietnamese"] })`, exposed as CSS var on body:
`<body className="min-h-dvh bg-background text-foreground antialiased" style={{ "--font-open-sans": openSans.style.fontFamily } as CSSProperties}>`.
No other webfont may be added.

**Provider stack** (client boundary, `"use client"`), exactly apps/app `ConsoleProviders`:
```tsx
<NextIntlClientProvider locale={locale} messages={messages} timeZone={timeZone}>
  <I18nProvider locale={locale}>                       {/* from @heroui/react */}
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>   {/* next-themes */}
      <NivoGrammarTheme>{children}</NivoGrammarTheme>
```
`NivoGrammarTheme` = `<NivoGrammarRoot theme={theme}>` from `@nivo/ui`, where theme stays `"system"` until after
hydration (useEffect flag), then `resolvedTheme` "light"/"dark" (copy apps/app `features/layouts/NivoGrammarTheme`).
`<html lang={locale} suppressHydrationWarning>`. Locales: `vi` (default + fallback) and `en`; `localePrefix: "as-needed"`.

**Assets**: copy `apps/app/public/images/nivo-unicorn-overview.png` into `apps/prototype/public/images/` —
`NivoUnicornArtwork` hardcodes `src="/images/nivo-unicorn-overview.png"`.

---

## B. Brand tokens and logo

Never write a colour. Use semantic Tailwind/HeroUI classes (`bg-background`, `bg-surface`, `text-foreground`,
`text-muted`, `border-separator`) or component tone props. Literals live only in `packages/ui/src/leaves/NivoGrammar/nivo.css`.

| Token | Light | sRGB | Role |
|---|---|---|---|
| `--nivo-accent` (= `--focus`, `--nivo-danger`) | oklch(57% 0.24 25) | #e3001f unicorn red | primary, focus ring, danger |
| `--nivo-accent-foreground` | oklch(100% 0 0) | #ffffff | text on accent |
| `--nivo-brand-ink` | oklch(16% 0.035 255) | #040d1c | wordmark ink |
| `--nivo-canvas` | oklch(97.02% .0015 354) | #f6f5f5 | page canvas (HeroUI `--background`) |
| `--nivo-surface` | oklch(100% ...) | #ffffff | cards |
| `--nivo-surface-secondary` / `-tertiary` | 95.24% / 93.73% | #f0efef / #ebeaea | nested surfaces |
| `--nivo-default` | oklch(94% ...) | #ecebeb | neutral control + secondary Input fill |
| `--nivo-foreground` | oklch(21.03% ...) | #191818 | body text |
| `--nivo-muted` | oklch(53% .003 354) | #6d6b6c | secondary text (4.5:1) |
| `--nivo-success` | oklch(73.29% .1941 162.85) | #00cc84 | settled success |
| `--nivo-warning` | oklch(78.19% .159 84.37) | #e7ae0a | attention |
| `--nivo-info` | oklch(72% .17 250) | #40a9ff | info |
| `--nivo-border` / `--nivo-separator` | 90% / 92% | #dfddde / #e5e4e4 | outline / hairline |

Dark: canvas 12%, surface 21.03%, foreground 99.11%, muted 70.5%; accent unchanged. Radii: `--nivo-surface-radius`
1.5rem, `--nivo-control-radius` .5rem, `--nivo-field-radius` .75rem. Motion: 150ms `cubic-bezier(0.4,0,0.2,1)` only;
nothing loops; reduced-motion collapses to 0.

**Primary == danger (same red)**: destructive meaning must never be colour-only — use consequence words, an
`AlertDialog` confirmation and the danger glyph; destructive actions live in a `DropdownMenu`.

**Typography** (never write size/weight/leading classes; use Grammar props): FONT-1 xs (meta) · FONT-2 sm (timestamps,
facts) · FONT-3 base (body, section heading) · FONT-4 xl (the one page title) · FONT-5 3xl (`Text size="metric-lead"`)
· FONT-6 4xl (`Heading scale="display"`, max once). Weight: normal / medium / semibold only. One `level={1}` per page.

**Logo**: there is NO logo file. Render `<NivoBrand props={{ label: "nivo", variant: "lockup", scale: "navbar" }} />`
(32px tall) or `scale: "hero"` (80px); below navbar size use `variant: "mark"`. Never redraw, never generate, never
use `apps/app/src/app/icon.svg` (#e5194b is recorded drift).
**Mascot**: `<NivoUnicornArtwork props={{}} />` (180x120 min, decorative). Masters:
`nivo-backend/.starciwork/brand/assets/mascot/nivo-unicorn-responsibility-transparent-v13.png` (style master) and
`.../nivo-unicorn-overview.png` (console, = `apps/app/public/images/nivo-unicorn-overview.png`). Allowed only in an
empty state / first-run welcome, max once per screen. Forbidden in errors, loading, approval, forms, chrome, rows.
Direction references: `.../brand/assets/direction/{list,detail,form}-{desktop,mobile}.png` + `.html`.
**Icons**: Heroicons only, via the registry: `nivoIconSource(name, usage)` / `<NivoIcon props={{ name }} />`
(names: overview, apps, agentos, wallet, sidebar, send, pending, review, account, complete, retry, close, next, search,
notification, support...). No lucide/react-icons/emoji. Avatars: `@nivo/ui` `Avatar` (DiceBear from name) or Grammar
`Avatar name=...` — never generated faces.
**Voice**: vi default. Plain operational sentences, one idea each. System nouns stay English: AgentOS, Workspace,
Office, Tasks, Module, Owner/Manager/Staff. No "!", no emoji, no "magic/effortless/revolutionary/oops".

---

## C. Shell geometry (console, measured at 1440x900 and 390x844)

| | Desktop 1440 | Mobile 390 |
|---|---|---|
| Top bar (`NavigationFeatureNav`) | full width, 79px | part of 135px chrome band |
| Sidebar (`Sidebar presentation="rail"`) | 280px wide, left, `navigationVisibility="wide"` | hidden; `Sidebar presentation="drawer"` in `DrawerBranch` |
| Page slot | x=280 y=79, **1160x821** | x=0 y=135, **390x644** |
| Page inline inset | 32px | 16px |

Build it the apps/app way (`ConsoleLayout`), all from packages:
```tsx
<StarCiDashboardThemeBoundary content={Frame} contentProps={...} />   // @nivo/ui, adds .starci-dashboard-theme
// Frame:
<>
  <NavigationFeatureNav identity={<><NivoBrand props={{label, variant:"lockup", scale:"navbar"}}/><Text weight="semibold">{contextLabel}</Text></>}
    compactNavigationTrigger={null} compactNavigationTriggerLabel="" actionsLabel={t("actions")}
    actions={<ThemeSwitch props={{ isDark, label }} on={{ change: toggleTheme }} />} />
  <WorkspaceShell align="stretch" navigation={<Sidebar .../>} navigationLabel={...} navigationTrack="intrinsic"
    navigationVisibility="wide" compactNavigation={<MobileSidebar/>} compactNavigationLabel={...}
    primary={children} primaryLabel={...} />
</>
```
Sidebar groups (from shell tree): `workspace`: overview (Tổng quan), chat (Trò chuyện), agentos (AgentOS),
apps (Ứng dụng); `account`: wallet (Ví). Toggle glyph `nivoIconSource("sidebar","leading")`. Demo persona: workspace
**Support**, user **An Nguyen**, currency VND, date `24 thg 9, 2026`.

Inside the slot: `<PageContainer measure="product">` for lists/detail, `measure="reading"` for single-column states,
`measure="full"` for the Office workbench. Detail pages: `PrimaryRailLayout primary={...} rail={...} railWidth="standard"`.

---

## D. Grammar cheat-sheet — `import { X } from "@starci/grammar/common"`

Layout: `PageContainer measure="reading|product|full"` · `PrimaryRailLayout primary rail railWidth="compact|standard|wide" align collapsedOrder="primary-first"` ·
`WorkspaceShell` (above) · `ChatWorkspace label conversation conversationLabel composer header? rail? railLabel railOpenLabel railCloseLabel isRailOpen onRailOpenChange` ·
`Rail label children footer mode="sticky" width` · `VerticalScrollRegion` / `HorizontalScrollRegion` · `SurfaceCopyGroup density`.

Text: `Heading level={1..4} scale="standard|display" isSkeleton` · `Text as="p|span|div" size="xs|sm|md|metric-lead" tone="default|muted|accent" weight="normal|medium|semibold" overflow="wrap|truncate|clamp-2" live="polite|assertive" isSkeleton` ·
`SectionHeader level title description eyebrow action composition="section-header|context-intro"` · `Label`.

Surfaces: `SurfaceCard label? ariaLabel? fact labelEnd depth="top|nested" state={PresentationState} wholeAction={{kind:"link",href,label}|{kind:"button",press,label}} frame="bounded|frameless" composition="single|joined" isHighlight` ·
`SurfaceListCard label|ariaLabel fact labelEnd footer isLoading empty={<EmptyNotice/>}>rows</SurfaceListCard>` ·
`SurfaceAccordionCard` · `StaticStateRow item={{id,label,description,state,verdict}}` · `DescriptionList items={[{id,term,description}]} layout="columns|stacked" isDivided`.

Actions: `Button variant="primary|secondary|tertiary|outline|ghost" size="sm|md|lg" width="content|fill" isPending isDisabled isSkeleton startContent` + EITHER `onPress` OR `href` (never both) ·
`IconButton source label onPress` · `TextAction` · `ButtonGroup` · `DropdownMenu trigger entries onAction` · `AlertDialog title description tone confirmLabel cancelLabel onConfirm isConfirmPending`.

Status: `Badge tone="neutral|accent|success|warning|danger" isSkeleton` · `StateMark state` ·
`Alert title description tone={PresentationState} action={{label,onAction}} urgency` · `Meter label value maxValue valueLabel` · `Progress` · `Skeleton shape="text|rect|circle" lines` · `EmptyNotice message description iconSource actionLabel onAction isActionPending actionVariant`.
PresentationState = `neutral|informative|affirmative|cautionary|negative|pending|unavailable`.

Forms: `Form onSubmit isPending` · `Fieldset legend` · `Field label description errorMessage isInvalid` ·
`Input id name label kind="text|email|password|code" variant="secondary" hint errorMessage isError onValueChange` ·
`Textarea label rows onValueChange` · `Select label options={[{id,label}]} value onValueChange` · `Checkbox` · `Switch` · `RadioGroup` · `SegmentedControl` · `SearchField` · `OtpInput`.

Navigation/other: `Tabs label selectedKey items={[{id,label}]} onSelect inset="none" labelVisibility="always"` · `Sidebar` · `Breadcrumbs` · `Stepper steps currentStepId` · `Timeline items` · `Avatar name size isCurrent` · `AvatarGroup` · `IconTile source tone="neutral" size` · `Icon source usage="heading|leading|chip"` · `Tooltip` · `Dialog` · `Drawer` · `Popover` · `Toaster`.

`@nivo/ui` (import `from "@nivo/ui"`; props are `{ props: {...}, on?: {...}, isLoading? }`):
`NivoGrammarRoot`, `NivoBrand`, `NivoUnicornArtwork`, `NivoIcon`, `nivoIconSource`, `ThemeSwitch`, `Avatar`, `TileIcon`,
`Breadcrumbs` (`props={{mode:"back",label,backLabel}} on={{back}}`), `SlotView`/`toSlot`/`Slot`/`SlotLabels`,
`LifecycleStep`, `TaskProgressRow`, `ActivityRow`, `StatRow`, `StatusActionCard`, `RequestSummary`, `ProfileRow`,
`DrawerBranch`, `ModalBranch`, `DropdownBranch`, `CollapsibleRail`, `ScrollViewport`, `SurfaceFormCard`,
`StarCiDashboardThemeBoundary`, `SelectionList`, `SearchBox`, `ReactionPicker`, `QuickActionsList`.

Server components: `@starci/grammar/common` is a `"use client"` barrel — never pass a glyph FUNCTION from a server
component; pass an `IconName` to `NivoIcon` instead.

---

## E. Composition, layers, measure, rubric

1. **Grammar-only (DNA only).** Every visible element is a Grammar Common / @nivo/ui component. A need no component
   meets = write it down as a "grammar proposal" gap; never hand-build (no hand-made notice box, bar, dot, badge).
   Notice = `Alert`; ratio = `Meter`; status dot = `Badge`; empty = `EmptyNotice`.
2. **Layers.** Page Background (`--background` grey canvas) → Surface (`SurfaceCard`, white, borderless, soft shadow,
   surface radius) → content. No brand-tinted canvas. No card inside a card (use `depth="nested"`/`composition="joined"`
   bands). Every form control on a Surface uses `variant="secondary"` (default-fill, borderless). A form region always
   sits in a Surface, never on bare canvas.
3. **Measure.** Page width = slot + `PageContainer measure`. A form / single-task region is capped (form measure
   28rem compact, 30rem console form; never wider than 48rem). Never stretch a form across the column.
4. **Collections.** 3+ entities = a section with its own heading (`SectionHeader` / `SurfaceListCard label fact`), NOT
   a card wrapping cards. One card = one item. Count is plain Text, not a Badge.
5. **Hierarchy (HIERARCHY-6).** Per page: exactly 1 focal point (the page's one job), 2-3 secondaries, rest background.
   Carry rank by size, then weight, then space; colour last. Must survive the squint test.
6. **Reduce (DISCIPLINE-1).** Each element has a job or is cut. Max **3 bands per card**, max **2 Badges per entity**
   (state first, then one exception), max 1 supporting + 1 meta line under a title.
7. **Colour budget (ACCENT-6).** ~90% neutral; accent <10% and only on: the one primary action, focus, current
   selection, a verified measurement, one brand moment. Status tones only for real, authority-reported states —
   never on a category, person, module, count or identity tile (tiles are `tone="neutral"`).
8. **CTA.** Exactly one filled `primary` Button per view; row actions `outline`/`ghost`; submit is the last control of
   its form. Destination = `href`, command = `onPress`. Touch targets >= 40px (44px on mobile forms).
9. **Spacing scale** (whole rungs only): inline 8px (gap-2) · row 12px (gap-3) · peer 16px (gap-4) · region 24px (gap-6)
   · page inset 32px desktop / 16px mobile. No `gap-2.5`, no `p-[13px]`.
10. **Responsive.** Same DOM order at 1440 and 390; rail follows primary on mobile; no horizontal page scroll;
    primary action reachable in the lower half on mobile.

**Rubric** (brand.direction gates + draw loop thresholds; beauty target >= 8/10):
- LH1/DH1/FH1: one heaviest element (page title / entity name / form task heading).
- LB1/DB1/FB1: canvas `--background`, white borderless cards, accent < 10%, mascot absent from operational regions.
- LA1/FA1: one filled primary; others outline/ghost/TextAction.
- LT/DT: every status/metric has a source and read time; failed read marks facts stale and offers retry.
- LC1/FC1: every visible label Vietnamese from the catalog; no raw id, slug, enum, route or dev term.
- LM1/DM1/FM1: 390px — same order, no horizontal scroll, action reachable.
- TASTE-13 gates: focal point, no meaningless void, colour economy, imagery earns its place, reference class
  (enterprise ops console).

---

## F. Required states per screen

Loading/empty/error/forbidden are **data statuses, not separate designs** — render them via `SlotView` / component props:
| State | How |
|---|---|
| Loading (first read) | Same layout, content components get `isSkeleton` (Text, Heading, Badge, Button, IconTile, Input) or `SurfaceListCard isLoading`; `SlotView` passes `placeholder` + `isSkeleton=true`. No lone spinner, no mascot, no layout jump. |
| Empty | `EmptyNotice message description actionLabel onAction` inside the region (title + 1 line + the action that ends emptiness). Mascot allowed here only (max once). Filtered-empty keeps filters visible. |
| Error (read failed) | `EmptyNotice message actionLabel="Thử lại" onAction={retry}` or `Alert tone="negative" action={{label:"Thử lại",onAction}}` inside the failed region, never replacing the whole page; say facts are stale. |
| Forbidden / denied | `EmptyNotice message` or a `SurfaceCard` with explanation + secondary "Về Tổng quan". |
| Pending command | `isPending` on the initiating Button only (`EmptyNotice isActionPending`); peers get no progress cue. |
| Uncertain write | Keep prior state and say it could not be confirmed (e.g. approval "Chưa xác nhận được quyết định — giữ nguyên trạng thái chờ."). |
| Field refusal | message under the field (`errorMessage`/`isError`); request-level = one live `Text live="polite"` line above submit or `Alert` in the surface. No toast, no top error list. |
Absent branches are unmounted (omit the prop), never hidden.

---

## G. Do / Don't

DO: compose Grammar + @nivo/ui; semantic tokens only; copy from `src/messages/{vi,en}.json`; `isSkeleton` for
loading; `EmptyNotice`/`Alert` for states; `variant="secondary"` inputs on surfaces; one primary Button; neutral
IconTiles; className strings in a colocated `classNames.ts` built with `cn("flex", "gap-4", ...)` (one token per arg,
`cn` imported from `@heroui/react` there only); connected `index.tsx` + pure `component.tsx` (`XBase`) split.

DON'T:
- inline `className="..."` strings in JSX, `style={{}}` for layout, or raw `<div>`s that fake cards/badges/notices
  (plain layout `<div className={IMPORTED_CONST}>` wrappers are the only allowed raw elements);
- raw colours (`#hex`, `bg-[#..]`, `text-red-500`), arbitrary lengths (`w-[312px]`), fractional steps (`gap-2.5`);
- size/weight/leading classes on text, `<h1>`-`<h6>` tags (use `Heading`), `text-xl font-bold` headings;
- `@starci/grammar/core.css`, a second `--nivo-*` declaration, a second webfont, a second icon library, emoji;
- a card wrapping a list of cards, card-in-card, >3 bands per card, >2 badges per entity, >1 filled button;
- status colour as decoration; red destructive button next to primary; mascot on error/loading/approval/form/chrome;
- placeholder as label; fake success before the server confirms; invented metrics or ratios without a source;
- `function` declarations (use arrow consts), `handleX` (use `onX`), `T[]` (use `Array<T>`/`ReadonlyArray<T>`),
  inline param object types, `as unknown as`, `className` props on house components, `eslint-disable` comments.

---

## H. UX vocabulary to mirror (from apps/app `console.groupChat` and `console.agentos.modules`)

**Office (group chat)** — route `/chat`, nav "Trò chuyện". Page title "Office"; description "Trao đổi, phối hợp và cập nhật
công việc của Workspace." Peer `Tabs` (`inset="none"`, `labelVisibility="always"`): **Office | Tasks**.
Layout: `PageContainer measure="full"` → workbench (tabs band, header band `SectionHeader level={2}` "Workspace
Support" + description, then `ChatWorkspace conversation composer`) + right `aside` members rail (compact: a
"{n} thành viên" chip opening a bottom member sheet).
- Members rail "Thành viên trong Workspace": groups "Con người ({n})" and "Module đã thuê ({n})"; roles Owner /
  Manager / Staff; invited = `Badge tone="warning"` "Lời mời đang chờ"; module descriptions (Sales: "Hỗ trợ kinh
  doanh và chăm sóc khách hàng", Accounting, Chatbot). Invite form (Owner/Manager only): Email + Vai trò + "Gửi lời mời".
- Conversation items: `message` (author, `@sales` address token), `task-card`, `approval-card`, `question-card`.
- Task card: `SurfaceCard composition="joined" depth="nested"`; band 1 = statement (Text semibold) + status Badge +
  receipt Badge ("Module đã báo cáo"/"Chưa có báo cáo"/"Module từ chối"); band 2 = muted "T-AB12 • Sales •
  Người yêu cầu: X • Người được giao: Y".
- Task statuses → tone: Mới tạo (neutral), Đang làm (accent), Chờ thông tin / Chờ phê duyệt (warning), Hoàn thành
  (success), Bị từ chối / Đã hủy (danger).
- Approval card: above card `Badge tone="danger"` "Cần phê duyệt" + pending glyph + muted "Đang chờ quyết định";
  bands: review glyph + action (semibold) · consequence line · account glyph + "T-xxxx • Module · Người yêu cầu" with
  muted "Chỉ Owner hoặc Manager được quyết định"; actions: `Button primary width="fill"` "Phê duyệt" +
  `Button outline width="fill"` "Từ chối". Settled: "{name} đã quyết định lúc {at}".
- Question card: `Badge warning` "Đang chờ {name} trả lời" + `Button secondary sm` "Trả lời".
- Notices band `SurfaceCard label="Cần bạn xử lý"` rows with `Button secondary sm` "Mở"; states Đã xử lý / Không còn khả dụng.
- Composer: label "Tin nhắn", placeholder "Nhập tin nhắn…", send "Gửi"; failure "Tin nhắn chưa chắc đã được ghi.
  Kiểm tra rồi gửi lại." + "Kiểm tra và gửi lại"; answering banner "Đang trả lời {module}: {excerpt}" + "Hủy trả lời".
- Tasks tab: `SurfaceListCard label="Công việc trong Office" fact="{n} công việc"`; filters Người / Mô-đun / Trạng thái
  (Tất cả) with hint "Bộ lọc chỉ thay đổi danh sách hiển thị."; rows: statement, status Badge, asker/assignee, `Button
  ghost sm` "Mở trong Office"; empty "Không có công việc nào khớp bộ lọc."
- Page states: loading "Đang tải Office…" (live polite), failed `EmptyNotice` + "Thử lại", denied card "Office không khả
  dụng" + "Về Tổng quan".

**Module create / intake** — route `/agentos/workspaces/[id]/modules/create`. Header: `Breadcrumbs mode="back"`
"Quay lại module"; `TileIcon icon="agentos"` + eyebrow `Text size="sm" tone="accent" weight="semibold"` "Câu hỏi gợi mở
thích ứng" + `Heading level={1} scale="display"` "Tạo module tùy chỉnh" + muted description. Body = two SurfaceCards
side by side: (1) form: `Heading level={2}` "Module này cần giúp đội ngũ làm gì?", muted line, `Input variant="secondary"`
label "Mục tiêu module", note "Chưa lưu gì cho tới khi bắt đầu trả lời câu hỏi.", `Button primary` "Bắt đầu trả lời câu
hỏi" (disabled < 3 chars; refusal "Nivo chưa thể bắt đầu phiên hỏi đáp này." under field); (2) guide: `Heading level={3}`
"Cách hỏi đáp hoạt động", numbered steps (Mô tả kết quả cần đạt / Chỉ trả lời phần còn thiếu / Duyệt đúng một phiên bản
trước khi xuất bản), muted note. Then goes to `/modules/studio/[moduleId]`.

---

## I. Lint / guard gotchas for a new app in this monorepo

1. **ESLint canon auto-applies** to `apps/*/src/**/*.{ts,tsx}` (`starciFeConfig({layout:"monorepo"})`): ~50
   `starci-fe/*` rules, all `error`, `noInlineConfig: true` (eslint-disable does nothing). Plus type-aware
   rules (`consistent-type-imports`, `array-type: generic`, `no-floating-promises`, `switch-exhaustiveness-check`),
   react-hooks and jsx-a11y errors. Key ones: `require-export-jsdoc` (every export gets a `/** */`),
   `no-second-language-in-source` (Vietnamese only in `src/messages/*.json`, `src/resources/`, `fixtures/`,
   `*.fixture.ts`, specs, or a `// vn-ok: <reason>` line), `no-emoji-in-source`, `prefer-arrow-export`,
   `handler-on-prefix`, `public-component-signature` (one param `props: XProps`), `no-inline-parameter-type`,
   `route-tree-holds-routes-only` (`src/app/**` = page/layout/loading/error/not-found only),
   `vendor-primitive-has-named-owner` (HeroUI imports only in a leaf/branch or `classNames.ts`),
   `no-direct-heroicon-import`, `no-arbitrary-value`, `no-fractional-step`, `no-hand-rolled-heading`,
   `no-heading-tag-outside-heading-component`, `no-internal-starci-href`, `presentational-purity` +
   `connected-block-has-presentational-twin` (component.tsx takes resolved props: no hooks, no fetch, no `t()`).
   The className rules (`no-inline-class-name`, `class-names-in-colocated-file`, no className props) bite only under
   `src/components/**`; apps/app puts screens in `src/features/{pages,layouts}/<Name>/` — follow the same tree.
2. **`npm run lint:architecture`** (scripts/check-fe-architecture.mjs) walks ALL of `apps/` and `packages/`: any
   `component.tsx` must not have `"use client"` or use useState/useEffect/useContext; raw `fetch` only in
   `src/modules/api/`; blocks may not import pages.
3. **Coverage gate**: root `vitest.config.ts` includes `apps/*/src/**` in coverage (thresholds 80/80/80/75, patch 90)
   and every `apps/*/vitest.config.ts` project must contain a real test. `sonar-project.properties` scans `apps`.
4. **pre-push hook** runs `npm run lint:check && npm run test:unit` for the whole repo — a failing prototype blocks
   every push.
5. **Decide one of two paths (root-config change = ask the owner first):**
   - *Comply*: give the prototype `lint` + `typecheck` scripts, a `vitest.config.ts` (copy apps/app's, name
     `@nivo/prototype`), colocated `*.spec.tsx`, copy in `messages/*.json`, pure/connected split.
   - *Exclude* (prototype = scratch): add `"apps/prototype/**"` to `eslint.config.mjs` `ignores`, add
     `"apps/prototype/**"` to vitest `coverage.exclude`, add `**/apps/prototype/**` to `sonar.exclusions`, omit a
     `lint` script and `vitest.config.ts`, and note `check-fe-architecture.mjs` still walks it (keep component.tsx pure
     or rename files). Not listed in `package.json#starci.codePatterns.next.projects` / `architecture.json#projects`
     = not under the grammar-guard contract — keep it that way for a prototype.
6. Grammar version drift: `apps/prototype/node_modules/@starci/grammar` must be 0.5.0 or the `@source` line points
   at nothing and Common headings render at HeroUI's 36/30px.
7. `@heroui/react` is client-only: import it (and the provider stack) only from `"use client"` files.
8. `transpilePackages` must include `@nivo/ui` (TS source) and `@starci/grammar`, or the build fails on TSX/CSS.
