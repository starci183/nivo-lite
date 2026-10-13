import { cn } from "@heroui/react"

/** Stacks the accounting header, figures, shared regions and selected workbench panel. */
export const FRAME_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-6")
/** Keeps one accounting workbench heading block above the figures. */
export const HEAD_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-2")
/** Arranges done, connections and knowledge into three columns on wide screens. */
export const SIDE_GRID_CLASS_NAME = cn("grid", "min-w-0", "grid-cols-1", "gap-6", "2xl:grid-cols-3")
/** Stacks knowledge and its open gaps inside their shared column. */
export const SIDE_COLUMN_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-4")
/** Preserves the selected panel's vertical spacing beneath the tab strip. */
export const PANEL_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-4")
