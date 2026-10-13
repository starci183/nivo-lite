import { cn } from "@heroui/react"

/** The copy column, capped so the artwork zone keeps its corner. */
export const WELCOME_COPY = cn("flex", "min-w-0", "max-w-xl", "flex-col", "items-start", "gap-4")
/** The title beside its dismiss control. */
export const WELCOME_HEAD = cn("flex", "w-full", "items-start", "justify-between", "gap-3")
/** The actions. */
export const WELCOME_ACTIONS = cn("flex", "flex-wrap", "items-center", "gap-3")
