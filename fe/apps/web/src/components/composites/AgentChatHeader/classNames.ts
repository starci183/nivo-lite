import { cn } from "@heroui/react"

/** The header row of the chat; a Divider closes it. */
export const HEADER_CLASS_NAME = cn("flex", "min-w-0", "items-center", "gap-3", "px-3", "py-3")
/** The header row with the seam below it. */
export const HEADER_WRAP_CLASS_NAME = cn("flex", "min-w-0", "flex-col")
/** The name and the state line of the agent. */
export const HEADER_COPY_CLASS_NAME = cn("flex", "min-w-0", "flex-1", "flex-col")
/** The controls at the end of the header. */
export const HEADER_ACTIONS_CLASS_NAME = cn("flex", "shrink-0", "items-center", "gap-2")
/** The back control, hidden on phones. */
export const BACK_CLASS_NAME = cn("max-sm:hidden")
