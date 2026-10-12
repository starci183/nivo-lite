import { cn } from "@heroui/react";

/** Page rhythm: header, filters, regions (GAP-5). */
export const PAGE_CLASS = cn("flex", "flex-col", "gap-6");

/** Search form and filter links (GAP-3 case-3). */
export const FILTERS_CLASS = cn("flex", "flex-wrap", "items-end", "gap-3");
/** Search field beside its submit action (GAP-3 case-1). */
export const SEARCH_FORM_CLASS = cn("flex", "flex-wrap", "items-end", "gap-3");
/** Filter links / badges row (GAP-2). */
export const CHIPS_CLASS = cn("flex", "flex-wrap", "items-center", "gap-2");

/** A table cell holding a value and its qualifier (GAP-1). */
export const CELL_STACK_CLASS = cn("flex", "flex-col", "items-start", "gap-1");
/** Badges inside a table cell (GAP-1, dense). */
export const BADGE_WRAP_CLASS = cn("flex", "flex-wrap", "gap-1");

/** Two fact lists side by side on wide screens (GAP-5 between the columns). */
export const FACTS_CLASS = cn("grid", "grid-cols-1", "gap-x-6", "md:grid-cols-2");
/** Peer sections in two columns on very wide screens (GAP-5). */
export const GRID_CLASS = cn("grid", "grid-cols-1", "gap-6", "xl:grid-cols-2");
/** Blocks inside one card or section (GAP-4). */
export const STACK_CLASS = cn("flex", "flex-col", "gap-4");
/** One row of a SurfaceListCard: trailing seam dropped on the last row (BOUNDARY-2 case-1), row inset PADDING-4 / PADDING-3. */
export const ROW_CLASS = cn("flex", "flex-wrap", "items-center", "justify-between", "gap-x-4", "gap-y-1", "border-b", "border-separator", "px-4", "py-3", "last:border-b-0");
/** The row's main copy: title over its qualifiers (GAP-1). */
export const ROW_MAIN_CLASS = cn("flex", "min-w-0", "flex-1", "basis-56", "flex-col", "gap-1");
/** The row's trailing badges and links (GAP-2). */
export const ROW_META_CLASS = cn("flex", "flex-wrap", "items-center", "gap-2");

/** Support action rows (GAP-3). */
export const ACTION_CLASS = cn("flex", "flex-col", "gap-3");
/** One support action: field and button side by side (GAP-3 case-1). */
export const ACTION_ROW_CLASS = cn("flex", "flex-wrap", "items-end", "gap-3");
