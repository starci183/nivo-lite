import { cn } from "@heroui/react"

/** Blocks inside one automation card (GAP-3). */
export const CARD_STACK_CLASS = cn("flex", "min-w-0", "flex-col", "gap-3")
/** The icon tile beside the text. */
export const CARD_TOP_CLASS = cn("flex", "min-w-0", "items-start", "gap-3")
/** The name and the badge. */
export const CARD_TEXT_CLASS = cn("flex", "min-w-0", "flex-1", "flex-col", "gap-1")
/** The row under the card text: the detail action and the switch. */
export const CARD_FOOT_CLASS = cn("flex", "flex-wrap", "items-center", "justify-between", "gap-2")
/** A row of badges. */
export const ACTIONS_CLASS = cn("flex", "flex-wrap", "items-center", "gap-2")
