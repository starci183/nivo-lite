import { cn } from "@heroui/react"

/** The scrolling thread: the messages one under the other. */
export const FEED_CLASS_NAME = cn("flex", "min-h-0", "flex-1", "flex-col", "gap-4", "overflow-y-auto", "p-4")
/** The text of a message: chips and words on one wrapping line. */
export const BODY_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-x-1", "gap-y-1")
/** Space above the nested surface that holds the customer words a message quotes. */
export const QUOTE_CLASS_NAME = cn("mt-2")
/** The quote label over its words inside the nested surface. */
export const QUOTE_BODY_CLASS_NAME = cn("flex", "flex-col", "gap-1")
