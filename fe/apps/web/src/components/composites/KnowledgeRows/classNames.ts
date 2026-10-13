import { cn } from "@heroui/react"

/** A named section: its heading row, notices and the collection (GAP-4). */
export const SECTION_CLASS_NAME = cn("flex", "flex-col", "gap-4")

/** The heading and the action beside it wrap on phones (GAP-3). */
export const HEAD_CLASS_NAME = cn("flex", "flex-wrap", "items-start", "justify-between", "gap-3")

/** The heading takes the room the action leaves (GAP-1). */
export const TITLE_CLASS_NAME = cn("min-w-0", "flex-1", "basis-64")

/** One row of the SurfaceListCard: trailing seam dropped on the last row (BOUNDARY-2 case-1), row inset PADDING-4 inline / PADDING-3 block; its parts stack (GAP-3). */
export const ROW_CLASS_NAME = cn(
    "flex",
    "flex-col",
    "gap-3",
    "border-b",
    "border-separator",
    "px-4",
    "py-3",
    "last:border-b-0",
)

/** The main line of a row: text, badges and actions wrap on phones (GAP-3). */
export const LINE_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-x-4", "gap-y-3")

/** The text of a row takes the room the badges and actions leave (GAP-1). */
export const TEXT_CLASS_NAME = cn("flex", "min-w-0", "flex-1", "basis-64", "flex-col", "gap-1")

/** Badges of a row (GAP-2 case-4). */
export const BADGES_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-2")

/** Links and buttons at the end of a row (GAP-2 case-3). */
export const ACTIONS_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-2")
