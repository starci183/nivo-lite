import { cn } from "@heroui/react"

/** The unmet needs of a desk, one card each (GAP-4 between peer cards). */
export const NEEDS_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-4")
/** One need: the plate, its words and its action side by side, wrapping on a phone (GAP-3). */
export const NEED_CLASS_NAME = cn("flex", "min-w-0", "flex-wrap", "items-center", "gap-3")
/** The title and the body of one need. */
export const NEED_COPY_CLASS_NAME = cn("flex", "min-w-0", "flex-1", "flex-col", "gap-1")
