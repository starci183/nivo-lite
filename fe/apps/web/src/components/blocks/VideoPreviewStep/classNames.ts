import { cn } from "@heroui/react"

/** Vertical rhythm of the step. */
export const PREVIEW_STACK = cn("flex", "min-w-0", "flex-col", "gap-4")
/** The storyboard: scenes side by side inside a scroll region. */
export const PREVIEW_STRIP = cn("flex", "gap-3", "pb-2")
/** One storyboard frame, a fixed width so the frames line up. */
export const PREVIEW_FRAME = cn("flex", "w-40", "shrink-0", "flex-col", "gap-1")
/** One storyboard frame of a wide video. */
export const PREVIEW_FRAME_WIDE = cn("flex", "w-56", "shrink-0", "flex-col", "gap-1")
