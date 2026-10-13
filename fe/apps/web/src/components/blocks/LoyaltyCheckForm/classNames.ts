import { cn } from "@heroui/react"

/** Stack inside the page card; the SurfaceCard owns the inset (PADDING-4 case-2), this only stacks (GAP-4). */
export const CARD_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-4")
/** Stacked form fields and the button under them (GAP-3). */
export const FORM_CLASS_NAME = cn("flex", "flex-col", "gap-3")
/** One reward inside a SurfaceListCard: badge, name and note stacked (BOUNDARY-2 case-1, PADDING-3, GAP-1). */
export const REWARD_CLASS_NAME = cn(
    "flex",
    "flex-col",
    "items-start",
    "gap-1",
    "border-b",
    "border-separator",
    "px-4",
    "py-3",
    "last:border-b-0",
)
