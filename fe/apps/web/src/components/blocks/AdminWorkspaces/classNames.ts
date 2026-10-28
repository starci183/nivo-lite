import { cn } from "@heroui/react"

/** Search form and filter links (GAP-3 case-3). */
export const FILTERS_CLASS_NAME = cn("flex", "flex-wrap", "items-end", "gap-3")

/** Search field beside its submit action (GAP-3 case-1). */
export const SEARCH_FORM_CLASS_NAME = cn("flex", "flex-wrap", "items-end", "gap-3")

/** Filter links row (GAP-2). */
export const CHIPS_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-2")

/** A table cell holding a value and its qualifier (GAP-1). */
export const CELL_STACK_CLASS_NAME = cn("flex", "flex-col", "items-start", "gap-1")

/** Badges inside a table cell (GAP-1, dense). */
export const BADGE_WRAP_CLASS_NAME = cn("flex", "flex-wrap", "gap-1")

/** Blocks inside one region (GAP-4). */
export const STACK_CLASS_NAME = cn("flex", "flex-col", "gap-4")

/** The filters and the list region stacked in the page body (GAP-5). */
export const PAGE_CLASS_NAME = cn("flex", "flex-col", "gap-6")
