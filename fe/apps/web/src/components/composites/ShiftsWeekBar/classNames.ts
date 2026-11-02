import { cn } from "@heroui/react"

/** The bar and what sits under it (GAP-3). */
export const PANEL_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-3")

/** Navigation on one side, the schedule actions on the other, wrapping on phones (GAP-3 case-3). */
export const BAR_CLASS_NAME = cn("flex", "min-w-0", "flex-wrap", "items-center", "justify-between", "gap-3")

/** A wrapping row of controls (GAP-3 case-3). */
export const NAV_CLASS_NAME = cn("flex", "min-w-0", "flex-wrap", "items-center", "gap-3")

/** The propose and publish buttons (GAP-3 case-3). */
export const ACTIONS_CLASS_NAME = cn("flex", "min-w-0", "flex-wrap", "items-center", "gap-3")
