import { cn } from "@heroui/react"

/** Back on the left, the note and the next action on the right, wrapping on phones. */
export const FOOTER_ROW = cn("flex", "flex-wrap", "items-center", "justify-between", "gap-2", "pt-2")
/** The note beside the next action. */
export const FOOTER_END = cn("flex", "flex-wrap", "items-center", "gap-2")
