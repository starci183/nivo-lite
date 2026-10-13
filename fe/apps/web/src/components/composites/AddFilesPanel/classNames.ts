import { cn } from "@heroui/react"

/** The panel: its parts stacked (GAP-4). */
export const PANEL_CLASS_NAME = cn("flex", "flex-col", "gap-4")

/** One link input with the button that removes it (GAP-2). */
export const LINK_ROW_CLASS_NAME = cn("flex", "items-end", "gap-2")

/** The input takes the room the button leaves (GAP-1). */
export const LINK_FIELD_CLASS_NAME = cn("min-w-0", "flex-1")

/** One queued item: text, status and the button that removes it, with the seam of the list (PADDING-4 inline / PADDING-3 block). */
export const ITEM_CLASS_NAME = cn(
    "flex",
    "flex-wrap",
    "items-center",
    "gap-x-3",
    "gap-y-2",
    "border-b",
    "border-separator",
    "px-4",
    "py-3",
    "last:border-b-0",
)

/** Name and detail lines of one queued item (GAP-1). */
export const ITEM_TEXT_CLASS_NAME = cn("flex", "min-w-0", "flex-1", "basis-48", "flex-col", "gap-1")
