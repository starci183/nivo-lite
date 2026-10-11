import { cn } from "@heroui/react";

/** Whole workbench: tabs over one panel (GAP-5). */
export const BENCH_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-6");
/** One tab panel: its regions (GAP-5). */
export const PANEL_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-6");
/** Stacked blocks under one heading or inside one card (GAP-3). */
export const BLOCK_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-3");
/** Tight stack: a title over its facts (GAP-1). */
export const STACK_SM_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-1");
/** A wrapping row of controls (GAP-3 case-3). */
export const ROW_CLASS_NAME = cn("flex", "min-w-0", "flex-wrap", "items-center", "gap-3");
export const ROW_END_CLASS_NAME = cn("flex", "min-w-0", "flex-wrap", "items-center", "justify-between", "gap-3");
/** A button aligned to the bottom of the fields beside it in a form grid. */
export const FIELD_ACTION_CLASS_NAME = cn("flex", "items-end");
export const FORM_GRID_CLASS_NAME = cn("grid", "grid-cols-1", "gap-3", "sm:grid-cols-2", "lg:grid-cols-4");

/** A list inside a card: one parent declaration draws every seam (BOUNDARY-3 case-1); the card owns the inset. */
export const LIST_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "divide-y", "divide-separator");
export const LIST_ITEM_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-2", "py-3", "sm:flex-row", "sm:items-center", "sm:justify-between");
/** A row of a SurfaceListCard: its own trailing hairline, the last one dropped (BOUNDARY-2 case-1, PADDING-3). */
export const CARD_ROW_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-2", "border-b", "border-separator", "px-4", "py-3", "last:border-b-0", "sm:flex-row", "sm:items-center", "sm:justify-between");
/** A SurfaceListCard row whose content stacks (shift + its swap form). */
export const CARD_ROW_STACK_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-2", "border-b", "border-separator", "px-4", "py-3", "last:border-b-0");
/** The row text and its actions side by side from tablet width. */
export const ROW_SPLIT_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-2", "sm:flex-row", "sm:items-center", "sm:justify-between");

/** Coverage strip: one card per day (GAP-4 case-2). */
export const COVERAGE_CLASS_NAME = cn("grid", "grid-cols-1", "gap-4", "sm:grid-cols-4", "lg:grid-cols-7");
/** Coverage blocks by weekday in the setup card. */
export const COVER_DAYS_CLASS_NAME = cn("grid", "grid-cols-1", "gap-3", "sm:grid-cols-2", "lg:grid-cols-4");
/** Opening hours: one switch row per weekday. */
export const HOURS_GRID_CLASS_NAME = cn("grid", "grid-cols-1", "gap-3", "sm:grid-cols-2");

/**
 * Week grid (people x days).
 * grammar gap: Common has no scheduling grid with droppable cells, so the grid stays app-owned inside a joined
 * SurfaceCard (face, corner, edge) and a HorizontalScrollRegion (overflow); replaced by the day list below md.
 */
export const GRID_FRAME_CLASS_NAME = cn("hidden", "min-w-0", "md:block");
export const GRID_CLASS_NAME = cn("grid", "min-w-225", "grid-cols-8");
/** Header cell: a recessed band with a seam below (SURFACE-3, BOUNDARY-1). */
export const GRID_HEAD_CLASS_NAME = cn("border-b", "border-separator", "bg-surface-secondary", "p-2");
export const GRID_NAME_CLASS_NAME = cn("flex", "flex-col", "justify-center", "gap-1", "border-b", "border-separator", "p-2");
export const GRID_CELL_CLASS_NAME = cn("flex", "min-h-14", "flex-col", "gap-1", "border-b", "border-l", "border-separator", "p-1");
export const GRID_CELL_TARGET_CLASS_NAME = cn("bg-accent-soft");
export const GRID_CELL_OFF_CLASS_NAME = cn("bg-surface-secondary");

/**
 * One shift chip.
 * grammar gap: the chip is a drag source and a pick target, which Button does not publish, so it stays the
 * smallest app-owned button; the position colour is workspace data drawn on its leading edge.
 */
export const CHIP_CLASS_NAME = cn("flex", "w-full", "min-w-0", "flex-col", "gap-1", "rounded-lg", "border", "border-separator", "border-l-4", "bg-surface", "px-2", "py-1", "text-left", "transition-colors");
export const CHIP_PICKED_CLASS_NAME = cn("ring-2", "ring-accent");
export const CHIP_BROKEN_CLASS_NAME = cn("border-danger", "bg-danger-soft");
export const CHIP_OPEN_CLASS_NAME = cn("border-dashed");

/** Day list for phones. */
export const DAYLIST_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-3", "md:hidden");

/** A position colour mark (RADIUS-9 case-1). grammar gap: no Common category swatch; the colour is workspace data. */
export const SWATCH_CLASS_NAME = cn("inline-block", "size-2", "shrink-0", "rounded-full");
