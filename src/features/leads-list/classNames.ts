import { cn } from "@heroui/react"

/** Vertical rhythm between the header, filters, form and list (GAP-5: page regions). */
export const PAGE_CLASS = cn("flex", "flex-col", "gap-6")

/** Search field and the clear action (GAP-4). */
export const FILTERS_CLASS = cn("flex", "flex-wrap", "items-end", "gap-4")

/** Search field cell. */
export const SEARCH_CLASS = cn("w-full", "sm:max-w-md", "sm:flex-1")

/** One row of the SurfaceListCard collection: each row draws its trailing seam and the last drops it (BOUNDARY-2 case-1); the row owns its inset (PADDING-4 inline, PADDING-3 block). */
export const ITEM_CLASS = cn("border-b", "border-separator", "px-4", "py-3", "last:border-b-0")

/** Row content: the lead destination beside its menu (GAP-2). */
export const ROW_CLASS = cn("flex", "items-center", "gap-2")

// grammar gap: Common publishes no pressable list row (a whole-row destination with a disjoint row menu, STATE-5 case-4); the row keeps a plain next/link with layout classes only.
/** The lead destination: avatar beside the copy (GAP-3). */
export const ROW_LINK_CLASS = cn("flex", "min-w-0", "flex-1", "items-center", "gap-3")

/** Body column of a row: lines of one entry (GAP-1). */
export const ROW_BODY_CLASS = cn("flex", "min-w-0", "flex-1", "flex-col", "gap-1")

/** Title line: name plus time (GAP-2). */
export const ROW_TITLE_CLASS = cn("flex", "items-baseline", "justify-between", "gap-2")

/** Actions cluster on the right (GAP-2). */
export const ROW_ACTIONS_CLASS = cn("flex", "items-center", "gap-2")

/** Two-column form grid (GAP-4, GAP-5 at md). */
export const FORM_GRID_CLASS = cn("grid", "grid-cols-1", "gap-4", "md:grid-cols-2", "md:gap-6")

/** Field spanning both columns. */
export const FORM_WIDE_CLASS = cn("md:col-span-2")

/** Submit row of the form (GAP-2 case-3). */
export const ACTIONS_CLASS = cn("flex", "flex-wrap", "items-center", "justify-end", "gap-2", "md:col-span-2")

/** Stage badge + company line under the next step (GAP-2). */
export const ROW_META_CLASS = cn("flex", "min-w-0", "items-center", "gap-2")
