import { cn } from "@heroui/react"

/** One invite row of the SurfaceListCard: trailing seam dropped on the last row (BOUNDARY-2 case-1), row inset PADDING-4 inline / PADDING-3 block; identity, facts and actions wrap on phones. */
export const ROW_CLASS_NAME = cn(
    "flex",
    "flex-wrap",
    "items-center",
    "gap-x-4",
    "gap-y-3",
    "border-b",
    "border-separator",
    "px-4",
    "py-3",
    "last:border-b-0",
)

/** Avatar + email column (GAP-3). */
export const IDENTITY_CLASS_NAME = cn("flex", "min-w-0", "flex-1", "basis-64", "items-center", "gap-3")

/** Email / expiry lines of one identity (GAP-1). */
export const IDENTITY_TEXT_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-1")

/** Role badge cluster (GAP-2 case-4). */
export const FACTS_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-2")

/** Buttons at the end of a row (GAP-2 case-3). */
export const ACTIONS_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-2")

/** A freshly issued link under its row takes the whole row (GAP-2). */
export const LINK_ROW_CLASS_NAME = cn("w-full")
