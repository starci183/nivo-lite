import { cn } from "@heroui/react"

/** The avatar, the copy and the actions of the agent: wraps on narrow widths. */
export const HEADER = cn("flex", "min-w-0", "flex-wrap", "items-center", "gap-3", "p-4")

/** The copy next to the avatar. */
export const HEADER_COPY = cn("flex", "min-w-0", "flex-1", "basis-60", "flex-col", "gap-1")

/** The name with its badges. */
export const HEADER_TITLE = cn("flex", "flex-wrap", "items-center", "gap-2")

/** The actions at the end of the header. */
export const HEADER_ACTIONS = cn("flex", "shrink-0", "flex-wrap", "items-center", "gap-2")
