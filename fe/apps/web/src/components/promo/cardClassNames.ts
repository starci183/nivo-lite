/**
 * App-owned layout of the console promo cards (sidebar ad, member card, missed-leads insight, onboarding checklist).
 * Faces, edges, corners, insets, type and colour belong to Grammar (SurfaceCard, Badge, Text, Meter, Icon,
 * CloseButton, IconButton). No literal colour, no arbitrary value.
 */

/** Card body stack (GAP-2: title, explanation, mark and action read as one compact unit). */
export const STACK = "flex min-w-0 flex-col gap-2";
/** Sidebar ad head: title beside its dismiss control (GAP-2). */
export const AD_HEAD = "flex items-start justify-between gap-2";

/** Insight: copy, then its action; side by side from `md` (GAP-4). */
export const INSIGHT = "flex min-w-0 flex-col gap-4 md:flex-row md:items-center";
/** Insight copy takes the free width (GAP-1: eyebrow, title, explanation read as one identity). */
export const INSIGHT_COPY = "flex min-w-0 flex-1 flex-col gap-1";

/** Checklist body: progress, then the steps (GAP-4). */
export const CHECK_BODY = "flex min-w-0 flex-col gap-4";
/** Step rows (GAP-1 between peers that already carry their own inset). */
export const CHECK_LIST = "flex min-w-0 flex-col gap-1";
/** One step: its copy and, for the next step, its hint and action (GAP-2). */
export const STEP = "flex min-w-0 flex-col items-start gap-2 px-4 py-2";
/**
 * The next step, raised on the neutral recessed band (SURFACE-3 case-1, RADIUS-5 case-2, PADDING-3 band). The band
 * has no Grammar owner, so the app writes the semantic pair.
 */
export const STEP_NEXT = "flex min-w-0 flex-col items-start gap-2 rounded-xl bg-surface-secondary px-4 py-3 text-foreground";
/** "All set" line beside its count (GAP-3). */
export const ALL_SET = "flex flex-wrap items-center justify-between gap-3";
