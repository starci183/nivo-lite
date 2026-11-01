import { cn } from "@heroui/react"

/** The heading, the filters and the list, a region step apart (GAP-5). */
export const TODO_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-6")

/** The two filters sit on one line while both fit and wrap under each other when they do not (GAP-3). */
export const FILTERS_CLASS_NAME = cn("flex", "min-w-0", "flex-wrap", "items-end", "justify-between", "gap-4")

/** The list under its filters (GAP-4). */
export const LIST_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-4")
