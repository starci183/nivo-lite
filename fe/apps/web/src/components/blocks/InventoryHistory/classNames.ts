import { cn } from "@heroui/react"

/** Stacked blocks of the tab (GAP-3). */
export const STACK_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-3")
/** The search and filter bar. */
export const TOOLBAR_CLASS_NAME = cn("flex", "flex-col", "gap-2", "md:flex-row", "md:items-end", "md:justify-between")
/** The search field of the bar. */
export const TOOLBAR_FIELD_CLASS_NAME = cn("min-w-0", "md:w-80")
