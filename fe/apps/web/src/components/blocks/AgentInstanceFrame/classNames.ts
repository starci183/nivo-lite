import { cn } from "@heroui/react"

/** The actions at the end of the header. */
export const HEADER_ACTIONS = cn("flex", "shrink-0", "flex-wrap", "items-center", "gap-2")

/** The routed tab of a card body (every tab but Setup): it fills the joined surface and scrolls inside it. */
export const BODY = cn("flex", "h-full", "min-h-0", "min-w-0", "flex-col", "overflow-y-auto", "p-4", "sm:p-6")
