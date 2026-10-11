import { cn } from "@heroui/react";

/** Vertical rhythm of the workbench: figures, waiting decisions, tabs, panel (GAP-4). */
export const PAGE_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-4", "py-2", "md:py-4");
/** The panel under the tabs (GAP-3). */
export const PANEL_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-3");
/** Stacked blocks of one tab (GAP-3). */
export const STACK_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-3");
/** Stacked cards of one tab (GAP-4). */
export const STACK_LG_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-4");

/** One list row inside a SurfaceListCard: its own trailing hairline, the last one dropped (BOUNDARY-2 case-1, PADDING-3). */
export const ROW_CLASS_NAME = cn("flex", "flex-col", "gap-3", "border-b", "border-separator", "px-4", "py-3", "last:border-b-0", "md:flex-row", "md:items-center", "md:justify-between");
/** Row text column (GAP-1). */
export const ROW_MAIN_CLASS_NAME = cn("flex", "min-w-0", "flex-1", "flex-col", "gap-1");
/** Row action column (GAP-2). */
export const ROW_ACTIONS_CLASS_NAME = cn("flex", "shrink-0", "flex-wrap", "items-center", "gap-2");
/** Chips and facts on one wrapping line (GAP-2 case-4). */
export const CHIPS_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-x-2", "gap-y-1");
export const TOOLBAR_CLASS_NAME = cn("flex", "flex-col", "gap-2", "md:flex-row", "md:items-end", "md:justify-between");
export const TOOLBAR_FIELD_CLASS_NAME = cn("min-w-0", "md:w-80");
/** Stacked form fields; the Drawer or card owns the inset (GAP-3). */
export const FORM_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-3");
export const FORM_GRID_CLASS_NAME = cn("grid", "grid-cols-1", "gap-3", "sm:grid-cols-2");
/** A drafted message: a recessed neutral band. grammar gap: no Common quote/recessed band (SURFACE-3 case-1 owner is "—"). */
export const QUOTE_CLASS_NAME = cn("flex", "flex-col", "gap-1", "rounded-xl", "bg-surface-secondary", "px-3", "py-2", "text-foreground", "whitespace-pre-wrap");
/** One order or recipe line: the item, then quantity and price (GAP-2). */
export const LINE_ROW_CLASS_NAME = cn("grid", "grid-cols-1", "items-end", "gap-2", "sm:grid-cols-3");

/** The order board: one lane per status side by side inside a HorizontalScrollRegion (which owns the overflow). */
export const BOARD_CLASS_NAME = cn("flex", "gap-3", "pb-2", "snap-x", "snap-mandatory");
/** One lane: a fixed width on narrow screens, an equal share on wide ones. */
export const LANE_CLASS_NAME = cn("w-72", "min-w-0", "shrink-0", "snap-start", "lg:w-auto", "lg:flex-1");
/** One order inside a lane (BOUNDARY-2 case-1, PADDING-3). */
export const LANE_ROW_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-2", "border-b", "border-separator", "px-4", "py-3", "last:border-b-0");

/** The stock-take row: name over unit, count field to the right (thumb reach on a phone; BOUNDARY-2 case-1). */
export const COUNT_ROW_CLASS_NAME = cn("flex", "items-center", "justify-between", "gap-3", "border-b", "border-separator", "px-4", "py-3", "last:border-b-0");
export const COUNT_FIELD_CLASS_NAME = cn("w-28", "shrink-0");
