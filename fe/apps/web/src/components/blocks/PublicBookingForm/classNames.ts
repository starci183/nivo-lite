import { cn } from "@heroui/react"

/** The customer's form: one surface per step (GAP-4 case-3). */
export const FORM_CLASS = cn("flex", "min-w-0", "flex-col", "gap-4")
/** The content of one surface: its heading and fields (GAP-3). */
export const STACK_CLASS = cn("flex", "min-w-0", "flex-col", "gap-3")
/** A line of peer buttons that wraps (GAP-2 case-3). */
export const ROW_CLASS = cn("flex", "flex-wrap", "items-center", "gap-2")
/** Hidden from people, present for bots. */
export const HONEYPOT_CLASS = cn("sr-only")
