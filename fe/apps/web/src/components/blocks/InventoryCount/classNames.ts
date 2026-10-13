import { cn } from "@heroui/react"

/** Stacked blocks of the tab (GAP-3). */
export const STACK_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-3")
/** Row text column (GAP-1). */
export const ROW_MAIN_CLASS_NAME = cn("flex", "min-w-0", "flex-1", "flex-col", "gap-1")
/** The stock-take row: name over unit, count field to the right (thumb reach on a phone; BOUNDARY-2 case-1). */
export const COUNT_ROW_CLASS_NAME = cn(
    "flex",
    "items-center",
    "justify-between",
    "gap-3",
    "border-b",
    "border-separator",
    "px-4",
    "py-3",
    "last:border-b-0",
)
/** The count field of a row. */
export const COUNT_FIELD_CLASS_NAME = cn("w-28", "shrink-0")
