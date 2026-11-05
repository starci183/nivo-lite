import { cn } from "@heroui/react"

/** A centred line inside the thread. */
export const NOTICE_ROW_CLASS_NAME: string | undefined = cn("flex", "min-w-0", "justify-center")
/** The messages sit at the foot of the thread, so a short conversation ends beside the composer. */
export const MESSAGES_CLASS_NAME: string | undefined = cn("mt-auto", "flex", "min-w-0", "flex-col", "gap-3")
