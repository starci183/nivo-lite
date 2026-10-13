import { cn } from "@heroui/react"

/** The invitation column: logo, then the card, centred in the shell (GAP-5, MEASURE-4 case-3). */
export const INVITE_COLUMN_CLASS_NAME = cn("mx-auto", "flex", "w-full", "max-w-md", "flex-col", "gap-6", "py-10")
/** Peer actions or notes inside the card (GAP-3). */
export const INVITE_STACK_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-3")
