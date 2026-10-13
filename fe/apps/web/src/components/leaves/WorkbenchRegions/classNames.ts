import { cn } from "@heroui/react"

/** The common side regions become three columns on wide screens. */
export const SIDE_GRID_CLASS_NAME = cn("grid", "min-w-0", "grid-cols-1", "gap-6", "2xl:grid-cols-3")
/** Knowledge and optional gap cards remain vertically stacked. */
export const SIDE_COLUMN_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-4")
/** A card header with its count and evidence link. */
export const LABEL_END_CLASS_NAME = cn("flex", "items-center", "gap-3")
