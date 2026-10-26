import { cn } from "@heroui/react"

/** The rail column: head, the scrolling list, the add action at the foot. */
export const RAIL = cn("flex", "min-h-0", "min-w-0", "flex-1", "flex-col")

/** The title of the rail; padding goes on the content, the dividers stay full width. */
export const RAIL_HEAD = cn("w-full", "px-4", "py-3", "text-start")

/** The list of agents scrolls between the head and the foot. */
export const RAIL_LIST = cn("flex", "min-h-0", "flex-1", "flex-col", "overflow-y-auto", "p-2")

/** The add action at the foot. */
export const RAIL_FOOT = cn("p-4")
