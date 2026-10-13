import { cn } from "@heroui/react"

/** A section heading with the week controls on the right (GAP-2). */
export const HEAD_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "justify-between", "gap-2")

/** A row of commands (GAP-2). */
export const ACTIONS_CLASS_NAME = cn("flex", "shrink-0", "flex-wrap", "items-center", "gap-2")

/** The week calendar: seven day columns on wide screens, a plain agenda on phones (GAP-2 between day columns). */
export const WEEK_CLASS_NAME = cn("grid", "grid-cols-1", "gap-2", "md:grid-cols-7")

/** The lines of one invitation (GAP-1). */
export const LINES_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-1")
