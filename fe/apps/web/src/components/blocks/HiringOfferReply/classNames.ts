import { cn } from "@heroui/react"

/** The inside of the card, stacked (GAP-4 case-3). */
export const CARD_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-4")

/** The candidate's answer choices, stacked (GAP-2). */
export const ANSWERS_CLASS_NAME = cn("flex", "flex-col", "gap-2")

// grammar gap: Text has no prop that keeps the line breaks of a letter written over several lines.
/** Keeps the author's line breaks; the Text inside inherits it. */
export const PRE_WRAP_CLASS_NAME = cn("whitespace-pre-wrap", "break-words")
