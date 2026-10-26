import { cn } from "@heroui/react"

/** Composer: the closing band of the card; a Divider opens it. */
export const COMPOSER_CLASS_NAME = cn("flex", "shrink-0", "flex-col")
/** The inset body of the composer band. */
export const COMPOSER_BODY_CLASS_NAME = cn("flex", "flex-col", "gap-2", "px-4", "pt-3", "pb-4")
/** The row of prompt chips above the field. */
export const CHIPS_CLASS_NAME = cn("flex", "min-w-0", "items-center", "gap-2", "overflow-x-auto")
/** The field and the send button on one line. */
export const COMPOSER_ROW_CLASS_NAME = cn("flex", "min-w-0", "items-center", "gap-2")
/** The message field grows (the Grammar Textarea owns its face). */
export const COMPOSER_INPUT_CLASS_NAME = cn("min-w-0", "flex-1")
