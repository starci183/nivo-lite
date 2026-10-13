import { cn } from "@heroui/react"

/** Vertical rhythm: header, filters, list. */
export const PAGE = cn("flex", "flex-col", "gap-4")
/** A tab strip that scrolls sideways on phones instead of widening the page. */
export const TABS = cn("max-w-full", "overflow-x-auto")
/** Filter block: kind tabs over department tabs. */
export const FILTERS = cn("flex", "flex-col", "gap-2")
/** Breadcrumb trail above the page heading: one heading block. */
export const HEAD = cn("flex", "min-w-0", "flex-col", "gap-2")
