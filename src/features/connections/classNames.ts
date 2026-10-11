import { cn } from "@heroui/react"

export const PAGE_CLASS = cn("flex", "flex-col", "gap-6")
export const GROUP_CLASS = cn("flex", "min-w-0", "flex-col", "gap-4")
export const ACTIONS_CLASS = cn("flex", "flex-wrap", "items-center", "gap-2")
export const PROVIDER_LOGO_CLASS = cn("size-7")
/** The leading slot of a bank-feed row: the same 40px row height as an IconTile, wide enough for a bank wordmark. */
export const BANK_FRAME_CLASS = cn("flex", "h-10", "w-16", "shrink-0", "items-center", "justify-center")
export const BOX_CLASS = cn("flex", "min-w-0", "flex-col", "gap-3")
export const FULL_BOX_CLASS = cn(BOX_CLASS, "w-full")
