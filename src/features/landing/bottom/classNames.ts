/** Shared wrappers for the landing bottom half. Campaign blocks (offer, final CTA) use raw brand hex on purpose. */

export const SECTION = "w-full bg-white pt-16 md:pt-24";
export const GRID = "mx-auto w-full max-w-[1040px] px-4 md:px-0";
export const HEAD_ROW = "flex flex-col gap-4";
export const CHIP = "inline-flex h-[26px] w-fit items-center gap-2 rounded-sm border border-[#e2e8f0] bg-white pl-2 pr-2.5 text-xs font-medium uppercase tracking-wider text-[#334155]";
export const CHIP_DOT = "block size-1.5 bg-[#e11d48]";
export const H2 = "m-0 text-[28px] font-bold leading-9 tracking-tight text-[#0f172a] md:text-4xl md:leading-[44px]";
export const AI_CHIP = "inline-flex h-5 items-center rounded-sm bg-[#fb7185] px-1.5 text-xs font-bold text-[#0f172a]";

/* Offer */
export const BENTO = "mt-8 grid grid-cols-1 border border-[#e2e8f0] md:mt-12 md:grid-cols-[1fr_1.5fr_1fr]";
export const FACT = "flex flex-col gap-3 border-b border-[#e2e8f0] p-6 md:p-7";
export const FACT_ICON = "size-6 fill-none stroke-[#334155] stroke-[1.75]";
export const FACT_TITLE = "mt-3 text-[28px] font-bold leading-10 text-[#0f172a] md:text-[32px]";
export const FACT_TEXT = "text-sm leading-5 text-[#334155]";
export const FACTS_COL = "grid grid-cols-1 md:grid-rows-2";
export const TILE =
  "relative isolate flex flex-col justify-between gap-6 overflow-hidden bg-[linear-gradient(180deg,#0f172a_0%,#0f172a_55%,#7f1d1d_100%)] p-6 text-white md:min-h-[440px] md:p-7";
export const TILE_TOP = "flex items-center justify-between gap-3";
export const TILE_LABEL = "text-xs font-medium uppercase tracking-wider text-[#cbd5e1]";
export const TILE_TAG = "rounded-sm bg-[#fb7185] px-2 py-0.5 text-xs font-bold text-[#0f172a]";
export const TILE_BODY = "relative z-10 flex flex-col gap-2";
export const TILE_PLAN = "text-sm font-medium text-[#cbd5e1]";
export const TILE_OLD = "text-lg font-medium tabular-nums text-[#94a3b8] line-through decoration-[#fb7185] decoration-2";
export const TILE_NEW_ROW = "flex flex-wrap items-baseline gap-x-2";
export const TILE_NEW = "text-5xl font-bold leading-[56px] tabular-nums text-white";
export const TILE_UNIT = "text-base text-[#cbd5e1]";
export const TILE_NOTE = "text-sm leading-5 text-[#fecdd3]";
export const TILE_SAVING = "text-lg font-bold text-[#fb7185]";
export const TILE_FOOT = "relative z-10 flex flex-col gap-3";
export const TILE_ENDS = "text-xs text-[#cbd5e1]";
export const TILE_FINE = "text-xs leading-4 text-[#94a3b8]";
export const TILE_MASCOT = "pointer-events-none absolute right-2 top-16 z-0 h-24 w-auto select-none md:hidden lg:right-3 lg:top-14 lg:block lg:h-32";
export const TILE_CTA = "w-full";

/* Countdown (same look as the in-app Founding 50 hero) */
export const CD = "flex items-center gap-2";
export const CD_UNIT = "flex min-w-14 flex-col items-center rounded-lg border border-white/20 bg-white/10 px-2 py-1.5";
export const CD_VALUE = "text-xl font-bold tabular-nums";
export const CD_LABEL = "text-[11px] uppercase tracking-wider text-white/70";

/* Commitment */
export const COMMIT_HEAD = "flex flex-col items-center gap-4 text-center";
export const COMMIT_H2 = `${H2} whitespace-pre-line`;
export const COMMIT_BOX = "mt-8 flex flex-col border border-[#e2e8f0] md:mt-10 md:flex-row";
export const COMMIT_PANEL =
  "relative flex flex-none flex-col justify-between gap-8 overflow-hidden border-b border-[#e2e8f0] bg-[#f8fafc] p-6 md:w-[360px] md:border-b-0 md:border-r md:p-7";
export const COMMIT_PANEL_ARC =
  "pointer-events-none absolute -right-24 -top-24 size-72 rounded-full border border-[#e2e8f0] shadow-[0_0_0_28px_#f8fafc,0_0_0_29px_#e2e8f0,0_0_0_60px_#f8fafc,0_0_0_61px_#e2e8f0]";
export const COMMIT_PANEL_TOP = "relative flex flex-col gap-2";
export const EYEBROW_TEXT = "text-xs font-medium uppercase tracking-wider text-[#334155]";
export const COMMIT_PANEL_LEAD = "text-lg font-medium leading-[26px] text-[#0f172a]";
export const COMMIT_AUTHOR = "relative flex items-center gap-3";
export const COMMIT_MARK = "flex size-14 flex-none items-center justify-center rounded-lg border border-[#e2e8f0] bg-white";
export const COMMIT_NAME = "text-base font-medium leading-6 text-[#0f172a]";
export const COMMIT_ROLE = "text-sm leading-5 text-[#334155]";
export const COMMIT_MAIN = "flex flex-1 flex-col justify-between";
export const COMMIT_QUOTE = "m-0 px-6 py-6 text-xl font-medium leading-8 text-[#0f172a] md:px-10 md:pb-6 md:pt-8 md:text-2xl md:leading-[34px]";
export const COMMIT_AI = "mt-3 flex items-center gap-2 px-6 pb-6 text-sm text-[#334155] md:px-10";
export const PRINCIPLES = "grid grid-cols-1 border-t border-[#e2e8f0] md:grid-cols-2";
export const PRINCIPLE = "flex flex-col gap-1 border-b border-[#e2e8f0] px-6 py-5 last:border-b-0 md:border-b-0 md:border-r md:px-10 md:last:border-r-0";
export const PRINCIPLE_TITLE = "text-lg font-medium leading-[26px] text-[#0f172a]";
export const PRINCIPLE_TEXT = "text-sm leading-5 text-[#334155]";

/* Final CTA */
export const CTA_WRAP = "w-full bg-white px-4 pt-16 md:pt-[60px]";
export const CTA_CARD =
  "relative mx-auto flex w-full max-w-[1120px] flex-col items-center gap-5 overflow-hidden rounded-2xl bg-[linear-gradient(180deg,#0f172a_0%,#0f172a_62%,#7f1d1d_100%)] px-6 pb-0 pt-16 text-center md:min-h-[480px] md:items-start md:justify-center md:px-16 md:py-16 md:text-left";
export const NOTCH = "absolute left-1/2 top-0 h-[30px] w-[440px] max-w-[80%] -translate-x-1/2 bg-white [clip-path:polygon(0_0,100%_0,92%_100%,8%_100%)]";
export const CTA_TEXT_COL = "relative z-10 flex max-w-[560px] flex-col items-center gap-5 md:items-start";
export const CTA_MARK = "flex size-14 items-center justify-center rounded-lg bg-white";
export const CTA_H2 = "m-0 text-[28px] font-bold leading-9 tracking-tight text-white md:text-4xl md:leading-[44px]";
export const CTA_P = "m-0 text-base leading-6 text-[#cbd5e1]";
export const CTA_NOTE = "m-0 text-xs leading-[18px] text-[#cbd5e1]";
export const CTA_BTN = "w-full md:w-60";
export const CTA_MASCOT_MOBILE = "pointer-events-none relative z-0 mt-2 h-56 w-auto select-none md:hidden";
export const CTA_MASCOT_DESKTOP = "pointer-events-none absolute bottom-0 right-12 hidden h-[400px] w-auto select-none md:block lg:right-20";

/* FAQ */
export const FAQ_HEAD = "flex flex-col items-center gap-4 text-center";
export const FAQ_BOX = "mt-8 grid grid-cols-1 items-start gap-4 border border-[#e2e8f0] p-4 md:mt-12 md:grid-cols-2 md:p-5";
export const FAQ_ITEM = "rounded-lg border border-[#e2e8f0] bg-white";
export const FAQ_COL = "flex flex-col gap-3";

/* Footer */
export const FOOT_WRAP = "w-full bg-white px-4 pb-8 pt-10 md:pt-16";
export const FOOT_CARD = "relative mx-auto w-full max-w-[1120px] overflow-hidden rounded-2xl border border-[#e2e8f0] bg-[#f8fafc] pt-12 md:pt-16";
export const FOOT_NOTCH = "absolute -top-px left-1/2 h-[30px] w-[440px] max-w-[80%] -translate-x-1/2 bg-white [clip-path:polygon(0_0,100%_0,92%_100%,8%_100%)]";
export const FOOT_COLS = "mx-4 flex flex-col border border-[#e2e8f0] md:mx-auto md:w-[1040px] md:flex-row";
export const FOOT_BRAND = "flex flex-col justify-between gap-8 border-b border-[#e2e8f0] bg-white p-6 md:w-[400px] md:flex-none md:border-b-0 md:border-r md:p-7";
export const FOOT_ABOUT = "m-0 text-sm leading-5 text-[#334155]";
export const FOOT_TAGLINE = "m-0 text-sm font-medium text-[#0f172a]";
export const FOOT_NAV_WRAP = "grid flex-1 grid-cols-1 sm:grid-cols-3";
export const FOOT_NAV = "flex flex-col gap-2.5 border-b border-[#e2e8f0] p-6 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0 md:p-7";
export const FOOT_NAV_TITLE = "m-0 mb-1 text-base font-medium leading-6 text-[#0f172a]";
export const FOOT_LINK = "text-sm leading-5 text-[#334155] no-underline hover:text-[#e11d48]";
export const FOOT_WATERMARK = "mx-4 flex h-32 items-center justify-center overflow-hidden border-x border-b border-[#e2e8f0] md:mx-auto md:h-[200px] md:w-[1040px]";
export const FOOT_WATERMARK_IMG = "opacity-[0.07] mix-blend-multiply";
export const FOOT_LEGAL = "mx-4 flex flex-col gap-2 py-6 text-sm leading-5 text-[#334155] md:mx-auto md:w-[1040px] md:py-7";
export const FOOT_LEGAL_ROW = "flex flex-col justify-between gap-2 md:flex-row md:items-center md:gap-6";
export const FOOT_MUTED = "m-0 text-[#64748b]";
