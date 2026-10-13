import { cn } from "@heroui/react"

/** Stack inside the card (GAP-4). */
export const STACK_CLASS_NAME = cn("flex", "flex-col", "gap-4")

/** Invite form grid: two columns on desktop (GAP-4). */
export const FORM_GRID_CLASS_NAME = cn("grid", "grid-cols-1", "gap-4", "md:grid-cols-2")

/** The sentence about the invitation just sent, with its link (GAP-2). */
export const SENT_CLASS_NAME = cn("flex", "w-full", "flex-col", "gap-2")
