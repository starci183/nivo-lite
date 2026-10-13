import { cn } from "@heroui/react"

/** Vertical rhythm of the step. */
export const RESULT_STACK = cn("flex", "min-w-0", "flex-col", "gap-4")
/** A wrapping row of badges or actions. */
export const RESULT_ROW = cn("flex", "flex-wrap", "items-center", "gap-2")
/** A label over its help. */
export const RESULT_COPY = cn("flex", "min-w-0", "flex-col", "gap-1")
/** Edit on the left, render again on the right. */
export const RESULT_FOOTER = cn("flex", "flex-wrap", "items-start", "justify-between", "gap-2", "pt-2")
