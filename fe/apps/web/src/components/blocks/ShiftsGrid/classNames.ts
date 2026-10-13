import { cn } from "@heroui/react"

/** The heading over the grid and the day list (GAP-3). */
export const SECTION_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-3")

/**
 * Week grid (people x days).
 * grammar gap: Common has no scheduling grid with droppable cells, so the grid stays app-owned inside a joined
 * SurfaceCard (face, corner, edge) and a HorizontalScrollRegion (overflow); replaced by the day list below md.
 */
export const FRAME_CLASS_NAME = cn("hidden", "min-w-0", "md:block")

/** The eight columns of the grid: names and seven days. */
export const GRID_CLASS_NAME = cn("grid", "min-w-225", "grid-cols-8")

/** Header cell: a recessed band with a seam below (SURFACE-3, BOUNDARY-1). */
export const HEAD_CLASS_NAME = cn("border-b", "border-separator", "bg-surface-secondary", "p-2")

/** The name cell of a row (GAP-1). */
export const NAME_CLASS_NAME = cn("flex", "flex-col", "justify-center", "gap-1", "border-b", "border-separator", "p-2")

/** Day list for phones. */
export const DAYLIST_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-3", "md:hidden")

/** A row of the day list: the shift, who has it and what it breaks (GAP-2). */
export const DAY_ROW_CLASS_NAME = cn(
    "flex",
    "min-w-0",
    "flex-col",
    "gap-2",
    "border-b",
    "border-separator",
    "px-4",
    "py-3",
    "last:border-b-0",
)

/** One person on one date; a drop target takes the accent wash, a day of leave the recessed wash. */
export const cellClassName = (isTarget: boolean, isOff: boolean) =>
    cn(
        "flex",
        "min-h-14",
        "flex-col",
        "gap-1",
        "border-b",
        "border-l",
        "border-separator",
        "p-1",
        isTarget && "bg-accent-soft",
        isOff && "bg-surface-secondary",
    )

/**
 * One shift chip.
 * grammar gap: the chip is a drag source and a pick target, which Button does not publish, so the drag handle is an
 * app-owned frame around the grammar Button; the position colour is workspace data drawn on its leading edge.
 */
export const chipClassName = (isPicked: boolean, isBroken: boolean, isOpen: boolean) =>
    cn(
        "flex",
        "w-full",
        "min-w-0",
        "flex-col",
        "gap-1",
        "rounded-lg",
        "border",
        "border-separator",
        "border-l-4",
        "bg-surface",
        "px-2",
        "py-1",
        "transition-colors",
        isPicked && "ring-2",
        isPicked && "ring-accent",
        isBroken && "border-danger",
        isBroken && "bg-danger-soft",
        isOpen && "border-dashed",
    )
