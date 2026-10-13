import { cn } from "@heroui/react"

/** The fields of one question, stacked (GAP-3). */
export const FIELDS_CLASS_NAME = cn("flex", "flex-col", "gap-3")

/** Two fields side by side from the medium step (GAP-3). */
export const GRID_CLASS_NAME = cn("grid", "grid-cols-1", "gap-3", "md:grid-cols-2")

/** The switch and the remove button (GAP-2). */
export const ACTIONS_CLASS_NAME = cn("flex", "shrink-0", "flex-wrap", "items-center", "gap-2")
