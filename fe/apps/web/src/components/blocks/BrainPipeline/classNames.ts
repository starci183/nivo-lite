import { cn } from "@heroui/react"

/** The four steps sit in a row on desktop and two by two on phones (GAP-3). */
export const PIPELINE_CLASS_NAME = cn("grid", "grid-cols-2", "gap-4", "md:grid-cols-4")

/** The label, the figure and the note of one step stack inside its card (GAP-4). */
export const STEP_CLASS_NAME = cn("flex", "flex-col", "gap-1")

/** The strip and the notice under it stack (GAP-5). */
export const PIPELINE_REGION_CLASS_NAME = cn("flex", "flex-col", "gap-4")
