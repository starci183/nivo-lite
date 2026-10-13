import { cn } from "@heroui/react"

/** Stacked blocks of the tab (GAP-3). */
export const STACK_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-3")
/** One list row inside a SurfaceListCard: its own trailing hairline, the last one dropped (BOUNDARY-2 case-1, PADDING-3). */
export const ROW_CLASS_NAME = cn(
    "flex",
    "flex-col",
    "gap-3",
    "border-b",
    "border-separator",
    "px-4",
    "py-3",
    "last:border-b-0",
    "md:flex-row",
    "md:items-center",
    "md:justify-between",
)
/** Row text column (GAP-1). */
export const ROW_MAIN_CLASS_NAME = cn("flex", "min-w-0", "flex-1", "flex-col", "gap-1")
/** Chips and facts on one wrapping line (GAP-2 case-4). */
export const CHIPS_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-x-2", "gap-y-1")
/** The search and filter bar. */
export const TOOLBAR_CLASS_NAME = cn("flex", "flex-col", "gap-2", "md:flex-row", "md:items-end", "md:justify-between")
/** The search field of the bar. */
export const TOOLBAR_FIELD_CLASS_NAME = cn("min-w-0", "md:w-80")
