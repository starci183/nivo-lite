import { cn } from "@heroui/react"

/** The invitation column: logo, then the card, centred in the shell (GAP-5, MEASURE-4 case-3). */
export const INVITE_COLUMN_CLASS_NAME = cn("mx-auto", "flex", "w-full", "max-w-md", "flex-col", "gap-6")

/** Invitation page: one centred task column on the canvas (MEASURE-4 case-3: a capped form region, `mx-auto`). */
export const INVITE_MAIN = "flex min-h-dvh items-center py-10"
/** The invitation column: logo, then the card (GAP-5). */
export const INVITE_COLUMN = "mx-auto flex w-full max-w-md flex-col gap-6"
