import { cn } from "@heroui/react"

/** The row: the title and stage on one line, the bar under it. */
export const KNOWLEDGE_PROGRESS_ROW_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-2")

/** The line above the bar: the name of the work on the left, the stage and its count on the right. */
export const KNOWLEDGE_PROGRESS_ROW_HEAD_CLASS_NAME = cn("flex", "min-w-0", "items-baseline", "justify-between", "gap-3")
