import { cn } from "@heroui/react"

/** Stacked form fields (GAP-3). */
export const FORM_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-3")
/** Stack of content inside a card; the card owns the inset (PADDING-4 case-2), this only stacks (GAP-3). */
export const BODY_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-3")
/** Two fields side by side from tablet width. */
export const FIELD_PAIR_CLASS_NAME = cn("grid", "grid-cols-1", "gap-3", "sm:grid-cols-2")
/** The segment checkboxes on one wrapping line. */
export const CHECKS_CLASS_NAME = cn("flex", "flex-wrap", "gap-x-6", "gap-y-2")
