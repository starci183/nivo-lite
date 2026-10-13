import { cn } from "@heroui/react"

/** The forms and the fields stacked. */
export const STACK_CLASS = cn("flex", "min-w-0", "flex-col", "gap-3")
/** The fields in columns from tablet width. */
export const GRID_CLASS = cn("grid", "grid-cols-1", "gap-3", "sm:grid-cols-2")
/** The save and cancel buttons. */
export const ACTIONS_CLASS = cn("flex", "flex-wrap", "items-center", "gap-2")
