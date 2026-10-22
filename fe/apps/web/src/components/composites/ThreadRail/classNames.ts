import { cn } from "@heroui/react"

/** The rail: head, the new-thread form when open, the list. */
export const RAIL_CLASS_NAME = cn("flex", "min-h-0", "flex-col", "gap-3")
/** The title line with the new-thread button at the end. */
export const HEAD_CLASS_NAME = cn("flex", "items-center", "justify-between", "gap-2")
/** The new-thread form: the field, then its two buttons. */
export const FORM_CLASS_NAME = cn("flex", "flex-col", "gap-2")
/** The two buttons of the form. */
export const FORM_ACTIONS_CLASS_NAME = cn("flex", "items-center", "gap-2")
