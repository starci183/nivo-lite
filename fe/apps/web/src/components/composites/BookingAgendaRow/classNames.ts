import { cn } from "@heroui/react"

/** One row of a collection inside a list card: a hairline below, text left and actions right from tablet width. */
export const ROW_CLASS = cn(
    "flex",
    "flex-col",
    "gap-2",
    "border-b",
    "border-separator",
    "px-4",
    "py-3",
    "last:border-b-0",
    "md:flex-row",
    "md:items-center",
    "md:justify-between",
)
/** The text column of a row. */
export const MAIN_CLASS = cn("flex", "min-w-0", "flex-1", "flex-col", "gap-1")
/** The time, the status and the flags on one wrapping line. */
export const TOP_CLASS = cn("flex", "flex-wrap", "items-center", "gap-2")
/** The quick actions of a row. */
export const ACTIONS_CLASS = cn("flex", "flex-wrap", "items-center", "gap-2")
