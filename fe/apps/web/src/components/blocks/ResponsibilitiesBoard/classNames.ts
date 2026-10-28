import { cn } from "@heroui/react"

/** The board under the page header. */
export const PAGE_CLASS = cn("flex", "flex-col", "gap-6")
/** Board: filters, tabs, list. */
export const BOARD_CLASS = cn("flex", "flex-col", "gap-6")
/** Filter cards in one row, with clear filters at the end. */
export const FILTERS_CLASS = cn("grid", "grid-cols-1", "items-center", "gap-4", "sm:grid-cols-2", "lg:grid-cols-4")
/** Search, tabs and sort toolbar. */
export const TOOLBAR_CLASS = cn("flex", "flex-col", "gap-4", "lg:flex-row", "lg:items-end", "lg:justify-between")
/** Search box width cap. */
export const SEARCH_CLASS = cn("w-full", "lg:w-64")
/** Sort select width cap. */
export const SORT_CLASS = cn("w-full", "lg:w-52")
/** Right side of the toolbar: search and sort. */
export const TOOLBAR_END_CLASS = cn("flex", "flex-col", "gap-4", "sm:flex-row", "sm:items-end")
/** Section title line: heading with count on the left, stamp on the right. */
export const LIST_HEAD_CLASS = cn("flex", "items-baseline", "justify-between", "gap-3", "px-1")
/** Heading and count. */
export const LIST_TITLE_CLASS = cn("flex", "items-baseline", "gap-3")
