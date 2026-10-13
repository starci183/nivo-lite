import { cn } from "@heroui/react"

/** Thread scroll region on the card face (SURFACE-1: no own fill). */
export const THREAD_CLASS_NAME = cn("flex", "min-h-0", "flex-1", "flex-col", "gap-3", "overflow-y-auto", "p-4")
/** A centred line inside the thread. */
export const NOTICE_ROW_CLASS_NAME = cn("flex", "min-w-0", "justify-center")
