import { cn } from "@heroui/react"

/** The meta line, the evidence and the actions under the copy of a row keep a small step apart (GAP-4). */
export const DETAIL_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-2", "pt-2")

/** The actions of a row wrap on phones (GAP-3). */
export const ACTIONS_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-2")

/** The evidence under a row: its rows and the links to the documents they come from (GAP-4). */
export const EVIDENCE_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-2")

/** The links to the documents the evidence comes from wrap on phones (GAP-3). */
export const SOURCES_CLASS_NAME = cn("flex", "flex-wrap", "gap-x-4", "gap-y-1")
