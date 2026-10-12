import { cn } from "@heroui/react";

/** One list row inside a SurfaceListCard: divided (BOUNDARY-2 case-1, PADDING-4/PADDING-3), stacks on phones, spreads on wide screens. */
export const ROW_CLASS_NAME = cn("flex", "flex-col", "gap-3", "border-b", "border-separator", "px-4", "py-3", "last:border-b-0", "md:flex-row", "md:items-start", "md:justify-between");
/** The row opened from the Attention surface: a recessed neutral band (SURFACE-3 case-1, no Grammar owner for a row highlight). */
export const ROW_FOCUSED_CLASS_NAME = cn(ROW_CLASS_NAME, "bg-surface-secondary");
/** Row text column (GAP-1: lines that qualify one identity). */
export const ROW_MAIN_CLASS_NAME = cn("flex", "min-w-0", "flex-1", "flex-col", "gap-1");
/** Row action column (GAP-2 case-3). */
export const ROW_ACTIONS_CLASS_NAME = cn("flex", "shrink-0", "flex-wrap", "items-center", "gap-2");
/** Chips and facts on one wrapping line (GAP-2 inline, GAP-1 between wrapped lines). */
export const CHIPS_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-x-2", "gap-y-1");
/** Stacked form fields inside a row or dialog (GAP-3). */
export const FORM_CLASS_NAME = cn("flex", "flex-col", "gap-3");

/** The board: five stage lanes side by side; the scroll region owns the sideways overflow (GAP-3 between peer lanes). */
export const BOARD_CLASS_NAME = cn("flex", "min-w-full", "gap-3", "pb-2");
/** One lane column: a fixed 16rem track on narrow screens, an equal share on wide ones. */
export const LANE_CLASS_NAME = cn("flex", "w-64", "shrink-0", "flex-col", "lg:w-auto", "lg:min-w-0", "lg:flex-1");
/** A deal row inside a lane (BOUNDARY-2 case-1, PADDING-3 between separators, GAP-2 inside). */
export const DEAL_ROW_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-2", "border-b", "border-separator", "px-4", "py-3", "last:border-b-0");
