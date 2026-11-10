import { cn } from "@heroui/react"

/** The aside opener shows below the wide width, where the facts are a drawer and not a column. */
export const BELOW_WIDE_CLASS_NAME: string | undefined = cn("inline-flex", "min-[70rem]:hidden")

/** The way back shows on a phone only: wider grids keep the list beside the customer. */
export const PHONE_ONLY_CLASS_NAME: string | undefined = cn("inline-flex", "md:hidden")

/** The identity row of the head card: the avatar, the name with its source, the commands at the end. */
export const IDENTITY_ROW_CLASS_NAME: string | undefined = cn("flex", "items-center", "gap-3")

/** The name and the source line take the width the commands leave. */
export const IDENTITY_TEXT_CLASS_NAME: string | undefined = cn("min-w-0", "flex-1")

/** The hand-over select grows and the message button keeps its size, on one row at every width. */
export const COMMANDS_ROW_CLASS_NAME: string | undefined = cn("flex", "items-center", "gap-2")
