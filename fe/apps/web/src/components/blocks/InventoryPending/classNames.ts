import { cn } from "@heroui/react"

/** Stacked blocks of the section (GAP-3). */
export const STACK_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-3")
/** Row action column (GAP-2). */
export const ACTIONS_CLASS_NAME = cn("flex", "shrink-0", "flex-wrap", "items-center", "gap-2")
/** A drafted message: a recessed neutral band. */
export const QUOTE_CLASS_NAME = cn(
    "flex",
    "flex-col",
    "gap-1",
    "rounded-xl",
    "bg-surface-secondary",
    "px-3",
    "py-2",
    "text-foreground",
    "whitespace-pre-wrap",
)
