import { cn } from "@heroui/react"

/** The page canvas of a public page: the whole viewport, with room around the card. */
export const MAIN_CLASS_NAME = cn("min-h-dvh")
/** The heading block and the form stacked (GAP-4). */
export const STACK_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-4")
/** The shop name, address and note under the title (GAP-1). */
export const HEAD_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-1")
