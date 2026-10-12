import { cn } from "@heroui/react"

/**
 * App-owned layout of the in-app Chatbot promos. Faces, edges, type and colour belong to Grammar (SurfaceCard incl.
 * its ink band, DescriptionList, Badge, Text, Button, CloseButton, Divider). No literal colour, no arbitrary value.
 */

/** Promo row at the top of the leads list: row, then its closing seam (GAP-4; BOUNDARY-1 by `Divider`). */
export const PROMO_BLOCK = cn("flex", "min-w-0", "flex-col", "gap-4", "pb-4")
/** Copy, then actions; wraps on narrow widths (GAP-3). */
export const PROMO_ROW = cn("flex", "min-w-0", "flex-wrap", "items-center", "gap-3")
/** Copy takes the free width (GAP-1: title over qualifier). */
export const PROMO_COPY = cn("flex", "min-w-0", "flex-1", "basis-64", "flex-col", "gap-1")
/** Action beside its dismiss control (GAP-2 case-3). */
export const PROMO_ACTIONS = cn("flex", "items-center", "gap-2")
/** Lead wait note: explanation beside its action (GAP-3). */
export const NUDGE = cn("flex", "flex-wrap", "items-center", "gap-3")

/** Welcome band copy column, capped so the ink band's artwork zone keeps its corner (MEASURE-4; GAP-4). */
export const WELCOME_COPY = cn("flex", "min-w-0", "max-w-xl", "flex-col", "items-start", "gap-4")
/** Welcome title beside its dismiss control (GAP-3). */
export const WELCOME_HEAD = cn("flex", "w-full", "items-start", "justify-between", "gap-3")
/** Welcome actions (GAP-3 case-3). */
export const WELCOME_ACTIONS = cn("flex", "flex-wrap", "items-center", "gap-3")
