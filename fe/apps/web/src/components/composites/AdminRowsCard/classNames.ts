import { cn } from "@heroui/react"

/** One row of a SurfaceListCard: trailing seam dropped on the last row (BOUNDARY-2 case-1), row inset PADDING-4 / PADDING-3. */
export const ROW_CLASS_NAME = cn(
    "flex",
    "flex-wrap",
    "items-center",
    "justify-between",
    "gap-x-4",
    "gap-y-1",
    "border-b",
    "border-separator",
    "px-4",
    "py-3",
    "last:border-b-0",
)

/** The row's main copy: title over its qualifiers (GAP-1). */
export const ROW_MAIN_CLASS_NAME = cn("flex", "min-w-0", "flex-1", "basis-56", "flex-col", "gap-1")

/** The row's trailing badges and links (GAP-2). */
export const ROW_META_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-2")
