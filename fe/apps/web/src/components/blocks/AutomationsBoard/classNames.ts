import { cn } from "@heroui/react"

/** Dense peer cards of one collection in a grid, with the detail beside them. */
export const GRID_CLASS = cn("grid", "grid-cols-1", "gap-3", "sm:grid-cols-2", "lg:grid-cols-1", "2xl:grid-cols-2")
/** Dense peer cards in a wide grid, no detail open. */
export const GRID_WIDE_CLASS = cn("grid", "grid-cols-1", "gap-3", "sm:grid-cols-2", "xl:grid-cols-3")
/** The primary column of the page layout. */
export const SOLO_CLASS = cn("flex", "min-w-0", "flex-col", "gap-4")
/** The compact list of the module settings card. */
export const LIST_CLASS = cn("flex", "flex-col", "gap-2")
/** The sections of the detail, one under the other. */
export const SECTIONS_CLASS = cn("flex", "flex-col", "gap-4")

/** The class of the collection: a compact list inside another surface, else a grid that narrows while the detail is open. */
export const collectionClass = (isNested: boolean, hasDetail: boolean) => {
    if (isNested) return LIST_CLASS
    return hasDetail ? GRID_CLASS : GRID_WIDE_CLASS
}
