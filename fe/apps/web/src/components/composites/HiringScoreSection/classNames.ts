import { cn } from "@heroui/react"

/** The score number with its label (GAP-2). */
export const SCORE_CLASS_NAME = cn("flex", "items-baseline", "gap-2")

/** One screening line: a badge and its words (GAP-2). */
export const REASON_CLASS_NAME = cn("flex", "items-start", "gap-2")

/** The screening lines, stacked (GAP-2). */
export const REASONS_CLASS_NAME = cn("flex", "flex-col", "gap-2")

/** A criterion and its note (GAP-1). */
export const PAIR_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-1")

/** A row of commands (GAP-2). */
export const ACTIONS_CLASS_NAME = cn("flex", "shrink-0", "flex-wrap", "items-center", "gap-2")

// grammar gap: Text has no prop that keeps the line breaks of a summary written over several lines.
/** Keeps the author's line breaks; the Text inside inherits it. */
export const PRE_WRAP_CLASS_NAME = cn("whitespace-pre-wrap")
