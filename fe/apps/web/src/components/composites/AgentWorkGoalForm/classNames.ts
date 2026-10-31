import { cn } from "@heroui/react"

/** The fields and the command of a form band side by side, wrapping on a phone. */
export const FORM_ROW = cn("flex", "min-w-0", "flex-wrap", "items-end", "gap-2")

/** The field that takes the rest of the row. */
export const FORM_GROW = cn("min-w-0", "flex-1", "basis-40")
