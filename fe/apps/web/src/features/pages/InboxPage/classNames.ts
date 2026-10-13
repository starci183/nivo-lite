import { cn } from "@heroui/react"

/** Vertical rhythm between the header, alert, simulator and feed. */
export const PAGE_CLASS = cn("flex", "flex-col", "gap-6")

/** Breadcrumb trail above the page heading: one heading block (GAP-2). */
export const HEAD_CLASS = cn("flex", "min-w-0", "flex-col", "gap-2")

/** Tight stack inside the bank connection card. */
export const STACK_TIGHT_CLASS = cn("flex", "flex-col", "gap-2")

/** Bank name, masked account and the simulated chip on one wrapping line. */
export const BANK_HEAD_CLASS = cn("flex", "flex-wrap", "items-center", "gap-x-3", "gap-y-1")
