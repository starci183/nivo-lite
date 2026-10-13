import { cn } from "@heroui/react"

/** One list row inside a SurfaceListCard: its own trailing hairline, the last one dropped. */
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
    "md:items-start",
    "md:justify-between",
)
/** Row text column. */
export const ROW_MAIN_CLASS_NAME = cn("flex", "min-w-0", "flex-1", "flex-col", "gap-1")
/** Row action column. */
export const ROW_ACTIONS_CLASS_NAME = cn("flex", "shrink-0", "flex-wrap", "items-center", "gap-2")
/** Chips and facts on one wrapping line. */
export const CHIPS_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-x-2", "gap-y-1")
