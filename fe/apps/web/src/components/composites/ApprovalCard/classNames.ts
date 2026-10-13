import { cn } from "@heroui/react"

/** Column holding the status row above the card and the card itself. */
export const APPROVAL_CARD_COLUMN_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-3")

/** Status row above the joined card. */
export const APPROVAL_CARD_STATUS_ROW_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-2")

/** First band of the joined card: outer edge pt-4 (PADDING-4), separator-facing pb-3 (PADDING-3). */
export const APPROVAL_CARD_BAND_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-2", "px-4", "pt-4", "pb-3")

/** Second band, below the Grammar Divider: separator-facing pt-3, outer edge pb-4. */
export const APPROVAL_CARD_BAND_DIVIDED_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-3", "px-4", "pt-3", "pb-4")

/** The quoted draft: recessed neutral band (SURFACE-3) with the soft notice corner (RADIUS-5 case-2). */
export const APPROVAL_CARD_QUOTE_CLASS_NAME = cn(
    "min-w-0",
    "rounded-xl",
    "bg-surface-secondary",
    "text-foreground",
    "px-4",
    "py-3",
    "whitespace-pre-wrap",
)

/** Row that holds the footer facts and the open-lead link. */
export const APPROVAL_CARD_META_ROW_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "justify-between", "gap-2")

/** Approve and reject side by side. */
export const APPROVAL_CARD_ACTIONS_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-3")
