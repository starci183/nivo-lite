import { cn } from "@heroui/react"

/** One row of a setup list: text left, buttons right from tablet width. */
export const ROW_CLASS = cn(
    "flex",
    "flex-col",
    "gap-2",
    "border-t",
    "border-separator",
    "py-2",
    "md:flex-row",
    "md:items-center",
    "md:justify-between",
)
/** The text column of the row. */
export const MAIN_CLASS = cn("flex", "min-w-0", "flex-1", "flex-col", "gap-1")
/** The buttons of the row. */
export const ACTIONS_CLASS = cn("flex", "flex-wrap", "items-center", "gap-2")
