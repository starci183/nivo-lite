import { cn } from "@heroui/react"

/** The usage card's vertically arranged sections (GAP-4). */
export const STACK_CLASS_NAME = cn("flex", "flex-col", "gap-4")
/** A sub-section of the usage card: heading over its content (GAP-3). */
export const USAGE_BLOCK_CLASS_NAME = cn("flex", "flex-col", "gap-3")
/** Usage-by-module rows inside the card; List owns the reset. */
export const MODULE_LIST_CLASS_NAME = cn("flex", "flex-col", "gap-3")
/** One module row: a Divider opens every row but the first. */
export const MODULE_ROW_CLASS_NAME = cn("flex", "flex-col", "gap-3")
/** The label and its reading on one wrapping line. */
export const MODULE_LINE_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "justify-between", "gap-2")
/** The canonical chart box. */
export const CHART_CLASS_NAME = cn("h-24", "min-w-0")
/** First and last day under the chart. */
export const CHART_AXIS_CLASS_NAME = cn("flex", "justify-between")
