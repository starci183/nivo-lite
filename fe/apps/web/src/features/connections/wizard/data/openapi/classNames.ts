import { cn } from "@heroui/react"

/** Fields of one step: one column, GAP-4. */
export const COLUMN_CLASS = cn("flex", "min-w-0", "flex-col", "gap-4")
/** A long list of operations: scrolls inside the drawer instead of stretching it. */
export const LIST_CLASS = cn("flex", "min-w-0", "max-h-96", "flex-col", "gap-3", "overflow-y-auto")
/** One operation row and its settings. */
export const ROW_CLASS = cn("flex", "min-w-0", "flex-col", "gap-3")
/** Settings of a ticked operation, indented under its checkbox. */
export const NESTED_CLASS = cn("flex", "min-w-0", "flex-col", "gap-3", "ps-6")
