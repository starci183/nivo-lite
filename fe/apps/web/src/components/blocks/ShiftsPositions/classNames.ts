import { cn } from "@heroui/react"

/** Stacked blocks inside the card (GAP-3). */
export const BLOCK_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-3")

/** A wrapping row of controls (GAP-3 case-3). */
export const ROW_CLASS_NAME = cn("flex", "min-w-0", "flex-wrap", "items-center", "gap-3")

/** A button aligned to the bottom of the field beside it. */
export const FIELD_ACTION_CLASS_NAME = cn("flex", "items-end")

/** A position colour mark (RADIUS-9 case-1). grammar gap: no Common category swatch; the colour is workspace data. */
export const SWATCH_CLASS_NAME = cn("inline-block", "size-2", "shrink-0", "rounded-full")
