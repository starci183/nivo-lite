import { cn } from "@heroui/react"

/** The message field grows (the Grammar Textarea owns its face). */
export const COMPOSER_INPUT_CLASS_NAME: string | undefined = cn("min-w-0", "flex-1")
/** The suggested prompts stand above the field from the medium width; a phone keeps the screen for the thread. */
export const PROMPTS_CLASS_NAME: string | undefined = cn("hidden", "md:block")
