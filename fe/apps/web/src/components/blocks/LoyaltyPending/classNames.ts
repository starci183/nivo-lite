import { cn } from "@heroui/react"

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
    "md:items-start",
    "md:justify-between",
)
/** Row text column (GAP-1). */
export const ROW_MAIN_CLASS_NAME = cn("flex", "min-w-0", "flex-1", "flex-col", "gap-1")
/** Row action column (GAP-2). */
export const ROW_ACTIONS_CLASS_NAME = cn("flex", "shrink-0", "flex-wrap", "items-center", "gap-2")
/** Chips and facts on one wrapping line (GAP-2 case-4). */
export const CHIPS_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-x-2", "gap-y-1")
/** A quoted draft: a recessed neutral band inside a surface. grammar gap: no Common quote/recessed band. */
export const QUOTE_CLASS_NAME = cn(
    "flex",
    "flex-col",
    "gap-1",
    "rounded-xl",
    "bg-surface-secondary",
    "px-3",
    "py-2",
    "text-foreground",
    "break-words",
)
/** Stacked form fields (GAP-3). */
export const FORM_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-3")
