import { cn } from "@heroui/react"

/** The composer pinned under the thread: one seam above it. */
export const COMPOSER_CLASS_NAME = cn("flex", "shrink-0", "flex-col", "gap-2", "border-t", "border-separator", "p-4")
/** The field and the send button on one line. */
export const ROW_CLASS_NAME = cn("flex", "min-w-0", "items-end", "gap-2")
/** The message field grows. */
export const FIELD_CLASS_NAME = cn("min-w-0", "flex-1")
