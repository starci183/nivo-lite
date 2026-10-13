import { cn } from "@heroui/react"

/** One band of the detail with its own leading seam. */
export const SECTION_CLASS = cn("flex", "min-w-0", "flex-col", "gap-3", "border-t", "border-separator", "pt-4")
/** Lines of facts under a heading. */
export const FACTS_CLASS = cn("flex", "flex-col", "gap-1")
/** A copy whose authored line breaks must survive. */
export const PRESERVE_LINES_CLASS = cn("whitespace-pre-line", "break-words")
/** One separator between rows, none at the edges. */
export const ROWS_CLASS = cn("divide-y", "divide-separator")
/** One run row. */
export const RUN_ROW_CLASS = cn("flex", "flex-col", "gap-1", "py-2")
/** The badge, the time and the link of a run. */
export const RUN_HEAD_CLASS = cn("flex", "flex-wrap", "items-center", "gap-2")
