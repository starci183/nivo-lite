import { cn } from "@heroui/react"

/** Page regions under the page heading (GAP-5). */
export const PAGE_CLASS = cn("flex", "min-w-0", "flex-col", "gap-6")
/** Blocks inside one card (GAP-4). */
export const STACK_CLASS = cn("flex", "min-w-0", "flex-col", "gap-4")
/** Adjacent inline actions and chips (GAP-2). */
export const ROW_WRAP_CLASS = cn("flex", "flex-wrap", "items-center", "gap-2")
/** Breadcrumb trail above the page heading: one heading block (GAP-2). */
export const HEAD_CLASS = cn("flex", "min-w-0", "flex-col", "gap-2")
/** The module filter keeps a control-sized width instead of stretching across the column (MEASURE-4 case-2). */
export const FILTER_CLASS = cn("w-full", "max-w-xs")
export const SIDE_CLASS = cn("flex", "min-w-0", "flex-col", "gap-6")
/** Rows of one collection inside a card: one separator between rows, none at the edges (BOUNDARY-3 case-1). */
export const LIST_CLASS = cn("divide-y", "divide-separator")
/** One row: separator-facing inset (PADDING-3), the first and last rows meet the card inset instead (PADDING-0). */
export const ITEM_CLASS = cn("flex", "min-w-0", "flex-wrap", "items-center", "justify-between", "gap-x-4", "gap-y-2", "py-3", "first:pt-0", "last:pb-0")
/** One source row inside the Grammar list card: BOUNDARY-2 case-1 (its own trailing seam, the last drops it) with the PADDING-4 inline / PADDING-3 block band inset. */
export const SOURCE_ROW_CLASS = cn("flex", "min-w-0", "flex-wrap", "items-center", "justify-between", "gap-x-4", "gap-y-2", "border-b", "border-separator", "px-4", "py-3", "last:border-b-0")
export const ITEM_MAIN_CLASS = cn("flex", "min-w-0", "flex-1", "basis-64", "flex-col", "gap-1")
/** One link row: the field takes the width, its remove button sits at the end. */
export const LINK_ROW_CLASS = cn("flex", "min-w-0", "items-start", "gap-2")
export const LINK_FIELD_CLASS = cn("min-w-0", "flex-1")
/** Disclosure trigger copy: the title, then the one-line summary under it. */
export const OPTIONS_TITLE_CLASS = cn("flex", "min-w-0", "flex-col", "gap-1", "text-left")
/** One question-and-answer pair row (GAP-3 between its fields). */
export const FAQ_ROW_CLASS = cn("grid", "grid-cols-1", "gap-3", "py-3", "first:pt-0", "last:pb-0")
export const SUGGEST_ITEM_CLASS = cn("flex", "min-w-0", "flex-col", "gap-2", "py-3", "first:pt-0", "last:pb-0")
/** One retrieved passage inside its nested surface (GAP-2). */
export const PASSAGE_CLASS = cn("flex", "min-w-0", "flex-col", "gap-2")
/** Source text whose authored line breaks must survive; long words wrap (TEXT-FLOW break-words). */
export const PASSAGE_TEXT_CLASS = cn("whitespace-pre-wrap", "break-words")
export const NOTE_CLASS = cn("flex", "min-w-0", "flex-col", "gap-2", "py-3", "first:pt-0", "last:pb-0")
/** Plain count lines inside a card (GAP-2). */
export const CARD_LIST_CLASS = cn("flex", "min-w-0", "flex-col", "gap-2")
