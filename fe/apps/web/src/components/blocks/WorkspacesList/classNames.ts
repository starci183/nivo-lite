import { cn } from "@heroui/react"

/** Workspace cards: one collection of peer cards in a grid (GAP-4 case-2); List owns the reset. */
export const GRID_CLASS_NAME = cn("grid", "grid-cols-1", "gap-4", "md:grid-cols-2")

/** Content of one workspace card (GAP-4). */
export const CARD_CLASS_NAME = cn("flex", "flex-col", "gap-4")

/** Workspace mark beside its name and meta (GAP-4). */
export const HEAD_CLASS_NAME = cn("flex", "items-center", "gap-4")

/** Lines of one entry (GAP-1). */
export const COPY_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-1")

/** Badges row (GAP-2 case-4). */
export const CHIPS_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-2")

/** Button row (GAP-3). */
export const ACTIONS_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-3")
