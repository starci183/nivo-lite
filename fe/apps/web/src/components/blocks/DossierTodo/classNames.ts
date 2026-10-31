import { cn } from "@heroui/react"

/** The heading, the filters and the list, a region step apart (GAP-5). */
export const TODO_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-6")

/** The two filters sit side by side from tablets and stack on phones (GAP-3). */
export const FILTERS_CLASS_NAME = cn(
    "flex",
    "min-w-0",
    "flex-col",
    "gap-4",
    "sm:flex-row",
    "sm:items-end",
    "sm:justify-between",
)

/** The list under its filters (GAP-4). */
export const LIST_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-4")
