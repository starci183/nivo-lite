import { cn } from "@heroui/react"

/** Two fact lists side by side on wide screens (GAP-5 between the columns). */
export const FACTS_CLASS_NAME = cn("grid", "grid-cols-1", "gap-x-6", "md:grid-cols-2")

/** Peer sections in two columns on very wide screens (GAP-5). */
export const GRID_CLASS_NAME = cn("grid", "grid-cols-1", "gap-6", "xl:grid-cols-2")
