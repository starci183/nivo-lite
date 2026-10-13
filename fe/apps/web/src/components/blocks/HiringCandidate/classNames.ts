import { cn } from "@heroui/react"

/** The drawer's sections, stacked (GAP-3). */
export const FORM_CLASS_NAME = cn("flex", "flex-col", "gap-3")

/** The stage badge with the contact lines (GAP-2). */
export const CHIPS_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-x-2", "gap-y-1")

/** A row of commands (GAP-2). */
export const ACTIONS_CLASS_NAME = cn("flex", "shrink-0", "flex-wrap", "items-center", "gap-2")

/** A question and its answer (GAP-1). */
export const PAIR_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-1")

/** An event of the timeline and its actor (GAP-1). */
export const EVENTS_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-1")
