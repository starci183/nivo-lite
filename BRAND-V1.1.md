# NIVO Brand System V1.1 — rules for this prototype (source: NIVO_BRAND_SYSTEM_DESIGN_SYSTEM_V1_1.pdf, 25/09/2026)

Already applied globally in src/app/brand.css (do not fight it with local colours):
crimson #E11D48 primary/link/focus · burgundy #7F1D1D hover · ink #0F172A text · muted #64748B · canvas #F8FAFC ·
white cards with 1px #E2E8F0 border (no drop shadows) · radius 8px everywhere · status: success #166534,
warning #92400E, danger #B91C1C (distinct from crimson), info #1D4ED8 · blush #FFE4E6 selection surface.

Logo: `import { NivoLogo } from "@/components/brand/NivoLogo"` → `<NivoLogo variant="os" height={28} />` in the product
top bar, `variant="full"` on the login hero, `variant="mark"` for tiny/collapsed spots. Never use @nivo/ui NivoBrand,
never redraw/recolor/invert the O, light surfaces only, never use the O as a functional icon or loader.

Brand rules that change the UI:
- Philosophy: System over Decoration · Outcome over Feature · Evidence over Hype · Clarity over Complexity.
- NIVO OS = 80–90% neutral, 10–20% crimson. ONE primary CTA per content region; never a row of red buttons;
  don't make icons/borders/headlines crimson.
- Sentence case everywhere; ALL CAPS only for short eyebrows / tiny status labels.
- "Don't turn every piece of content into a card." Prefer whitespace + 1px dividers; border over elevation.
- AI appears as suggestion / prepared draft with its boundary: mark AI-prepared content with an "AI" chip
  (coral #FB7185 fill, ink text) — never the approval control itself.
- Sensitive AI actions show: AI proposed → human reviewed → approved / modified / rejected → system recorded.
- Evidence states in words: Pending → Captured → Reviewed → Verified → Customer confirmed. A finished task is not a
  verified outcome.
- Metrics never bare: value + context + source. No "+300%" style.
- Icons: simple geometric line glyphs, text label for ambiguous actions; no robots/brains/sparkles/emoji.
- Motion: calm; no spinners that loop forever, no glow, no pulse.
- Theme: light only (remove/hide the dark theme switch).
- Business loop wording: Trigger → Business State → Responsibility → Controlled Action → Evidence → Verified Outcome → Learning.
- Tagline: "Human Leads. AI Operates. System Learns."

## Business flow update (owner, 29/09 night) — READ
Anh Nam (the owner) is not technical: every label must be plain business language that follows NIVO's current
business, not tech terms. Use: Office, Tasks, Module, Owner, Approval / "Needs your approval", Lead, Customer,
Next step, Evidence, Invoice. Avoid: execution, responsibility id, handle syntax in headings, "LLM", "prompt",
"realtime", "conversation kind", raw enum values. ("@sales" is fine inside chat as a mention.)

The demo workspace now has **Sales Agent (@sales) and Accounting Agent (@accounting) pre-installed** ("Included
with your workspace"). The **Chatbot is NOT installed**: the demo story is the owner logs in and **buys the Chatbot
module** from the catalog, sets it up, tests it, and the Chatbot captures website leads.
The SME flow told by the 3 agents:
Chatbot captures a website lead → Sales Agent owns it, prepares the next step and drafts the follow-up →
owner approves → deal won with evidence → Sales hands it to Accounting Agent → Accounting drafts the invoice →
owner approves. Humans approve everything that leaves the company.
Catalog: Chatbot = "Buy" / "Add to workspace" (primary); Sales and Accounting = "Included" badge + "Open" (they are
installed agents, fully usable: Office mentions, setup page, 1:1 test chat). Customer channel (website widget) only
exists for Chatbot agents.
