import { cn } from "@heroui/react"

/** Stacked blocks of the tab (GAP-3). */
export const STACK_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-3")
/** Buttons and facts on one wrapping line (GAP-2). */
export const ACTIONS_CLASS_NAME = cn("flex", "shrink-0", "flex-wrap", "items-center", "gap-2")
/** Chips and facts on one wrapping line (GAP-2 case-4). */
export const CHIPS_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-x-2", "gap-y-1")
/** The order board: one lane per status side by side inside a HorizontalScrollRegion (which owns the overflow). */
export const BOARD_CLASS_NAME = cn("flex", "gap-3", "pb-2", "snap-x", "snap-mandatory")
/** One lane: a fixed width on narrow screens, an equal share on wide ones. */
export const LANE_CLASS_NAME = cn("w-72", "min-w-0", "shrink-0", "snap-start", "lg:w-auto", "lg:flex-1")
/** One order inside a lane (BOUNDARY-2 case-1, PADDING-3). */
export const LANE_ROW_CLASS_NAME = cn(
    "flex",
    "min-w-0",
    "flex-col",
    "gap-2",
    "border-b",
    "border-separator",
    "px-4",
    "py-3",
    "last:border-b-0",
)
