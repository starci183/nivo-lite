import { cn } from "@heroui/react"

/** The requests of one tab: sections stacked (GAP-5). */
export const PANEL_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-6")

/** One heading over its list (GAP-3). */
export const SECTION_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-3")

/** Status badge and the decision buttons (GAP-3 case-3). */
export const ACTIONS_CLASS_NAME = cn("flex", "min-w-0", "flex-wrap", "items-center", "gap-3")
