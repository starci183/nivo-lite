import { cn } from "@heroui/react"

/** The row at the top of the leads list, then its closing seam. */
export const PROMO_BLOCK = cn("flex", "min-w-0", "flex-col", "gap-4", "pb-4")
/** Copy, then actions; wraps on narrow widths. */
export const PROMO_ROW = cn("flex", "min-w-0", "flex-wrap", "items-center", "gap-3")
/** The copy takes the free width: title over qualifier. */
export const PROMO_COPY = cn("flex", "min-w-0", "flex-1", "basis-64", "flex-col", "gap-1")
/** An action beside its dismiss control. */
export const PROMO_ACTIONS = cn("flex", "items-center", "gap-2")
