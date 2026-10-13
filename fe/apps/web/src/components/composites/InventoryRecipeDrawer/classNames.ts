import { cn } from "@heroui/react"

/** Stacked form fields; the Drawer owns the inset (GAP-3). */
export const FORM_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-3")
/** The buttons that end the form (GAP-2). */
export const ACTIONS_CLASS_NAME = cn("flex", "shrink-0", "flex-wrap", "items-center", "gap-2")
/** One ingredient: the item, the quantity and the remove button (GAP-2). */
export const LINE_ROW_CLASS_NAME = cn("grid", "grid-cols-1", "items-end", "gap-2", "sm:grid-cols-3")
