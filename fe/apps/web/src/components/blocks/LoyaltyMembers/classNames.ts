import { cn } from "@heroui/react"

/** Stack of content inside a card; the card owns the inset, this only stacks (GAP-3). */
export const BODY_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-3")
/** Filters above the member list. */
export const FILTERS_CLASS_NAME = cn("grid", "grid-cols-1", "gap-3", "sm:grid-cols-3")
/** The member detail column (scroll target). */
export const DETAIL_CLASS_NAME = cn("min-w-0")
