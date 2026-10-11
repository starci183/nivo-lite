import { cn } from "@heroui/react"

/** Page stack under the header: tabs, lens, panel (GAP-4). */
export const STACK_CLASS = cn("flex", "min-w-0", "flex-col", "gap-4")
/** The lens row: label and one chip per agent. */
export const LENS_CLASS = cn("flex", "min-w-0", "flex-wrap", "items-center", "gap-2")
/** Map and detail: stacked inside the primary column (the rail takes the side); side by side only on very wide screens. */
export const MAP_GRID_CLASS = cn("grid", "min-w-0", "grid-cols-1", "gap-4", "2xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]")
export const MAP_SVG_CLASS = cn("block", "h-auto", "w-full")
/** Legend band, the joined map card's last band: separator above (PADDING-3), outer edge elsewhere (PADDING-4). */
export const LEGEND_CLASS = cn("flex", "flex-wrap", "items-center", "gap-x-4", "gap-y-1", "px-4", "pb-4", "pt-3")
/** Empty-map band under the drawing: separator above, outer edge elsewhere. */
export const MAP_EMPTY_BAND_CLASS = cn("px-4", "pb-4", "pt-3")
export const LEGEND_ITEM_CLASS = cn("inline-flex", "items-center", "gap-1.5")
export const LEGEND_DOT_CLASS = cn("inline-block", "size-2.5", "rounded-full")
/** Toolbar above a list: search grows, action stays. */
export const TOOLBAR_CLASS = cn("flex", "min-w-0", "flex-wrap", "items-end", "gap-3")
export const TOOLBAR_GROW_CLASS = cn("min-w-0", "flex-1")
/** Form fields in a drawer. */
export const FORM_CLASS = cn("flex", "min-w-0", "flex-col", "gap-4")
export const FORM_ROW_CLASS = cn("grid", "grid-cols-1", "gap-4", "sm:grid-cols-2")
/** Under a review row: the current value vs the proposal, then the evidence. */
export const COMPARE_CLASS = cn("flex", "min-w-0", "flex-col", "gap-1")
export const BUTTONS_CLASS = cn("flex", "flex-wrap", "items-center", "gap-2")
/** Page rhythm, as on Tri thức: header, actions, figures, tabs, panel + rail (GAP-6). */
export const PAGE_CLASS = cn("flex", "min-w-0", "flex-col", "gap-6")
/** Breadcrumb trail above the page heading: one heading block (GAP-2). */
export const HEAD_CLASS = cn("flex", "min-w-0", "flex-col", "gap-2")
/** The rail beside the panel: its cards serve one region, so blocks under one purpose (GAP-4), as Rail's own frame. */
export const SIDE_CLASS = cn("flex", "min-w-0", "flex-col", "gap-4")
