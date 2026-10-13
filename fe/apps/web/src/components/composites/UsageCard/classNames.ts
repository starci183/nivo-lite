import { cn } from "@heroui/react"

/** The usage card's vertically arranged sections (GAP-4). */
export const STACK_CLASS_NAME = cn("flex", "flex-col", "gap-4")
/** A sub-section of the usage card: heading over its content (GAP-3). */
export const USAGE_BLOCK_CLASS_NAME = cn("flex", "flex-col", "gap-3")
/** Usage-by-module rows inside the card: one parent declaration draws every seam (BOUNDARY-3); List owns the reset. */
export const MODULE_LIST_CLASS_NAME = cn("flex", "flex-col", "divide-y", "divide-separator")
/** One module row between separators (PADDING-3 case-3); outer rows meet the band edge (PADDING-0). */
export const MODULE_ROW_CLASS_NAME = cn(
    "flex",
    "flex-wrap",
    "items-center",
    "justify-between",
    "gap-2",
    "py-3",
    "first:pt-0",
    "last:pb-0",
)
/** The canonical chart inherits the semantic accent for its bars. */
export const CHART_CLASS_NAME = cn("h-24", "min-w-0", "text-accent")
/** First and last day under the chart. */
export const CHART_AXIS_CLASS_NAME = cn("flex", "justify-between")
