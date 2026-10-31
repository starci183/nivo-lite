import { cn } from "@heroui/react"

/** The note, the fields, the placeholders and the evidence of a draft, a region step apart (GAP-5). */
export const BODY_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-6")

/** The fields of the form stay one column (RESPONSIVE-1 case-6). */
export const FORM_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-4")

/** The decision group in the footer wraps on phones (GAP-3). */
export const FOOTER_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "justify-end", "gap-2")
