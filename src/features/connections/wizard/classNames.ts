import { cn } from "@heroui/react"

/** The wizard region below the provider's rows; its leading seam is a Grammar Divider (BOUNDARY-1 case-1), its parts sit on GAP-5. */
export const WIZARD_CLASS = cn("flex", "min-w-0", "flex-col", "gap-6")
export const HEADER_CLASS = cn("flex", "min-w-0", "flex-col", "gap-3")
export const BODY_CLASS = cn("flex", "min-w-0", "flex-col", "gap-4")
export const FIELDS_CLASS = cn("grid", "grid-cols-1", "gap-4", "md:grid-cols-2")
export const FOOTER_CLASS = cn("flex", "flex-col", "gap-2", "sm:flex-row", "sm:flex-wrap", "sm:items-center")
export const ITEMS_CLASS = cn("flex", "min-w-0", "flex-col", "gap-3")
export const BUTTONS_CLASS = cn("flex", "flex-wrap", "items-center", "gap-2")
/** A short copy block: a title line with its explanation (GAP-2). */
export const COPY_CLASS = cn("flex", "min-w-0", "flex-col", "gap-2")
/** Ordered instruction rows (GAP-1 between steps of one list). */
export const NUMBERED_CLASS = cn("flex", "flex-col", "gap-1")
/** Ordered steps that each carry an action (GAP-3). */
export const STEP_LIST_CLASS = cn("flex", "flex-col", "gap-3")
