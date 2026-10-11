import { cn } from "@heroui/react"

/** Page regions stacked under the page heading (GAP-5). */
export const PAGE_CLASS = cn("flex", "flex-col", "gap-6")
/** Blocks inside one provider card (GAP-4). */
export const STACK_CLASS = cn("flex", "min-w-0", "flex-col", "gap-4")
/** The connection rows of one provider: one separator between rows, none at the edges (BOUNDARY-3 case-1; List resets margin, padding and marker). */
export const ROWS_CLASS = cn("divide-y", "divide-separator")
/** One connection row: separator-facing block inset (PADDING-3 case-3), inline companions on GAP-4, wrapped lines on GAP-3. */
export const ROW_CLASS = cn("flex", "flex-wrap", "items-center", "gap-x-4", "gap-y-3", "py-3")
export const ROW_MAIN_CLASS = cn("flex", "min-w-0", "flex-1", "basis-64", "flex-col", "gap-1")
/** Adjacent inline actions and chips (GAP-2). */
export const ACTIONS_CLASS = cn("flex", "flex-wrap", "items-center", "gap-2")
/** A row-wide slot (a nested panel or an alert) that breaks onto its own line inside the wrapping row. */
export const FULL_CLASS = cn("w-full", "min-w-0")
/** Content stacked inside a nested panel (GAP-3). */
export const PANEL_CLASS = cn("flex", "min-w-0", "flex-col", "gap-3")
export const HEAD_CLASS = cn("flex", "flex-wrap", "items-center", "justify-between", "gap-3")
