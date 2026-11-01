import { cn } from "@heroui/react"

/** Invite link input beside its button; stacked on mobile (GAP-3). */
export const LINK_ROW_CLASS_NAME = cn("flex", "flex-col", "gap-3", "sm:flex-row", "sm:items-end")

/** The input takes the remaining width of the link row. */
export const LINK_FIELD_CLASS_NAME = cn("min-w-0", "flex-1")

/** Inset of the card's single band (PADDING-4). */
export const BAND_CLASS_NAME = cn("p-4")
