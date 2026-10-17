import { cn } from "@heroui/react"

/** Stacked form fields; the Drawer owns the inset (GAP-3). */
export const FORM_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-3")
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
