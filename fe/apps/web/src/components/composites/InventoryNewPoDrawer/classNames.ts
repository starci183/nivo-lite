import { cn } from "@heroui/react"

/** Stacked form fields; the Drawer owns the inset (GAP-3). */
export const FORM_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-3")
/** One order line: the item, then quantity and price (GAP-2). */
export const LINE_ROW_CLASS_NAME = cn("grid", "grid-cols-1", "items-end", "gap-2", "sm:grid-cols-3")
