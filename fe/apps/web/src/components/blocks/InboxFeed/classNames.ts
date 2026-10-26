import { cn } from "@heroui/react"

/** Feed section: heading then the list card (GAP-4). */
export const FEED_SECTION_CLASS = cn("flex", "flex-col", "gap-4")

/** Detail region under a row's copy: body, meta line and footer (GAP-2). */
export const FEED_BODY_CLASS = cn("flex", "flex-col", "gap-2")

/** Meta line: sender, amount, reference. */
export const FEED_META_CLASS = cn("flex", "flex-wrap", "items-center", "gap-x-4", "gap-y-1")

/** Row footer: duplicates and links. */
export const FEED_FOOT_CLASS = cn("flex", "flex-wrap", "items-center", "gap-x-4", "gap-y-1")
