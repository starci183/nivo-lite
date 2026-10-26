import { cn } from "@heroui/react"

/** Blocks inside the card (GAP-4). */
export const STACK_CLASS = cn("flex", "min-w-0", "flex-col", "gap-4")
/** Key name field and the create action side by side (GAP-3 case-1). */
export const FORM_ROW_CLASS = cn("flex", "min-w-0", "flex-col", "gap-3", "sm:flex-row", "sm:items-end")
/** The field takes the remaining width. */
export const FIELD_GROW_CLASS = cn("min-w-0", "flex-1")
