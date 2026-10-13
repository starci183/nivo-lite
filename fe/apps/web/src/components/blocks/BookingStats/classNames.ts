import { cn } from "@heroui/react"

/** The range text, the totals and the utilisation list stacked. */
export const STACK_CLASS = cn("flex", "min-w-0", "flex-col", "gap-3")
/** One utilisation row: the meter, then the hours behind it. */
export const ROW_CLASS = cn(
    "flex",
    "flex-col",
    "gap-1",
    "border-b",
    "border-separator",
    "px-4",
    "py-3",
    "last:border-b-0",
)
