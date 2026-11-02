import { cn } from "@heroui/react"

/** The fields of the draft stacked inside the drawer (GAP-4). */
export const FORM_CLASS_NAME = cn("flex", "flex-col", "gap-4")

/** The internal documents and the left-out line, a step apart (GAP-3). */
export const SOURCES_CLASS_NAME = cn("flex", "flex-col", "gap-2")

/** The commands at the foot of the draft wrap on phones and sit at the end (GAP-3). */
export const FOOTER_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "justify-end", "gap-2")
