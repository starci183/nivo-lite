# UX wave — friendly like Zalo, re-audited page by page (owner request, 30/09)

Read first: AGENTS-BRIEF.md, BRAND-V1.1.md (incl. business flow), I18N-AUDIT-BRIEF.md (every string through dicts, vi default),
PROMO-BRIEF.md, UI-RULEBOOK.md. Same rules: own files only, no git, no npm install, no DB reset (except where told), dev server
on :3090, verify with `MSYS_NO_PATHCONV=1 SHOT_LOCALE=vi node scripts/shot.mjs ../../.shots/<id> /route` + Read, tsc clean.
The console overview is at /dashboard; "/" is the public landing.

## Owner feedback (verbatim intent)
- "chat mà ở dưới này thì ai biết" — in the current Office the composer sits far below the approval cards and banners; nobody
  finds the chat. → The chat must be THE page: conversation fills the viewport, composer always pinned and visible.
- "NIVO sẽ giống Zalo" — target: `design-refs/office-zalo-target.webp` (study it with the Read tool); current problem:
  `design-refs/office-current-problem.webp`.
- "UX UI dễ xài, friendly" — simpler, warmer, obvious next step on every page, fewer walls of cards.
- Avatars: people = Google-style initials (or photo). Use ONLY `PersonAvatar` / `AgentAvatar` from
  "@/components/avatar/PersonAvatar" (replace every @nivo/ui `Avatar` and grammar `Avatar` in your files).
  People → `<PersonAvatar name=… src=… size=… online />`; agents → `<AgentAvatar module=… label=… online />`.

## Friendly-UX principles (apply to every page you own)
1. One obvious primary action per screen region; say it as a verb the owner uses ("Duyệt và gửi", "Thêm khách hàng").
2. Put what needs the owner FIRST and small (a chip/strip), not three stacked banners. Campaign/promo max one block per page,
   dismissible, never above the thing the user came to do (except /dashboard's hero).
3. Conversational, short copy; no system jargon; empty states tell what to do next with one button.
4. Consistent layouts: page header (eyebrow + title + one-line description + actions) → content. Same spacing rhythm.
5. Touch-friendly (≥ 40px), keyboard reachable, visible focus, no horizontal scroll at 390px.
6. Bubbles and lists over dense tables; relative times ("5 phút trước"); status in words + colour.
7. Keep everything real (no fake data/metrics); keep the i18n dicts for every new string (vi + en).

## Lanes (each agent edits ONLY its own paths; everything else is read-only)
- `src/components/avatar/**` is shared and read-only. If you need a new prop, say so in your report, don't fork it.
- Landing (`/`, `src/features/landing/**`) is out of scope.
- U1 Office (the headline fix): `src/app/(console)/chat/**`, `src/features/office/**`, dict `office.ts`.
  Zalo layout: left = conversation list (Office group chat + each agent + people), centre = the thread filling the height with
  the composer pinned at the bottom, right = collapsible info panel (members, pending approvals as a compact list). Approval
  requests show as bubbles/cards INSIDE the thread with inline "Duyệt và gửi / Sửa / Từ chối", plus one small "Cần duyệt (n)"
  chip in the thread header, not banners above the chat. Mobile (390px): list ⇄ thread like Zalo, back arrow.
- U2 Shell + Dashboard: `src/features/shell/**`, `src/app/(console)/layout.tsx`, `src/app/(console)/loading.tsx`,
  `src/app/(console)/error.tsx`, `src/app/(console)/dashboard/**`, `src/features/overview/**`, `src/components/promo/**`,
  `src/features/promo/**`, `src/lib/promo.ts`, dicts `shell.ts`, `overview.ts`, `promo.ts`. Shell: Zalo-like slim left rail
  with icon + label, "Office / Chat" as the first, most visible entry with an unread badge; top bar light; the promo is one
  dismissible strip at most.
- U3 Leads: `src/app/(console)/leads/**`, `src/features/leads-list/**`, `src/features/lead-detail/**`,
  `src/features/approval-card/**` (keep export names + props), `src/features/promo-ads/**` (keep export names + props; U1
  renders OfficePromoCard), dicts `leads.ts`, `lead.ts`, `approval.ts`, `promoAds.ts`. List = contact-list feel (avatar,
  name, last message/next step, relative time, status chip); detail = conversation-first with a side panel.
- U4 Modules, agent chat, board, login: `src/app/(console)/modules/**`, `src/features/modules/**`,
  `src/features/agent-chat/**`, `src/lib/modules.ts`, `src/app/(console)/responsibilities/**`,
  `src/features/responsibilities/**`, `src/app/login/**`, `src/features/login/**`, dicts `modules.ts`, `agentChat.ts`,
  `responsibilities.ts`, `login.ts`. Agent chat must share Office's "chat is the page" pattern (pinned composer).

## Done means
tsc clean (`npx tsc --noEmit -p .`), eslint clean on your files, vi + en screenshots at 1440 and 390 for each route you own
(Read them and fix what looks off), and a short report: what changed, before/after shot paths, anything you need from
another lane.
