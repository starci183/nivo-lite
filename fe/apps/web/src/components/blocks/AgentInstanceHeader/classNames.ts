import { cn } from "@heroui/react"

/** The trail above the header. */
export const HEAD = cn("flex", "min-w-0", "flex-col", "gap-2")

/** The mascot, the name and the facts of the agent. */
export const HEADER = cn("flex", "min-w-0", "flex-wrap", "items-center", "gap-4")

/** The copy next to the mascot. */
export const HEADER_COPY = cn("flex", "min-w-0", "flex-1", "basis-60", "flex-col", "gap-1")

/** The name with its badges. */
export const HEADER_TITLE = cn("flex", "flex-wrap", "items-center", "gap-2")

/** The facts under the name. */
export const HEADER_META = cn("flex", "flex-wrap", "items-center", "gap-x-4", "gap-y-1")
