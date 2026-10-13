import { cn } from "@heroui/react"

/** The detail panel follows the reader on wide screens. */
export const DETAIL_CLASS = cn("min-w-0", "lg:sticky", "lg:top-4")
/** Blocks inside the detail surface. */
export const DETAIL_STACK_CLASS = cn("flex", "min-w-0", "flex-col", "gap-6")
/** The title, the description and the close action. */
export const HEAD_ROW_CLASS = cn("flex", "flex-wrap", "items-center", "justify-between", "gap-2")
/** The name and the line under it. */
export const FACTS_CLASS = cn("flex", "flex-col", "gap-1")
/** The buttons at the end of a band. */
export const ACTIONS_CLASS = cn("flex", "flex-wrap", "items-center", "gap-2")
