import { cn } from "@heroui/react"

/** Blocks inside the card (GAP-4). */
export const STACK_CLASS = cn("flex", "min-w-0", "flex-col", "gap-4")
/** Key name field and the create action side by side (GAP-3 case-1). */
export const FORM_ROW_CLASS = cn("flex", "min-w-0", "flex-col", "gap-3", "sm:flex-row", "sm:items-end")
/** The field takes the remaining width. */
export const FIELD_GROW_CLASS = cn("min-w-0", "flex-1")
/** API key rows inside the card: one parent declaration draws every seam (BOUNDARY-3); List owns the reset. */
export const KEY_LIST_CLASS = cn("flex", "min-w-0", "flex-col", "divide-y", "divide-separator")
/** One key row between separators (PADDING-3 case-3); outer rows meet the band edge (PADDING-0). */
export const KEY_ROW_CLASS = cn(
    "flex",
    "flex-wrap",
    "items-center",
    "gap-x-4",
    "gap-y-3",
    "py-3",
    "first:pt-0",
    "last:pb-0",
)
/** Name, prefix and dates of one key (GAP-1). */
export const KEY_MAIN_CLASS = cn("flex", "min-w-0", "flex-1", "basis-64", "flex-col", "gap-1")
/** Status badge and revoke action (GAP-2). */
export const ACTIONS_CLASS = cn("flex", "flex-wrap", "items-center", "gap-2")
