import { cn } from "@heroui/react"

// grammar gap: Text has no prop that keeps the line breaks of a letter written over several lines.
/** Keeps the author's line breaks; the Text inside inherits it. */
export const PRE_WRAP_CLASS_NAME = cn("whitespace-pre-wrap", "break-words")
