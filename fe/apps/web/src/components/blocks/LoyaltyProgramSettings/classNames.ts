import { cn } from "@heroui/react"

/** Stacked form fields. */
export const FORM_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-3")
/** Two fields side by side from tablet width. */
export const FIELD_PAIR_CLASS_NAME = cn("grid", "grid-cols-1", "gap-3", "sm:grid-cols-2")
/** Three fields side by side from tablet width. */
export const FIELD_TRIPLE_CLASS_NAME = cn("grid", "grid-cols-1", "gap-3", "sm:grid-cols-3")
/** The save button. */
export const ACTIONS_CLASS_NAME = cn("flex", "shrink-0", "flex-wrap", "items-center", "gap-2")
