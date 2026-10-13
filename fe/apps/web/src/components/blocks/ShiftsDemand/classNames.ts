import { cn } from "@heroui/react"

/** Stacked blocks inside the card (GAP-3). */
export const BLOCK_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-3")

/** A wrapping row of controls (GAP-3 case-3). */
export const ROW_CLASS_NAME = cn("flex", "min-w-0", "flex-wrap", "items-center", "gap-3")

/** The form fields in a grid that opens up with width (GAP-4 case-2). */
export const FORM_GRID_CLASS_NAME = cn("grid", "grid-cols-1", "gap-3", "sm:grid-cols-2", "lg:grid-cols-5")

/** Coverage blocks by weekday in the card. */
export const DAYS_CLASS_NAME = cn("grid", "grid-cols-1", "gap-3", "sm:grid-cols-2", "lg:grid-cols-4")

/** A weekday over its blocks (GAP-1). */
export const STACK_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-1")
