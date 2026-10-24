import { cn } from "@heroui/react"

/** Vertical rhythm: trail and heading, then the three panels. */
export const PAGE_CLASS_NAME = cn("flex", "flex-col", "gap-6")
/** The trail above the heading: one heading block. */
export const HEAD_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-2")
/** The three panels: threads, the open thread, the execution chain. */
export const PANELS_CLASS_NAME = cn("grid", "grid-cols-1", "gap-4", "lg:grid-cols-[16rem_1fr_20rem]")
/** The open thread: heading line, messages, composer, one over the other and filling the height. */
export const THREAD_CLASS_NAME = cn("flex", "min-h-[32rem]", "min-w-0", "flex-col")
/** The heading line of the open thread. */
export const THREAD_HEAD_CLASS_NAME = cn("flex", "flex-col", "gap-1", "border-b", "border-separator", "p-4")
/** The thread list's next-page control and any retry notice. */
export const PAGINATION_CLASS_NAME = cn("flex", "flex-col", "gap-2", "p-4")
