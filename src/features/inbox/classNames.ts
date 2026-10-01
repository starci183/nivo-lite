import { cn } from "@heroui/react"

/** Vertical rhythm between the header, alert, simulator and feed. */
export const PAGE_CLASS = cn("flex", "flex-col", "gap-6")

/** Stack inside a card. */
export const STACK_CLASS = cn("flex", "flex-col", "gap-4")

/** Preset button row, wrapping on phones. */
export const PRESETS_CLASS = cn("flex", "flex-wrap", "gap-2")

/** Two-column form grid. */
export const FORM_GRID_CLASS = cn("grid", "grid-cols-1", "gap-4", "md:grid-cols-2")

/** Field spanning both columns. */
export const FORM_WIDE_CLASS = cn("md:col-span-2")

/** Event id field with its "new code" action, aligned to the input's baseline. */
export const EVENT_ID_ROW_CLASS = cn("flex", "items-end", "gap-2", "md:col-span-2")

/** The event id input grows; the action keeps its width. */
export const EVENT_ID_INPUT_CLASS = cn("min-w-0", "flex-1")

/** Submit row. */
export const SUBMIT_ROW_CLASS = cn("flex", "justify-end", "md:col-span-2")

/** Result line links. */
export const RESULT_LINKS_CLASS = cn("flex", "flex-wrap", "items-center", "gap-4")

/** Feed list. */
export const FEED_LIST_CLASS = cn("m-0", "flex", "list-none", "flex-col", "p-0")

/** One feed row. */
export const FEED_ITEM_CLASS = cn("flex", "flex-col", "gap-2", "border-b", "border-separator", "py-4", "last:border-b-0")

/** Top line of a row: channel and kind, badges. */
export const FEED_HEAD_CLASS = cn("flex", "flex-wrap", "items-center", "justify-between", "gap-2")

/** Channel + kind cluster. */
export const FEED_TITLE_CLASS = cn("flex", "min-w-0", "flex-wrap", "items-center", "gap-x-2", "gap-y-1")

/** Badge cluster. */
export const FEED_BADGES_CLASS = cn("flex", "flex-wrap", "items-center", "gap-2")

/** Meta line: sender, amount, reference. */
export const FEED_META_CLASS = cn("flex", "flex-wrap", "items-center", "gap-x-4", "gap-y-1")

/** Row footer: duplicates and links. */
export const FEED_FOOT_CLASS = cn("flex", "flex-wrap", "items-center", "gap-x-4", "gap-y-1")

/** Feed header with the refresh action. */
export const FEED_HEADER_CLASS = cn("flex", "flex-wrap", "items-start", "justify-between", "gap-3")

/** Tight stack inside the bank connection card. */
export const STACK_TIGHT_CLASS = cn("flex", "flex-col", "gap-2")

/** Bank name, masked account and the simulated chip on one wrapping line. */
export const BANK_HEAD_CLASS = cn("flex", "flex-wrap", "items-center", "gap-x-3", "gap-y-1")
