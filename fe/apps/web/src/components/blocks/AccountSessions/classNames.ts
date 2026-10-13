import { cn } from "@heroui/react"

/** Sessions section: header, notices, the collection and its closing action (GAP-4). */
export const SECTION_CLASS_NAME = cn("flex", "flex-col", "gap-4")

/** Button row (GAP-3). */
export const ACTIONS_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-3")

/** One device row of the SurfaceListCard: trailing seam dropped on the last row, row inset PADDING-4 / PADDING-3. */
export const SESSION_ROW_CLASS_NAME = cn(
    "flex",
    "flex-col",
    "gap-3",
    "border-b",
    "border-separator",
    "px-4",
    "py-3",
    "last:border-b-0",
    "sm:flex-row",
    "sm:items-center",
    "sm:justify-between",
)

/** Device name over its facts line (GAP-1). */
export const SESSION_INFO_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-1")

/** Device name beside the current badge (GAP-2). */
export const SESSION_TITLE_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-2")
