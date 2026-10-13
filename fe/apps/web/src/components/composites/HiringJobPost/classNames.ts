import { cn } from "@heroui/react"

/** The head of the post: company, title, facts (GAP-1). */
export const HEAD_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-1")

/** The facts as plain badges (GAP-2). */
export const FACTS_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-2")

/** The inside of the description card, stacked (GAP-4). */
export const CARD_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-4")

/** One list with its title (GAP-2). */
export const LIST_BLOCK_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-2")

// grammar gap: Text has no prop that keeps the line breaks of a description written over several lines.
/** Keeps the author's line breaks; the Text inside inherits it. */
export const PRE_WRAP_CLASS_NAME = cn("whitespace-pre-wrap", "break-words")
