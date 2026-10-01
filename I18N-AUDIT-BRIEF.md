# Wave: Vietnamese / English switch + grammar audit

Read first: AGENTS-BRIEF.md, BRAND-V1.1.md, PROMO-BRIEF.md, UI-RULEBOOK.md. Same rules (own files only, no git, no npm install,
no DB reset, dev server running on :3090, verify with scripts/shot.mjs + Read, `npx tsc --noEmit` must stay clean).

## 1. i18n (infrastructure is ready — do not edit src/i18n/core.ts, server.ts, client.tsx, actions.ts)
- Locale lives in the `NIVO_LOCALE` cookie; default **vi**. `LocaleSwitch` (src/i18n/LocaleSwitch.tsx) is the VI | EN control.
- Create ONE dict file per area you own: `src/i18n/dict/<area>.ts` using `defineDict({ en: {...}, vi: {...} })`
  (TypeScript forces every English key to exist in Vietnamese). Shared words: `src/i18n/dict/common.ts` (read-only for you;
  if you need a new shared word, put it in your own dict).
- Server components: `const t = await getT(myDict)` from "@/i18n/server". Client components: `const t = useT(myDict)` from
  "@/i18n/client". Placeholders: `t("updated", { time })`.
- EVERY visible string in your files goes through `t()`: headings, labels, buttons, helper text, empty states, errors,
  aria-labels, placeholders, badges, toasts, relative-time words ("2h ago" → "2 giờ trước"), plural-ish phrases.
- Dates/times: `Intl.DateTimeFormat(intlLocale(locale), { ..., timeZone: TIME_ZONE })` from "@/i18n/core" (get `locale`
  via `getLocale()` on the server or `useLocale()` on the client). Never hard-code "en-GB"/"en-US".
- Data stays as stored (customer names, needs, AI drafts, agent names) — translate only the interface.
- Vietnamese copy: natural business Vietnamese for a non-technical SME owner (anh Nam). Keep NIVO product nouns in English
  where NIVO uses them: Office, Module, Workspace, Chatbot, Sales Agent, Accounting Agent, Founding 50, NIVO OS, AI.
  Glossary: lead → khách hàng tiềm năng (short: "khách hàng"), responsibility → việc / trách nhiệm, owner → người phụ trách,
  next step → bước tiếp theo, needs your approval → cần bạn duyệt, approve & send → duyệt và gửi, reject → từ chối,
  draft → bản nháp, evidence → bằng chứng, outcome → kết quả, invoice → hóa đơn, due → hạn, overdue → quá hạn,
  pipeline → phễu khách hàng, won → chốt được, lost → không chốt, captured → đã ghi nhận, history → lịch sử,
  buy → mua, included → có sẵn, set up → thiết lập, test → dùng thử, customer channel → kênh khách hàng.
  Sentence case, no "!", no emoji. Keep strings short enough not to break layouts (Vietnamese runs ~20% longer — check it).

## 2. Grammar audit (read the real .d.ts in node_modules/@starci/grammar/dist/{common,core}/** before judging)
- Every `Input` inside a SurfaceCard / SurfaceListCard / dialog: `variant="secondary"`. (Textarea/Select/SearchField/
  NumberField/DateField have NO variant prop in grammar 0.5.4 — src/app/brand.css now paints them secondary inside
  surfaces; confirm visually that every field in a card has the grey #F1F5F9 fill and no white box.)
- Fields have a visible `label` (not placeholder-as-label); helper text via `description`; errors via `errorMessage`/`isInvalid`.
- Exactly one filled `primary` Button per region; others secondary/outline/ghost/TextAction. Campaign blocks count as their
  own region but the operational region beside them must not add another crimson button (e.g. an "Add Chatbot" CTA in an
  insight card next to the hero must be secondary).
- `Button` uses either `href` or `onPress`, never both; icon-only buttons have a label; Badges max 2 per entity; status
  tones only for real states; no raw hex/px outside campaign classNames; `Heading` levels in order with one h1 per page.
- Loading uses `isSkeleton`, empty uses `EmptyNotice`, errors use `Alert`; no dead controls.
Report every fix you made (file + what) and anything you could not fix.

## 3. Verify
Shoot your routes in BOTH languages: first `vi` (default), then set English by opening the page and clicking the EN
switch — or simpler, pass the cookie: `SHOT_LOCALE=en` env is supported by scripts/shot.mjs (sets NIVO_LOCALE).
1440 + 390 widths. Fix overflow/wrapping from longer Vietnamese strings.
