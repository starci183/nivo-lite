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
/** Stack of content inside a card; the card owns the inset (PADDING-4 case-2), this only stacks (GAP-3). */
export const BODY_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-3")
/** Two fields side by side from tablet width. */
export const FIELD_PAIR_CLASS_NAME = cn("grid", "grid-cols-1", "gap-3", "sm:grid-cols-2")
/** The segment checkboxes on one wrapping line. */
export const CHECKS_CLASS_NAME = cn("flex", "flex-wrap", "gap-x-6", "gap-y-2")
