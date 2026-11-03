import { cn } from "@heroui/react"

/** The cards of the block, a region step apart (GAP-5). */
export const BLOCK_CLASS_NAME: string | undefined = cn("flex", "min-w-0", "flex-col", "gap-6")

/** The words and fields inside one card (GAP-4). */
export const CARD_CLASS_NAME: string | undefined = cn("flex", "flex-col", "gap-4")

/** The buttons of a card, wrapping on phones (GAP-3). */
export const ACTIONS_CLASS_NAME: string | undefined = cn("flex", "flex-wrap", "items-center", "gap-2")
