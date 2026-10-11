import { cn } from "@heroui/react";

/** The whole workbench: sub-tabs over one panel (GAP-5 between regions). */
export const WORKBENCH_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-6");

/** A panel's stacked regions, each with its own heading (GAP-5). */
export const PANEL_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-6");

/** One block: heading line, then content (GAP-3). */
export const BLOCK_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-3");

/** Heading line with an action or a peer choice on the right (GAP-3 case-3). */
export const BLOCK_HEAD_CLASS_NAME = cn("flex", "flex-wrap", "items-end", "justify-between", "gap-3");

/** Supporting lines under a key figure (GAP-1: qualifiers of one figure). */
export const MEASURE_META_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-1");

// grammar gap: Common publishes no bar/column chart; the weekly bars stay app-owned on semantic tokens only.
/** Weekly bars (GAP-3 between peer columns; BOUNDARY-1 case-2 baseline). */
export const BARS_CLASS_NAME = cn("flex", "h-36", "items-end", "gap-3", "border-b", "border-separator", "px-1");

/** One week column. */
export const BAR_COLUMN_CLASS_NAME = cn("flex", "h-full", "min-w-0", "flex-1", "flex-col", "justify-end");

/** Stacked bar body (live over simulated); RADIUS-2 on the top edge only. */
export const BAR_STACK_CLASS_NAME = cn("flex", "w-full", "flex-col", "justify-end", "overflow-hidden", "rounded-t-sm");

/** Live part of a bar: accent. */
export const BAR_LIVE_CLASS_NAME = cn("w-full", "bg-accent");

/** Simulated part of a bar: neutral control face. */
export const BAR_SIM_CLASS_NAME = cn("w-full", "bg-default");

/** Week labels under the bars. */
export const BAR_LABELS_CLASS_NAME = cn("flex", "gap-3", "px-1", "pt-2");

/** One week label column. */
export const BAR_LABEL_CLASS_NAME = cn("min-w-0", "flex-1");

/** Legend line (GAP-4 between peer entries, GAP-1 when wrapped). */
export const LEGEND_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-x-4", "gap-y-1");

/** Legend swatch of the live part (RADIUS-2 case-1). */
export const SWATCH_LIVE_CLASS_NAME = cn("inline-block", "size-3", "rounded-sm", "bg-accent");

/** Legend swatch of the simulated part (RADIUS-2 case-1). */
export const SWATCH_SIM_CLASS_NAME = cn("inline-block", "size-3", "rounded-sm", "bg-default");

/** One list row inside a SurfaceListCard: main text, aside amount (BOUNDARY-2 case-1, PADDING-4 inline / PADDING-3 block). */
export const ROW_CLASS_NAME = cn("flex", "flex-wrap", "items-start", "justify-between", "gap-x-4", "gap-y-1", "border-b", "border-separator", "px-4", "py-3", "last:border-b-0");

/** Row text column (GAP-1). */
export const ROW_MAIN_CLASS_NAME = cn("flex", "min-w-0", "flex-1", "basis-56", "flex-col", "gap-1");

/** Row aside: amount over status (GAP-1). */
export const ROW_ASIDE_CLASS_NAME = cn("flex", "shrink-0", "flex-col", "items-end", "gap-1");

/** Chips on one line (GAP-2 case-4). */
export const CHIPS_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-2");

/** Form grid for the manual evidence form (GAP-4 case-3). */
export const FORM_GRID_CLASS_NAME = cn("grid", "grid-cols-1", "gap-4", "sm:grid-cols-2");

/** A form field that spans both columns. */
export const FORM_WIDE_CLASS_NAME = cn("sm:col-span-2");

/** Stacked form content (GAP-4 case-3). */
export const FORM_CLASS_NAME = cn("flex", "flex-col", "gap-4");

/** Actions line of a form (GAP-3 case-1). */
export const FORM_ACTIONS_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-3");

/** Question cards sit in a column; the card brings its own thread layout (GAP-4 case-2). */
export const QUESTIONS_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-4");

/** Drawer body: lineage region over correction region (GAP-5). The Drawer owns the inset. */
export const DRAWER_BODY_CLASS_NAME = cn("flex", "flex-col", "gap-6");

/** Filter strip over a list (GAP-3). */
export const FILTER_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "justify-between", "gap-3");
