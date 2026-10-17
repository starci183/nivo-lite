import { cn } from "@heroui/react"

/** A row of commands (GAP-2). */
export const ACTIONS_CLASS_NAME = cn("flex", "shrink-0", "flex-wrap", "items-center", "gap-2")

/** A question and its answer (GAP-1). */
export const PAIR_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-1")

/** An event of the timeline and its actor (GAP-1). */
export const EVENTS_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-1")
