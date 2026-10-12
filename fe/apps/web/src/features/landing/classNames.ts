/**
 * App-owned layout of the public landing page. Only flex/grid/gap/width classes live here: every face, edge,
 * corner, inset, type size and colour belongs to the Grammar component that draws it (SurfaceCard, TopBar,
 * Footer, Text, Heading, Badge, MediaFrame ...). No literal colour, no arbitrary value.
 */

/** Page regions: a marketing surface whose sections are deliberately spacious (GAP-6 case-2), block inset PADDING-9. */
export const MAIN = "flex min-w-0 flex-col gap-8 py-6 sm:py-8";
/** Blocks inside one section: heading, then content (GAP-4 case-1). */
export const SECTION_STACK = "flex min-w-0 flex-col gap-4";
/** Reading cap for a lead paragraph (MEASURE-4 case-1). */
export const LEAD_MEASURE = "max-w-2xl";

/* Nav */
/** The in-page anchors leave the bar below the wide breakpoint (layout only). */
export const NAV_LINKS = "hidden min-w-0 lg:flex";
/** "Sign in" leaves the bar on phones; "Try now" stays (layout only). */
export const NAV_SIGNIN = "hidden sm:block";

/* Hero */
/** Hero copy: eyebrow, title, lead, actions, notes (GAP-4 case-1). */
export const HERO_COPY = "flex min-w-0 flex-col items-start gap-4";
/** Primary and secondary call to action, side by side from `sm` (GAP-3 case-3). */
export const HERO_ACTIONS = "grid w-full grid-cols-1 gap-3 sm:w-auto sm:auto-cols-max sm:grid-flow-col";
/** Hero notes: one qualifier under another (GAP-1 case-1). */
export const HERO_NOTES = "flex flex-col gap-1";
/** Two columns from `lg`, copy first; stacked on phones (GAP-5). */
export const HERO_GRID = "grid min-w-0 grid-cols-1 gap-8 lg:grid-cols-2 lg:items-center";
/** Three included facts side by side, wrapping on narrow widths (GAP-3 case-3). */
export const HERO_FACTS = "flex flex-wrap items-center gap-x-4 gap-y-2";
/** One included fact: mark then words (GAP-2). */
export const HERO_FACT = "flex items-center gap-2";
/** Hero art band: decorative image, no copy on it (SURFACE-6 case-1, the page's only accent slab). */
export const HERO_ART_BAND = "relative isolate min-h-32 overflow-hidden bg-accent";

/* Trust strip */
/** Audience copy beside the watched situations; stacks on phones (GAP-5). */
export const TRUST_ROW = "flex min-w-0 flex-col gap-6 md:flex-row";
/** Audience copy column (GAP-1 case-1: label, name, qualifier read as one identity). */
export const TRUST_WHO = "flex min-w-0 flex-col gap-1 md:w-80 md:shrink-0";
/** Watched situations: a wrapping grid of peers (GAP-3). */
export const TRUST_LIST = "grid min-w-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3";

/* Product */
/** Desktop panel: tabs, framed shot, title and bullets (GAP-4). Hidden on phones, where the stack shows every view. */
export const PRODUCT_DESKTOP = "hidden min-w-0 flex-col gap-4 md:flex";
/** Panel title beside its three benefits (GAP-5). */
export const PRODUCT_COPY = "grid grid-cols-2 gap-6";
/** Benefit list rows (GAP-3). */
export const BULLETS = "flex flex-col gap-3";
/** Phone stack: one article per view (GAP-6 between views). */
export const PRODUCT_STACK = "flex min-w-0 flex-col gap-8 md:hidden";

/* Flow */
/** Four steps: one column, two from `md`, four from `lg` (GAP-4 case-2). */
export const FLOW_GRID = "grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4";
/** A card fills its grid cell so peer cards share one height. */
export const FLOW_ITEM = "flex min-w-0";
/** Step label and the human-approval tag (GAP-2 case-4). */
export const FLOW_META = "flex flex-wrap items-center justify-between gap-2";
/** Agent name and its "AI" mark (GAP-2 case-4). */
export const FLOW_NAME = "flex flex-wrap items-center gap-2";
/** Card body rhythm (GAP-3). */
export const FLOW_BODY = "flex min-w-0 flex-col gap-3";

/* Connect */
/** Copy and the channel list; two columns from `lg` (GAP-5). */
export const CONNECT_GRID = "grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start";
/** Copy column: header, then its call to action (GAP-4). */
export const CONNECT_COPY = "flex min-w-0 flex-col items-start gap-4";
/** Channel row inside the joined list card (BOUNDARY-2 case-1, PADDING-3/4 side contact). */
export const CHANNEL_ROW = "flex items-start justify-between gap-4 border-b border-separator px-4 py-3 last:border-b-0";

/** In-page anchor targets clear the sticky top bar when a nav link scrolls to them (MARGIN, layout only). */
export const ANCHOR = "scroll-mt-16";
