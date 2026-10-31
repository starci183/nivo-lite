import { cn } from "@heroui/react"

/** The frame's regions, top to bottom (GAP-6 between page regions). */
export const FRAME_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-6")
/** The three side regions (done, connections, knowledge) side by side from lg, stacked below (GAP-4 between peer cards). */
export const SIDE_GRID_CLASS_NAME = cn("grid", "min-w-0", "grid-cols-1", "gap-6", "2xl:grid-cols-3")
/** One column of the side grid: its cards stacked (GAP-4). */
export const SIDE_COLUMN_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-4")
/** The module's own content under the tab strip (GAP-4). */
export const PANEL_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-4")
/** The module's own page command under the heading. */
export const COMMAND_CLASS_NAME = cn("flex", "min-w-0", "flex-wrap", "gap-2")
/** The app-owned lists of the list pane: no bullets, no inset of their own (the rows carry theirs). */
export const PANE_LIST_CLASS_NAME = cn("m-0", "flex", "min-w-0", "list-none", "flex-col", "p-0")
