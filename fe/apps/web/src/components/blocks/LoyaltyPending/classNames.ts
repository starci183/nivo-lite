import { cn } from "@heroui/react"

/** Row text column (GAP-1). */
export const ROW_MAIN_CLASS_NAME = cn("flex", "min-w-0", "flex-1", "flex-col", "gap-1")
/** Row action column (GAP-2). */
export const ROW_ACTIONS_CLASS_NAME = cn("flex", "shrink-0", "flex-wrap", "items-center", "gap-2")
/** The quoted draft text inside its nested surface: layout only. */
export const QUOTE_CLASS_NAME = cn("flex", "flex-col", "gap-1", "break-words")
/** Stacked form fields (GAP-3). */
export const FORM_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-3")
