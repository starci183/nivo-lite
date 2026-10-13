import { cn } from "@heroui/react"

/** Stacked blocks inside the card (GAP-3). */
export const BLOCK_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-3")

/** A wrapping row of controls (GAP-3 case-3). */
export const ROW_CLASS_NAME = cn("flex", "min-w-0", "flex-wrap", "items-center", "gap-3")

/** The form fields in a grid that opens up with width (GAP-4 case-2). */
export const FORM_GRID_CLASS_NAME = cn("grid", "grid-cols-1", "gap-3", "sm:grid-cols-2", "lg:grid-cols-4")

/** A list inside a card: one parent declaration draws every seam (BOUNDARY-3 case-1); the card owns the inset. */
export const LIST_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "divide-y", "divide-separator")

/** A person of the list: identity and the edit button, side by side from tablet width. */
export const LIST_ITEM_CLASS_NAME = cn(
    "flex",
    "min-w-0",
    "flex-col",
    "gap-2",
    "py-3",
    "sm:flex-row",
    "sm:items-center",
    "sm:justify-between",
)
