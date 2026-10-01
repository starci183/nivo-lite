# Public landing page `/welcome` — rebuild the NIVO.VN template (Scalora framework) with grammar

Read first: AGENTS-BRIEF.md, BRAND-V1.1.md, PROMO-BRIEF.md, I18N-AUDIT-BRIEF.md, UI-RULEBOOK.md. Same rules: own files only,
no git, no npm install, no DB reset, dev server on :3090, verify with scripts/shot.mjs (the page is public: you can also
screenshot it with your own small Playwright snippet without logging in) + Read, `npx tsc --noEmit` clean.

## Source template (TEMPLATE ONLY — follow its structure and rhythm, not its code)
`D:/starci-lanes/.landing-template/project/` — `Main.dc.html` (home, desktop 1440), `MainMobile.dc.html` (390),
parts: `Nav`, `TrustStrip`, `Numbers`, `OsScreen`, `Commitment`, `FinalCta`, `Faq`, `Footer`; extra pages `UngDung`, `GiaiPhap`,
`MucGia` for richer copy; `ds/nivo/tokens.json` (brand tokens). The `canvas.json` notes list what is NOT confirmed.
Keep from the template: section order, the 1040px content grid with hairline rails and small square corner marks, eyebrow
chips (tiny crimson square + uppercase label), large 56/64 hero, card/tab rhythm, 2-column FAQ, final CTA block on ink,
footer with big watermark, crimson only on the primary button. Replace `.dc.html` markup with React + `@starci/grammar/common`
+ `@nivo/ui` (SectionHeader, Heading, Text, Button, Badge, SurfaceCard, Tabs, Accordion/SurfaceAccordionCard, IconTile,
Meter…) and plain layout wrappers with classNames; campaign/marketing blocks may use raw brand hex in their classNames.ts.

## Product truth for the landing
- It markets THIS app: NIVO OS with Office (team + AI agents), Sales Agent + Accounting Agent included, Chatbot module to buy,
  one customer journey Chatbot → Sales → owner approval → won with evidence → Accounting invoice. Tagline
  "Human Leads. AI Operates. System Learns."
- Replace the template's striped image placeholders with REAL screenshots of this app (take them with scripts/shot.mjs at
  1440×900 in the matching locale, crop if needed with Python PIL, save under `public/images/landing/<locale>/*.png`):
  Overview (P01), a lead page context/owner (P02/P03), the approval card (P04), outcome/history (P05), Office, modules catalog.
  Label every product visual "Real product · demo data" / "Sản phẩm thật · dữ liệu demo" (Brand: label demo data).
- Numbers/prices: the template shows NIVO Start 499.000đ/month and a 7-day free trial — these are "snapshot, to confirm".
  Put every price/trial value in ONE config `src/features/landing/offer.ts` with a `TO_CONFIRM` comment; show the
  Founding 50 campaign (from `src/lib/promo.ts`: −50% for the first 50 SMEs, ends 31 Oct 2026) as a band with the
  unicorn art (`/images/promo/founding50-hero.jpg`, mascots in `/images/promo/mascot-*.png`). Never invent customers,
  logos, testimonials, ratings or growth numbers. The Commitment block uses the fallback attribution
  "Đội ngũ NIVO · Nguyên tắc phát triển sản phẩm" / "The NIVO team · Product principles" (no personal quote).
- CTAs: primary "Dùng thử NIVO OS" / "Try NIVO OS" → `/login`; secondary "Xem sản phẩm" / "See the product" → anchor to
  the product section; Founding 50 CTA → `/login`. Nav has the VI | EN `LocaleSwitch` and "Đăng nhập" / "Sign in".
- Bilingual (vi default + en) through `src/i18n/dict/landing*.ts` dictionaries; template copy is the Vietnamese source,
  write natural English for en.
- Responsive: 1440 matches the template; 390 follows MainMobile (one column, 16px gutter, full-width primary button,
  tabs → accordion).
