import { cn } from "@heroui/react"

/** One heading over its list (GAP-3). */
export const SECTION_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-3")

/** A row of a SurfaceListCard: its own trailing hairline, the last one dropped (BOUNDARY-2 case-1, PADDING-3); text and action side by side from tablet width. */
export const ROW_CLASS_NAME = cn(
    "flex",
    "min-w-0",
    "flex-col",
    "gap-2",
    "border-b",
    "border-separator",
    "px-4",
    "py-3",
    "last:border-b-0",
    "sm:flex-row",
    "sm:items-center",
    "sm:justify-between",
)
