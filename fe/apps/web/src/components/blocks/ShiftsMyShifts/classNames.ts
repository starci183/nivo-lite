import { cn } from "@heroui/react"

/** One heading over its list (GAP-3). */
export const SECTION_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-3")

/** Badge and buttons of a shift (GAP-3 case-3). */
export const ACTIONS_CLASS_NAME = cn("flex", "min-w-0", "flex-wrap", "items-center", "gap-3")

/** The swap form fields in a grid that opens up with width (GAP-4 case-2). */
export const FORM_GRID_CLASS_NAME = cn("grid", "grid-cols-1", "gap-3", "sm:grid-cols-2", "lg:grid-cols-4")

/** A button aligned to the bottom of the fields beside it in a form grid. */
export const FIELD_ACTION_CLASS_NAME = cn("flex", "items-end")
