import { cn } from "@heroui/react"

/** The cards of the queue, a region step apart (GAP-5). */
export const CARDS_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-6")

/** The parts of one card: the line of badges, the words, the quotes and the actions (GAP-4). */
export const CARD_BODY_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-4")

/** The badges and the dossier of a card wrap on phones (GAP-3, GAP-2 case-3). */
export const CARD_HEAD_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-2")

/** The quotes sit side by side from tablets and stack on phones (GAP-3). */
export const QUOTES_CLASS_NAME = cn("grid", "min-w-0", "grid-cols-1", "gap-2", "sm:grid-cols-2")

/** The actions of a card wrap on phones (GAP-3, GAP-2 case-3). */
export const CARD_ACTIONS_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-2")
