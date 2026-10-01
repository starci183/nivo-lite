# In-app FOMO & ads system — make NIVO OS feel like a real, lively SaaS

Read first: AGENTS-BRIEF.md, BRAND-V1.1.md (incl. "Business flow update"), UI-RULEBOOK.md. Same rules: own files only,
no git, no npm install, no DB reset, dev server already running on :3090 (hot reload), verify with
`MSYS_NO_PATHCONV=1 node scripts/shot.mjs ../../.shots/<id> /route` and the Read tool, `npx tsc --noEmit`.

## The campaign (single source of truth)
`src/lib/promo.ts` → `FOUNDING_OFFER` (Founding 50: 50% off for the first 50 SMEs, ends 31 Oct 2026, conditions text,
`slotsClaimed: null`). `src/components/promo/FoundingOffer.tsx` already renders `variant="hero" | "strip" | "inline"`
(strip in the console layout, hero on Overview + Modules, inline on /modules/new). Mascot: `/images/nivo-unicorn.png`
(transparent 1536×1024, NIVO's unicorn with the responsibility loop). Campaign surfaces may use the Ink→Burgundy
gradient (#0F172A → #7F1D1D), coral #FB7185 accents, white text; operational UI stays neutral.

## Honesty rules (hard)
FOMO must come from REAL data or the real campaign config only.
Allowed: countdown to the real end date, the cap stated as a rule, insights computed from this workspace's DB,
progress/checklists from real events, badges earned by real actions, contextual upsells.
FORBIDDEN: fake "X just bought", fake remaining slots, viewer counts, fake testimonials/logos/ratings, invented prices,
"most popular"/"best seller" claims, auto-popups that block work, dark patterns (pre-checked boxes, fake close buttons).
Every ad has a way to dismiss or is a quiet card; never more than one campaign block per screen region.
Dismissals may use localStorage (wrap in try/catch).

## Chatbot state
"Chatbot bought" = an agent with `module = 'chatbot'` exists in the workspace. "Founding member" = a `module.purchased`
event exists whose created_at is inside the offer window.
