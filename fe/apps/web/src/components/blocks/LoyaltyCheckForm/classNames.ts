import { cn } from "@heroui/react"

/** Stack inside the page card; the SurfaceCard owns the inset (PADDING-4 case-2), this only stacks (GAP-4). */
export const CARD_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-4")
/** Stacked form fields and the button under them (GAP-3). */
export const FORM_CLASS_NAME = cn("flex", "flex-col", "gap-3")
