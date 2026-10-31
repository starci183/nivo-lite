import { cn } from "@heroui/react"

/** The meter over the categories keeps the room of a panel edge (GAP-5). */
export const METER_CLASS_NAME = cn("p-4")

/** The main pane: the heading, the status counts and the dossiers of the category, a region step apart (GAP-5). */
export const MAIN_PANE_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-6", "p-4", "sm:p-6")

/** The status counts wrap on phones (GAP-3). */
export const COUNTS_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-2")

/** The dossiers of the category under their heading (GAP-4). */
export const CATEGORY_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-4")
