import { cn } from "@heroui/react"

/** Stack of content inside a card; the card owns the inset, this only stacks (GAP-3). */
export const BODY_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-3")
/** Overview: two columns from desktop width (GAP-4 case-2). */
export const OVERVIEW_GRID_CLASS_NAME = cn("grid", "grid-cols-1", "gap-4", "lg:grid-cols-2")
