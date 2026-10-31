import { cn } from "@heroui/react"

/** One source: its word, the words it gave and its byline, stacked (GAP-1). */
export const SOURCE_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-1")
/** The approver's mark and name side by side (GAP-2). */
export const WHO_CLASS_NAME = cn("flex", "min-w-0", "items-center", "gap-2")
/** The decision and the link to the map, wrapping on a phone (GAP-3). */
export const FOOTER_CLASS_NAME = cn("flex", "min-w-0", "flex-wrap", "items-center", "gap-3")
