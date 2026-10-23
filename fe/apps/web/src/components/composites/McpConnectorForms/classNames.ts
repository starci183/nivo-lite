import { cn } from "@heroui/react"

/** The register fields: one column on a phone, two from md up (GAP-4: field groups). */
export const FIELDS_CLASS_NAME = cn("grid", "grid-cols-1", "gap-4", "md:grid-cols-2")

/** A form inside a card, its hint, fields and actions stacked. */
export const FORM_CLASS_NAME = cn("flex", "flex-col", "gap-4")

/** Button row (GAP-3). */
export const ACTIONS_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-3")
