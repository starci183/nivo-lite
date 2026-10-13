import { cn } from "@heroui/react"

/** Stacked form fields; the Drawer owns the inset (GAP-3). */
export const FORM_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-3")
/** Fields side by side on wide screens. */
export const FORM_GRID_CLASS_NAME = cn("grid", "grid-cols-1", "gap-3", "sm:grid-cols-2")
