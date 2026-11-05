import { cn } from "@heroui/react"

/** A centred line inside the thread. */
export const NOTICE_ROW_CLASS_NAME: string | undefined = cn("flex", "min-w-0", "justify-center")
/** The messages of one conversation, one column; the thread band sits them at its foot. */
export const MESSAGES_CLASS_NAME: string | undefined = cn("flex", "min-w-0", "flex-col", "gap-3")
