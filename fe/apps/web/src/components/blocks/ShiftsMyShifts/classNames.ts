import { cn } from "@heroui/react"

/** One heading over its list (GAP-3). */
export const SECTION_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-3")

/** A row of a SurfaceListCard whose content stacks (shift, then its swap form): own trailing hairline, the last one dropped (BOUNDARY-2 case-1, PADDING-3). */
export const ROW_CLASS_NAME = cn(
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

/** The shift text and its actions side by side from tablet width. */
export const SPLIT_CLASS_NAME = cn(
    "flex",
    "min-w-0",
    "flex-col",
    "gap-2",
    "sm:flex-row",
    "sm:items-center",
    "sm:justify-between",
)

/** Badge and buttons of a shift (GAP-3 case-3). */
export const ACTIONS_CLASS_NAME = cn("flex", "min-w-0", "flex-wrap", "items-center", "gap-3")

/** The swap form fields in a grid that opens up with width (GAP-4 case-2). */
export const FORM_GRID_CLASS_NAME = cn("grid", "grid-cols-1", "gap-3", "sm:grid-cols-2", "lg:grid-cols-4")

/** A button aligned to the bottom of the fields beside it in a form grid. */
export const FIELD_ACTION_CLASS_NAME = cn("flex", "items-end")
