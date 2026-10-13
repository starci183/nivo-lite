import { cn } from "@heroui/react"

/** Blocks inside the card (GAP-4). */
export const STACK_CLASS_NAME = cn("flex", "flex-col", "gap-4")

/** Support action rows (GAP-3). */
export const ACTIONS_CLASS_NAME = cn("flex", "flex-col", "gap-3")

/** One support action: field and button side by side (GAP-3 case-1). */
export const ACTION_ROW_CLASS_NAME = cn("flex", "flex-wrap", "items-end", "gap-3")
