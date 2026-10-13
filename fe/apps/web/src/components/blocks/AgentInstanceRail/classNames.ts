import { cn } from "@heroui/react"

/** The module switcher: a horizontal strip on narrow widths, a sticky column from lg. */
export const RAIL = cn(
    "flex",
    "min-w-0",
    "gap-2",
    "overflow-x-auto",
    "lg:sticky",
    "lg:top-0",
    "lg:flex-col",
    "lg:overflow-visible",
)

/** The link back to the whole catalogue, shown from lg. */
export const RAIL_HEAD = cn("hidden", "lg:block")

/** The name and the status of one agent in the rail. */
export const RAIL_COPY = cn("flex", "min-w-0", "flex-col", "items-start", "gap-1")
