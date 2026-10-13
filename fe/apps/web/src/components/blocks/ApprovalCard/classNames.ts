import { cn } from "@heroui/react"

/** Column holding the status row above the card and the card itself. */
export const COLUMN_CLASS = cn("flex", "min-w-0", "flex-col", "gap-3")
/** Status row above the joined card. */
export const STATUS_ROW_CLASS = cn("flex", "flex-wrap", "items-center", "gap-2")
/** First band of the joined card: outer edge pt-4, separator-facing pb-3. */
export const BAND_CLASS = cn("flex", "min-w-0", "flex-col", "gap-2", "px-4", "pt-4", "pb-3")
/** Second band, below the divider: separator-facing pt-3, outer edge pb-4. */
export const BAND_DIVIDED_CLASS = cn("flex", "min-w-0", "flex-col", "gap-3", "px-4", "pt-3", "pb-4")
/** The quoted draft: recessed neutral band with the soft notice corner. */
export const QUOTE_CLASS = cn(
    "min-w-0",
    "rounded-xl",
    "bg-surface-secondary",
    "text-foreground",
    "px-4",
    "py-3",
    "whitespace-pre-wrap",
)
/** Row that holds the footer facts and the open-lead link. */
export const META_ROW_CLASS = cn("flex", "flex-wrap", "items-center", "justify-between", "gap-2")
/** Approve, edit and reject side by side. */
export const ACTIONS_CLASS = cn("flex", "flex-wrap", "items-center", "gap-3")
