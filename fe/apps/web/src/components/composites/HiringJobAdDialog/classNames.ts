import { cn } from "@heroui/react"

/** The three ad blocks, stacked (GAP-3). */
export const GRID_CLASS_NAME = cn("grid", "grid-cols-1", "gap-3")

/** One ad: its heading with the copy button, then the text (GAP-3). */
export const AD_CLASS_NAME = cn("flex", "flex-col", "gap-3")

/** A heading with its action on the right (GAP-2). */
export const HEAD_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "justify-between", "gap-2")

// grammar gap: Text has no prop that keeps the line breaks of an ad written over several lines.
/** Keeps the author's line breaks; the Text inside inherits it. */
export const PRE_WRAP_CLASS_NAME = cn("whitespace-pre-wrap")
