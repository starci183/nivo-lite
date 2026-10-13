import { cn } from "@heroui/react"

/** Page regions (GAP-5). */
export const PAGE_CLASS_NAME = cn("flex", "flex-col", "gap-6")
/** Blocks inside one card (GAP-4). */
export const STACK_CLASS_NAME = cn("flex", "flex-col", "gap-4")
/** A named section: header above its collection (GAP-4). */
export const SECTION_CLASS_NAME = cn("flex", "flex-col", "gap-4")
/** Renew action beside its hint (GAP-3 case-1). */
export const ACTIONS_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-3")
/** One order / transfer row of a SurfaceListCard: trailing seam dropped on the last row (BOUNDARY-2 case-1), row inset PADDING-4 / PADDING-3. */
export const ROW_CLASS_NAME = cn(
    "flex",
    "flex-wrap",
    "items-center",
    "justify-between",
    "gap-3",
    "border-b",
    "border-separator",
    "px-4",
    "py-3",
    "last:border-b-0",
)
/** Amount over its facts line inside a row (GAP-1). */
export const ROW_COPY_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-1")
