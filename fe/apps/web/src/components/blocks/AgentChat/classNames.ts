import { cn } from "@heroui/react"

/** Columns inside the chat SurfaceCard (the card owns face, radius, clip and elevation: SURFACE-2, BOUNDARY-6). */
export const FRAME_CLASS_NAME = cn("flex", "h-full", "min-h-0", "min-w-0")
/** The conversation rail beside the thread on wide screens. */
export const LIST_COLUMN_CLASS_NAME = cn(
    "flex",
    "min-h-0",
    "w-72",
    "shrink-0",
    "flex-col",
    "border-e",
    "border-separator",
    "bg-surface-secondary",
    "max-lg:hidden",
)
/** The conversation rail opened over the thread on narrow screens. */
export const LIST_COLUMN_OPEN_CLASS_NAME = cn(
    "flex",
    "min-h-0",
    "w-full",
    "flex-col",
    "bg-surface-secondary",
    "lg:hidden",
)
/** The scrolling list inside the rail. */
export const LIST_SCROLL_CLASS_NAME = cn("flex", "min-h-0", "flex-1", "flex-col", "gap-1", "overflow-y-auto", "p-2")
/** The column that holds the header, the thread and the composer. */
export const MAIN_CLASS_NAME = cn("flex", "min-h-0", "min-w-0", "flex-1", "flex-col", "max-lg:data-[list=open]:hidden")
/** The strip that holds the channel tabs. */
export const CHANNEL_BAR_CLASS_NAME = cn("border-b", "border-separator", "px-3")
