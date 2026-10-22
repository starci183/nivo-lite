import { cn } from "@heroui/react"

/** One group of related fields inside the form (GAP-2). */
export const SECTION_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-2")

/** The two bounds of the bands side by side on a wide drawer (GAP-2). */
export const BAND_FIELDS_CLASS_NAME = cn("grid", "grid-cols-1", "gap-2", "sm:grid-cols-2")

/** The three bands the rule makes, green yellow red (GAP-2). */
export const LEGEND_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-2")
