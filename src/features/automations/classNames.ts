import { cn } from "@heroui/react"

/** Page regions under the page heading (GAP-5). */
export const PAGE_CLASS = cn("flex", "flex-col", "gap-6")
/** A one-line action row under the page content (GAP-2). */
export const LINK_ROW_CLASS = cn("flex", "flex-wrap", "items-center", "gap-2")

/** Dense peer cards of one collection in a grid (GAP-3). */
export const GRID_CLASS = cn("grid", "grid-cols-1", "gap-3", "sm:grid-cols-2", "lg:grid-cols-1", "2xl:grid-cols-2")
export const GRID_WIDE_CLASS = cn("grid", "grid-cols-1", "gap-3", "sm:grid-cols-2", "xl:grid-cols-3")
export const SOLO_CLASS = cn("flex", "min-w-0", "flex-col", "gap-4")
export const LIST_CLASS = cn("flex", "flex-col", "gap-2")

/** Blocks inside one automation card (GAP-3). */
export const CARD_STACK_CLASS = cn("flex", "min-w-0", "flex-col", "gap-3")
export const CARD_TOP_CLASS = cn("flex", "min-w-0", "items-start", "gap-3")
export const CARD_TEXT_CLASS = cn("flex", "min-w-0", "flex-1", "flex-col", "gap-1")
export const CARD_FOOT_CLASS = cn("flex", "flex-wrap", "items-center", "justify-between", "gap-2")

/** The detail panel follows the reader on wide screens. */
export const DETAIL_CLASS = cn("min-w-0", "lg:sticky", "lg:top-4")
/** Blocks inside the detail surface (GAP-5). */
export const DETAIL_STACK_CLASS = cn("flex", "min-w-0", "flex-col", "gap-6")
/** One band of the detail with its own leading seam (BOUNDARY-1 case-2; PADDING-4 above it). */
export const SECTION_CLASS = cn("flex", "min-w-0", "flex-col", "gap-3", "border-t", "border-separator", "pt-4")
export const FIELDS_CLASS = cn("flex", "flex-col", "gap-3")
export const ACTIONS_CLASS = cn("flex", "flex-wrap", "items-center", "gap-2")
export const FACTS_CLASS = cn("flex", "flex-col", "gap-1")
/** A copy whose authored line breaks must survive (text-flow: the app-owned region keeps the owner's lines). */
export const PRESERVE_LINES_CLASS = cn("whitespace-pre-line", "break-words")

/** Runs and hidden automations: one separator between rows, none at the edges (BOUNDARY-3 case-1). */
export const ROWS_CLASS = cn("divide-y", "divide-separator")
/** One run row, separator-facing inset (PADDING-2 block, compact history). */
export const RUN_ROW_CLASS = cn("flex", "flex-col", "gap-1", "py-2")
export const RUN_HEAD_CLASS = cn("flex", "flex-wrap", "items-center", "gap-2")
export const HIDDEN_ROW_CLASS = cn("flex", "flex-wrap", "items-center", "justify-between", "gap-2", "py-2")
