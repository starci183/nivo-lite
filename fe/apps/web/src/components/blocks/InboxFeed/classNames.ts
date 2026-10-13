import { cn } from "@heroui/react"

/** Feed section: heading then the list card (GAP-4). */
export const FEED_SECTION_CLASS = cn("flex", "flex-col", "gap-4")

/** One feed row inside the SurfaceListCard: trailing seam dropped on the last row (BOUNDARY-2 case-1), row inset px-4 py-3 (PADDING-3/4). */
export const FEED_ITEM_CLASS = cn(
    "flex",
    "flex-col",
    "gap-2",
    "border-b",
    "border-separator",
    "px-4",
    "py-3",
    "last:border-b-0",
)

/** Top line of a row: channel and kind, badges. */
export const FEED_HEAD_CLASS = cn("flex", "flex-wrap", "items-center", "justify-between", "gap-2")

/** Channel + kind cluster. */
export const FEED_TITLE_CLASS = cn("flex", "min-w-0", "flex-wrap", "items-center", "gap-x-2", "gap-y-1")

/** Badge cluster. */
export const FEED_BADGES_CLASS = cn("flex", "flex-wrap", "items-center", "gap-2")

/** Meta line: sender, amount, reference. */
export const FEED_META_CLASS = cn("flex", "flex-wrap", "items-center", "gap-x-4", "gap-y-1")

/** Row footer: duplicates and links. */
export const FEED_FOOT_CLASS = cn("flex", "flex-wrap", "items-center", "gap-x-4", "gap-y-1")
