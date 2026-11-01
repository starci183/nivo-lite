import { cn } from "@heroui/react"

/** The fields and the command of a form band side by side, each field on its own line on a phone, side by side from the small breakpoint. */
export const FORM_ROW = cn("flex", "w-full", "min-w-0", "flex-wrap", "items-end", "gap-2")

/** The field that takes the rest of the row. */
export const FORM_GROW = cn("min-w-0", "flex-1", "basis-full", "sm:basis-40")
