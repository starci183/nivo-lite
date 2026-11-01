import { cn } from "@heroui/react"

/** The facts of the band on one line, wrapping on a phone (GAP-3 between facts). */
export const BAND_CLASS_NAME = cn("flex", "min-w-0", "flex-wrap", "items-center", "justify-between", "gap-3")
/** The state, mode and version side by side. */
export const BAND_START_CLASS_NAME = cn("flex", "min-w-0", "flex-wrap", "items-center", "gap-3")
/** The last activity and the channels side by side. */
export const BAND_END_CLASS_NAME = cn("flex", "min-w-0", "flex-wrap", "items-center", "gap-3")
