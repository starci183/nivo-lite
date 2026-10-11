import { cn } from "@heroui/react";

/** Vertical rhythm of the Hiring workbench: figures, tabs, panel (GAP-4; PADDING-9 block inset at the compact step). */
export const PAGE_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-4", "py-2", "md:py-4");
export const PANEL_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-4", "focus-visible:outline-2", "focus-visible:outline-focus");

/** A section heading with its action on the right (GAP-2). */
export const SECTION_HEAD_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "justify-between", "gap-2");
/** One row inside a SurfaceListCard (BOUNDARY-2 case-1, PADDING-4 inline / PADDING-3 block). */
export const ROW_CLASS_NAME = cn("flex", "flex-col", "gap-3", "border-b", "border-separator", "px-4", "py-3", "last:border-b-0", "md:flex-row", "md:items-start", "md:justify-between");
export const ROW_MAIN_CLASS_NAME = cn("flex", "min-w-0", "flex-1", "flex-col", "gap-1");
export const ROW_ACTIONS_CLASS_NAME = cn("flex", "shrink-0", "flex-wrap", "items-center", "gap-2");
export const CHIPS_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-x-2", "gap-y-1");
export const FORM_CLASS_NAME = cn("flex", "flex-col", "gap-3");
export const FORM_GRID_CLASS_NAME = cn("grid", "grid-cols-1", "gap-3", "md:grid-cols-2");
/** A question line and its answer, or an event and its actor (GAP-1). */
export const PAIR_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-1");

/** The pipeline board: one lane per stage; the scroll region owns the sideways overflow. Hidden on phones, where the pipeline is a list. */
export const BOARD_CLASS_NAME = cn("flex", "min-w-full", "gap-3", "pb-2");
export const BOARD_FRAME_CLASS_NAME = cn("hidden", "md:block");
/** One lane column: a fixed 15rem track on narrow screens, an equal share on wide ones. */
export const LANE_CLASS_NAME = cn("flex", "w-60", "shrink-0", "flex-col", "xl:w-auto", "xl:min-w-0", "xl:flex-1");
/** The lane a card is dragged over: the focus outline marks the drop target (no Grammar drop-target state). */
export const LANE_OVER_CLASS_NAME = cn(LANE_CLASS_NAME, "outline-2", "outline-accent");
/** A candidate row inside a lane (BOUNDARY-2 case-1, PADDING-3, GAP-2 inside). */
export const CARD_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-2", "border-b", "border-separator", "px-4", "py-3", "last:border-b-0");
export const CARD_DRAG_CLASS_NAME = cn(CARD_CLASS_NAME, "cursor-grab", "active:cursor-grabbing");
/** The phone pipeline: stages stacked as a list. */
export const PIPELINE_LIST_CLASS_NAME = cn("flex", "flex-col", "gap-4", "md:hidden");

/** The week calendar: seven day columns on wide screens, a plain agenda on phones (GAP-2 between day columns). */
export const WEEK_CLASS_NAME = cn("grid", "grid-cols-1", "gap-2", "md:grid-cols-7");
/** One interview inside a day (BOUNDARY-2 case-1, PADDING-3). */
export const SLOT_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-1", "border-b", "border-separator", "p-3", "last:border-b-0");

export const SCORE_CLASS_NAME = cn("flex", "items-baseline", "gap-2");
export const REASON_CLASS_NAME = cn("flex", "items-start", "gap-2");
export const REASONS_CLASS_NAME = cn("flex", "flex-col", "gap-2");
/** The PDF viewport inside its MediaFrame. */
export const CV_FRAME_CLASS_NAME = cn("size-full");
export const AD_GRID_CLASS_NAME = cn("grid", "grid-cols-1", "gap-3");
// grammar gap: Text has no prop that keeps the line breaks of user-supplied multi-line copy (ads, letters, summaries).
/** Keeps the author's line breaks; the Text inside inherits it. */
export const PRE_WRAP_CLASS_NAME = cn("whitespace-pre-wrap");
