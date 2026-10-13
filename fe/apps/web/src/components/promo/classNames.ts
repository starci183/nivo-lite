/**
 * App-owned layout of the Founding 50 campaign blocks. Faces, edges, type and colour belong to Grammar
 * (SurfaceCard ink band, Alert, Badge, Text, DescriptionList, Meter). No literal colour, no arbitrary value.
 */

/** Hero copy column, capped so the ink band's artwork zone keeps its corner (MEASURE-4 case-1; GAP-4). */
export const HERO_COPY = "flex min-w-0 max-w-xl flex-col items-start gap-4"
/** The call to action beside the live countdown; wraps on narrow widths (GAP-4). */
export const HERO_ROW = "flex flex-wrap items-center gap-4"
/** Countdown keeps a readable width inside the wrapping row (MEASURE-4). */
export const HERO_COUNTDOWN = "min-w-0 max-w-sm flex-1 basis-64"
/** The strip is an announcement for wide screens; phones keep the page clear (layout only). */
export const STRIP = "hidden sm:block"
/** Pill: campaign mark beside its one-line terms (GAP-2 on the inline axis, GAP-1 between wrapped rows). */
export const PILL_WRAP = "flex max-w-xl flex-wrap items-center gap-x-2 gap-y-1"
