/**
 * App-owned layout of the landing bottom half (offer, principles, final call to action, FAQ). Faces, edges,
 * corners, insets, type and colour belong to Grammar (SurfaceCard incl. its ink band, Text, Heading, Badge,
 * DescriptionList, Accordion, Footer). No literal colour, no arbitrary value.
 */

/** Blocks inside one section: heading, then content (GAP-4 case-1). */
export const SECTION_STACK = "flex min-w-0 flex-col gap-4";

/* Offer */
/** Two scope facts, the price card, two scope facts; three columns from `md` (GAP-4 case-2). */
export const BENTO = "grid min-w-0 grid-cols-1 gap-4 md:grid-cols-3";
/** One column of two fact cards (GAP-4). */
export const FACTS_COL = "flex min-w-0 flex-col gap-4";
/** Fact card body: tile, value, explanation (GAP-3). */
export const FACT_BODY = "flex min-w-0 flex-col gap-3";
/** Price card body: plan and price, countdown, action (GAP-5 between its three parts). */
export const TILE_BODY = "flex min-w-0 flex-col gap-6";
/** Price block lines (GAP-1: plan, old price, new price read as one identity). */
export const PRICE_STACK = "flex min-w-0 flex-col gap-1";
/** New price and its lighter unit on one baseline (DISCIPLINE-2 case-2; GAP-2). */
export const PRICE_ROW = "flex flex-wrap items-baseline gap-x-2";
/** Countdown, end date, action and fine print (GAP-3). */
export const TILE_FOOT = "flex min-w-0 flex-col gap-3";

/* Commitment: one joined card, bands separated by Divider; band insets follow side contact (PADDING-3/4). */
/** First band: meets the card's outer edge on top and a separator below. */
export const BAND_FIRST = "flex min-w-0 flex-col gap-3 px-4 pt-4 pb-3";
/** Band between two separators. */
export const BAND_MID = "flex min-w-0 flex-col gap-3 px-4 py-3";
/** Last band: meets a separator on top and the card's outer edge below. */
export const BAND_LAST = "px-4 pt-3 pb-4";
/** Author mark beside name and role (GAP-3). */
export const AUTHOR = "flex items-center gap-3";
/** Name over role (GAP-1 case-1). */
export const AUTHOR_TEXT = "flex min-w-0 flex-col gap-1";
/** The "AI" mark beside its note (GAP-2 case-4). */
export const AI_NOTE = "flex flex-wrap items-center gap-2";
/** Two principles side by side from `md` (GAP-4 case-2). */
export const PRINCIPLES = "grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2";
/** The pull quote resets the browser's own blockquote margin (MARGIN-0); its copy is a Grammar `Text`. */
export const QUOTE = "m-0";

/* Final CTA (inside the ink band) */
/** Copy column of the band, capped so the artwork zone keeps its corner (MEASURE-4 case-1; GAP-4). */
export const CTA_COPY = "flex min-w-0 max-w-xl flex-col items-start gap-4";

/* FAQ */
/** Two FAQ columns from `md` (GAP-4 case-2). */
export const FAQ_GRID = "grid min-w-0 grid-cols-1 items-start gap-4 md:grid-cols-2";

/* Footer */
/** Brand column: logo, about, tagline (GAP-2 is the Footer brand gap; this stack separates the tagline). */
export const FOOT_BRAND = "flex min-w-0 flex-col gap-4";
/** Legal lines (GAP-1). */
export const FOOT_LEGAL = "flex min-w-0 flex-col gap-1";
