import { cn } from "@heroui/react"

/** Public ROOT_CLASS_NAME declaration. */
export const ROOT_CLASS_NAME = cn("flex", "flex-row", "items-start", "gap-3", "w-full", "[&>*:nth-child(2)]:min-w-0", "[&>*:nth-child(2)]:grow")
/** Public BODY_CLASS_NAME declaration. */
export const BODY_CLASS_NAME = cn("flex", "flex-col", "gap-3")
/** Public SENTENCE_CLASS_NAME declaration. */
export const SENTENCE_CLASS_NAME = cn("flex", "flex-row", "flex-wrap", "items-center", "gap-2")