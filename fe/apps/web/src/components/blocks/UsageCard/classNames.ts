import { cn } from "@heroui/react"

/** Blocks inside one card (GAP-4). */
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
// grammar gap: Common publishes no bar chart; the daily token chart stays an app-owned figure (role="img" with a text name) on semantic tokens only.
/** Chart track: bars side by side on the axis. */
export const CHART_CLASS_NAME = cn("flex", "h-24", "items-end", "gap-1")
/** One day's slot. */
export const BAR_SLOT_CLASS_NAME = cn("flex", "h-full", "min-w-0", "flex-1", "items-end")
/** A bar: block start rounded at the smallest ramp step because its end runs into the axis (RADIUS-2 corner variant). */
export const BAR_CLASS_NAME = cn("w-full", "rounded-t-sm", "bg-accent")
/** First and last day under the chart. */
export const CHART_AXIS_CLASS_NAME = cn("flex", "justify-between")
