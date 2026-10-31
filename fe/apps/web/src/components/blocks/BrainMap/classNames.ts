import { cn } from "@heroui/react"

/** The map band: the status filter over the graph, a region step apart (GAP-5). */
export const MAP_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-6")

/** The status badges of the selected node wrap on phones (GAP-3). */
export const BADGES_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-2")

/** The summary of the selected node over the findings of its dossier, a region step apart (GAP-5). */
export const DETAIL_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-6")
