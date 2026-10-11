import { cn } from "@heroui/react"

/** Page regions stacked under the page heading (GAP-5). */
export const PAGE_CLASS = cn("flex", "flex-col", "gap-6")
/** One provider group: its heading and its list cards (GAP-4). */
export const GROUP_CLASS = cn("flex", "min-w-0", "flex-col", "gap-4")
/** Adjacent inline actions and chips (GAP-2). */
export const ACTIONS_CLASS = cn("flex", "flex-wrap", "items-center", "gap-2")
/** The provider mark inside Grammar's IconTile artwork slot. */
export const PROVIDER_LOGO_CLASS = cn("size-7")
/** The leading slot of a bank-feed row: the same 40px row height as an IconTile, wide enough for a bank wordmark. */
export const BANK_FRAME_CLASS = cn("flex", "h-10", "w-16", "shrink-0", "items-center", "justify-center")
/** A row-wide slot (a nested panel or an alert) that breaks onto its own line inside the row. */
export const FULL_CLASS = cn("w-full", "min-w-0")
/** Content stacked inside a nested panel or a row detail (GAP-3). */
export const PANEL_CLASS = cn("flex", "min-w-0", "flex-col", "gap-3")
export const FULL_BOX_CLASS = cn(PANEL_CLASS, "w-full")

/* ---------- Connector library ---------- */

/** Search, filters and the grid, stacked. */
export const LIBRARY_FILTERS_CLASS = cn("flex", "min-w-0", "flex-col", "gap-4")
/** Connector cards: one column on a phone, up to three on a wide screen. */
export const LIBRARY_GRID_CLASS = cn("grid", "grid-cols-1", "gap-3", "sm:grid-cols-2", "xl:grid-cols-3")
/** Inside a card: logo row, blurb, footer. */
export const LIBRARY_CARD_CLASS = cn("flex", "h-full", "min-w-0", "flex-col", "gap-3")
export const LIBRARY_CARD_HEAD_CLASS = cn("flex", "items-center", "gap-3")
/** Badge on the left, action on the right (wraps on narrow cards). */
export const LIBRARY_CARD_FOOT_CLASS = cn("mt-auto", "flex", "flex-wrap", "items-center", "justify-between", "gap-2")
/** Connector detail drawer body. */
export const DETAIL_CLASS = cn("flex", "min-w-0", "flex-col", "gap-4")
