import { cn } from "@heroui/react"

/** One group of related fields inside the form (GAP-2). */
export const SECTION_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-2")

/** The approval limits, one row per member: a Divider between rows. */
export const GRANT_LIST_CLASS_NAME = cn("flex", "flex-col")

/** One member: the checkbox that says they may approve and their limit (GAP-2). */
export const GRANT_ROW_CLASS_NAME = cn("grid", "grid-cols-1", "items-end", "gap-2", "py-2", "sm:grid-cols-2")
