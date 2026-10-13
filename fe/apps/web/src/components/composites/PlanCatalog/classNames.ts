import { cn } from "@heroui/react"

/** The catalogue regions: header, cycle toggle, then each audience group (GAP-5). */
export const CATALOG_CLASS_NAME = cn("flex", "flex-col", "gap-6")
/** One audience group: its header above its cards (GAP-4). */
export const GROUP_CLASS_NAME = cn("flex", "flex-col", "gap-4")
/** The plan cards of one group. */
export const GRID_CLASS_NAME = cn("grid", "grid-cols-1", "gap-4", "md:grid-cols-3")
/** Blocks inside one plan card (GAP-4). */
export const CARD_CLASS_NAME = cn("flex", "flex-col", "gap-4")
/** A price with its badges and notes (GAP-2). */
export const PRICE_CLASS_NAME = cn("flex", "flex-col", "gap-1")
/** Badges beside each other (GAP-2). */
export const BADGES_CLASS_NAME = cn("flex", "flex-wrap", "gap-2")
/** The included facts, one per line (GAP-2). */
export const FACTS_CLASS_NAME = cn("flex", "flex-col", "gap-1")
