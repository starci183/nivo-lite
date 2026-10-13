import { cn } from "@heroui/react"

/** The fields and the save line stacked. */
export const STACK_CLASS = cn("flex", "min-w-0", "flex-col", "gap-3")
/** The numeric fields in columns from tablet width. */
export const GRID_CLASS = cn("grid", "grid-cols-1", "gap-3", "sm:grid-cols-2", "lg:grid-cols-3")
/** A field that spans two columns. */
export const WIDE_CLASS = cn("sm:col-span-2")
