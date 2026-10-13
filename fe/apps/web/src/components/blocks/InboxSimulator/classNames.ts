import { cn } from "@heroui/react"

/** Stack inside a card. */
export const STACK_CLASS = cn("flex", "flex-col", "gap-4")

/** Preset button row, wrapping on phones. */
export const PRESETS_CLASS = cn("flex", "flex-wrap", "gap-2")

/** Two-column form grid. */
export const FORM_GRID_CLASS = cn("grid", "grid-cols-1", "gap-4", "md:grid-cols-2")

/** Field spanning both columns. */
export const FORM_WIDE_CLASS = cn("md:col-span-2")

/** Event id field with its "new code" action, aligned to the input's baseline. */
export const EVENT_ID_ROW_CLASS = cn("flex", "items-end", "gap-2", "md:col-span-2")

/** The event id input grows; the action keeps its width. */
export const EVENT_ID_INPUT_CLASS = cn("min-w-0", "flex-1")

/** Submit row. */
export const SUBMIT_ROW_CLASS = cn("flex", "justify-end", "md:col-span-2")

/** Result line links. */
export const RESULT_LINKS_CLASS = cn("flex", "flex-wrap", "items-center", "gap-4")
