import { cn } from "@heroui/react"

/** Google sign-in and the "or" divider, stacked full width (GAP-3). */
export const LOGIN_ACTIONS_CLASS_NAME = cn("flex", "w-full", "flex-col", "gap-3")
/** Fields of the sign-in form (GAP-4 case-3). */
export const LOGIN_FIELDS_CLASS_NAME = cn("flex", "flex-col", "gap-4")
/** The forgot-password action, aligned to the end of the field column. */
export const LOGIN_ROW_CLASS_NAME = cn("flex", "justify-end")
/** Centred sign-up prompt and its action (GAP-2 case-3). */
export const LOGIN_CENTER_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "justify-center", "gap-2")
