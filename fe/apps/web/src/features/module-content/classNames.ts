import { cn } from "@heroui/react";

/** Vertical rhythm of the workbench: figures, actions, tabs, panel (GAP-4). */
export const PAGE_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-4", "py-2", "md:py-4");
/** The panel under the tabs (GAP-3). */
export const PANEL_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-3", "focus-visible:outline-2", "focus-visible:outline-focus");
/** A wrapping row of actions (GAP-2 case-3). */
export const TOOLBAR_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-2");

/** One list row inside a SurfaceListCard: its own trailing hairline, the last one dropped (BOUNDARY-2 case-1, PADDING-3). */
export const ROW_CLASS_NAME = cn("flex", "flex-col", "gap-2", "border-b", "border-separator", "px-4", "py-3", "last:border-b-0", "md:flex-row", "md:items-start", "md:justify-between");
/** Row text column (GAP-1). */
export const ROW_MAIN_CLASS_NAME = cn("flex", "min-w-0", "flex-1", "flex-col", "gap-1");
/** Row action column (GAP-2). */
export const ROW_ACTIONS_CLASS_NAME = cn("flex", "shrink-0", "flex-wrap", "items-center", "gap-2");
/** Chips and facts on one wrapping line (GAP-2 case-4). */
export const CHIPS_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-x-2", "gap-y-1");
/** A quoted channel text: a recessed neutral band. grammar gap: no Common quote/recessed band (SURFACE-3 case-1 owner is "—"). */
export const QUOTE_CLASS_NAME = cn("flex", "flex-col", "gap-1", "rounded-xl", "bg-surface-secondary", "px-3", "py-2", "text-foreground", "whitespace-pre-wrap", "break-words");
/** Stacked form fields (GAP-3). */
export const FORM_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-3");
/** Two fields side by side from tablet width. */
export const FORM_ROW_CLASS_NAME = cn("grid", "grid-cols-1", "gap-3", "sm:grid-cols-2");

/** Month grid: seven columns on wide screens; on phones the agenda list replaces it. */
export const GRID_WRAP_CLASS_NAME = cn("hidden", "min-w-0", "flex-col", "gap-2", "md:flex");
export const AGENDA_WRAP_CLASS_NAME = cn("md:hidden");
/**
 * grammar gap: Common has no scheduling month grid with droppable day cells (Calendar is a date picker),
 * so the grid and its cells stay app-owned inside a joined SurfaceCard (which owns the face, corner and edge).
 */
export const GRID_CLASS_NAME = cn("grid", "grid-cols-7");
/** Weekday header cell: a recessed band with a seam below it (SURFACE-3, BOUNDARY-1). */
export const GRID_HEAD_CLASS_NAME = cn("flex", "justify-center", "border-b", "border-separator", "bg-surface-secondary", "px-2", "py-1");
/** One day cell; the seventh column drops its inline seam (BOUNDARY-4 case-2). */
export const CELL_CLASS_NAME = cn("flex", "min-h-28", "min-w-0", "flex-col", "gap-1", "border-b", "border-r", "border-separator", "p-1", "[&:nth-child(7n)]:border-r-0");
export const CELL_OUT_CLASS_NAME = cn("bg-surface-secondary");
export const CELL_TODAY_CLASS_NAME = cn("bg-accent-soft");
export const CELL_DROP_CLASS_NAME = cn("outline-2", "outline-accent", "-outline-offset-2");
/** grammar gap: a draggable post chip (Button has no drag source), so the chip is the smallest app-owned button. */
export const CHIP_CLASS_NAME = cn("flex", "min-w-0", "cursor-grab", "flex-col", "rounded-lg", "bg-surface-secondary", "px-2", "py-1", "text-left", "hover:bg-default", "focus-visible:outline-2", "focus-visible:outline-focus", "active:cursor-grabbing");
export const CHIP_SKIPPED_CLASS_NAME = cn("opacity-50");

/** Media tiles of the editor (GAP-2 grid). */
export const MEDIA_GRID_CLASS_NAME = cn("grid", "grid-cols-2", "gap-2", "sm:grid-cols-3");
/** One media tile: the frame, its name and its action stacked (GAP-1). */
export const MEDIA_TILE_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-1");
/** The weekday choice spans both columns of the cadence form row. */
export const DAYS_FIELD_CLASS_NAME = cn("min-w-0", "sm:col-span-2");
