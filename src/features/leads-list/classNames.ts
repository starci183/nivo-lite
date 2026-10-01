import { cn } from "@heroui/react"

/** Vertical rhythm between the header, filters, form and list. */
export const PAGE_CLASS = cn("flex", "flex-col", "gap-6")

/** Filter cards row. */
export const FILTERS_CLASS = cn("flex", "flex-wrap", "items-end", "gap-4")

/** One filter card cell. */
export const FILTER_CELL_CLASS = cn("min-w-36", "flex-1", "sm:w-48", "sm:flex-none")

/** Search field cell. */
export const SEARCH_CLASS = cn("w-full", "sm:max-w-md", "sm:flex-1")

/** Tabs strip that may scroll on narrow screens. */
export const TABS_CLASS = cn("max-w-full", "overflow-x-auto")

/** List of row cards. */
export const LIST_CLASS = cn("flex", "flex-col", "list-none", "p-0", "m-0")

/** One divided row inside the list card. */
export const ITEM_CLASS = cn("border-b", "border-separator", "py-1", "last:border-b-0")

/** Row content: tile, body, actions. */
export const ROW_CLASS = cn("flex", "items-center", "gap-1")

/** Clickable part of a row (the whole contact). */
export const ROW_LINK_CLASS = cn("flex", "min-h-16", "min-w-0", "flex-1", "items-center", "gap-3", "rounded-xl", "px-2", "py-2", "hover:bg-surface-secondary", "focus-visible:outline-2", "focus-visible:outline-focus")

/** Body column of a row. */
export const ROW_BODY_CLASS = cn("flex", "min-w-0", "flex-1", "flex-col", "gap-1")

/** Title line: name plus badge. */
export const ROW_TITLE_CLASS = cn("flex", "items-baseline", "justify-between", "gap-2")

/** Actions cluster on the right. */
export const ROW_ACTIONS_CLASS = cn("flex", "items-center", "gap-2")

/** Two-column form grid. */
export const FORM_GRID_CLASS = cn("grid", "grid-cols-1", "gap-4", "md:grid-cols-2", "md:gap-6")

/** Field spanning both columns. */
export const FORM_WIDE_CLASS = cn("md:col-span-2")

/** Submit row of the form. */
export const ACTIONS_CLASS = cn("flex", "flex-wrap", "items-center", "justify-end", "gap-2", "md:col-span-2")

/** Screen-reader-only label for icon-like buttons. */
export const SR_ONLY_CLASS = cn("sr-only")

/** Chip + company line under the next step. */
export const ROW_META_CLASS = cn("flex", "min-w-0", "items-center", "gap-2")
