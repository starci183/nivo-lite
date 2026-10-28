import { cn } from "@heroui/react"

/** The actions at the end of the header. */
export const HEADER_ACTIONS = cn("flex", "shrink-0", "flex-wrap", "items-center", "gap-2")

/** The rail column and the main column inside the joined surface: stacked on narrow widths, side by side from lg. */
export const FRAME = cn("flex", "h-full", "min-h-0", "min-w-0", "flex-col", "lg:flex-row")

/** The rail column: a fixed width from lg, full width above the main column before that. */
export const RAIL_COLUMN = cn("flex", "min-h-0", "min-w-0", "flex-col", "max-lg:max-h-60", "lg:w-72", "lg:shrink-0")

/** The line between the rail and the main column: horizontal on narrow widths, vertical from lg. */
export const SEPARATOR = cn("max-lg:block", "lg:hidden")

/** The vertical hairline between the rail and the main column: hidden on narrow widths, a column from lg. */
export const SEPARATOR_VERTICAL = cn("hidden", "shrink-0", "lg:flex")

/** The main column: the routed tab. */
export const MAIN = cn("flex", "min-h-0", "min-w-0", "flex-1", "flex-col")

/** The routed tab; a tab that draws its own columns edge to edge marks itself with data-bleed and loses the padding. */
export const BODY = cn(
    "flex",
    "min-h-0",
    "min-w-0",
    "flex-1",
    "flex-col",
    "overflow-y-auto",
    "p-4",
    "sm:p-6",
    "has-[[data-bleed]]:p-0",
)
