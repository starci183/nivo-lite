import { cn } from "@heroui/react"

/** The findings of one dossier: the header, the lists and the load more, a region step apart (GAP-5); the pane band around it gives the inset. */
export const PANE_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-6")

/** The status badges and the review line under the heading wrap on phones (GAP-3). */
export const STATUS_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-2")

/** The list under its filter (GAP-4). */
export const LIST_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-4")
