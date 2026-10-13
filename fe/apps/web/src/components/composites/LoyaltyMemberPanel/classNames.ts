import { cn } from "@heroui/react"

/** Stacked cards of the detail column (GAP-3). */
export const STACK_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-3")
/** Stack of content inside a card; the card owns the inset, this only stacks (GAP-3). */
export const BODY_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-3")
/** Chips and facts on one wrapping line (GAP-2 case-4). */
export const CHIPS_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-x-2", "gap-y-1")
