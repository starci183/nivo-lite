import { cn } from "@heroui/react"

/** The invisible layer the bubble may be dragged within (framer measures it). */
export const VIEWPORT_CLASS = cn("pointer-events-none", "fixed", "inset-0", "z-0")
/**
 * The draggable holder of the guide's Grammar IconButton: position, drag affordance and stacking only (the IconButton owns the
 * plate, glyph and focus ring). grammar gap: no floating accent action button, so the bubble wears IconButton's own plate.
 */
export const BUBBLE_CLASS = cn("fixed", "left-0", "top-0", "z-50", "flex", "size-14", "touch-none", "select-none", "items-center", "justify-center", "cursor-grab", "active:cursor-grabbing")
/** The floating panel's position and stacking (the SurfaceCard inside owns face, radius, clip and elevation: BOUNDARY-6). */
export const PANEL_CLASS = cn("fixed", "z-50", "flex", "flex-col")
/** Panel anatomy inside the joined card: head, scrolling messages, suggestions, ask form. */
export const PANEL_BODY_CLASS = cn("flex", "h-full", "min-h-0", "flex-col")
/** The panel's head band: one trailing seam (BOUNDARY-1 case-2), separator-facing inset (PADDING-3). */
export const PANEL_HEAD_CLASS = cn("flex", "shrink-0", "items-start", "justify-between", "gap-3", "border-b", "border-separator", "px-4", "py-3")
export const PANEL_HEAD_TEXT_CLASS = cn("flex", "min-w-0", "flex-col", "gap-1")
/** The one scroll owner of the panel: the conversation (GAP-3 between messages). */
export const MESSAGES_CLASS = cn("flex", "min-h-0", "flex-1", "flex-col", "gap-3", "overflow-y-auto", "px-4", "py-3")
/** Content stacked inside one guide ChatBubble (GAP-2). */
export const REPLY_CLASS = cn("flex", "min-w-0", "flex-col", "gap-2")
/** Numbered steps of a reply (GAP-1). */
export const STEPS_CLASS = cn("flex", "flex-col", "gap-1")
export const LINKS_CLASS = cn("flex", "flex-wrap", "gap-2")
export const SUGGEST_CLASS = cn("flex", "shrink-0", "flex-wrap", "gap-2", "px-4", "pb-3")
/** The ask form band: one leading seam (BOUNDARY-1 case-3). */
export const FOOT_CLASS = cn("flex", "shrink-0", "flex-col", "gap-2", "border-t", "border-separator", "px-4", "py-3")
export const ASK_ROW_CLASS = cn("flex", "items-end", "gap-2")
export const ASK_INPUT_CLASS = cn("min-w-0", "flex-1")
