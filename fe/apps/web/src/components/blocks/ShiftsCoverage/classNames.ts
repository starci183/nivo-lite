import { cn } from "@heroui/react"

/** The heading over the day cards (GAP-3). */
export const SECTION_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-3")

/** Coverage strip: one card per day (GAP-4 case-2). */
export const DAYS_CLASS_NAME = cn("grid", "grid-cols-1", "gap-4", "sm:grid-cols-4", "lg:grid-cols-7")

/** The meters of one day (GAP-3). */
export const METERS_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-3")
