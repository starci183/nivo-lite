import { cn } from "@heroui/react"

/** Stacked parts of the library tab. */
export const LIBRARY_STACK = cn("flex", "min-w-0", "flex-col", "gap-4")
/** The library grid: one card per video, one column on phones, more as the room grows. */
export const LIBRARY_GRID = cn("grid", "grid-cols-1", "gap-4", "sm:grid-cols-2", "xl:grid-cols-3")
/** One grid cell holding one card. */
export const LIBRARY_CELL = cn("min-w-0")
/** Stacked parts of one card. */
export const LIBRARY_CARD = cn("flex", "min-w-0", "flex-col", "gap-4")
/** Title over its badges and facts. */
export const LIBRARY_COPY = cn("flex", "min-w-0", "flex-col", "gap-1")
/** A wrapping row of badges or actions. */
export const LIBRARY_ROW = cn("flex", "flex-wrap", "items-center", "gap-2")
