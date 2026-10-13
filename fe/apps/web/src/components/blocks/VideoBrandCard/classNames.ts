import { cn } from "@heroui/react"

/** Stacked fields inside the card. */
export const BRAND_STACK = cn("flex", "min-w-0", "flex-col", "gap-4")
/** Fields that sit side by side and wrap on narrow widths. */
export const BRAND_ROW = cn("grid", "grid-cols-1", "gap-4", "sm:grid-cols-2")
/** The logo preview with its upload and remove actions. */
export const BRAND_LOGO = cn("flex", "flex-wrap", "items-center", "gap-2")
/** A small square logo preview. */
export const BRAND_LOGO_PREVIEW = cn("w-16", "shrink-0")
/** The save action. */
export const BRAND_ACTIONS = cn("flex", "flex-wrap", "items-center", "gap-2")
