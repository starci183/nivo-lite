import { cn } from "@heroui/react"

/** The foot line, centred. */
export const FOOT_CLASS_NAME: string | undefined = cn("text-center")

// grammar gap: no Common honeypot field; the bot trap is a grammar Input in an inert, screen-reader-only wrapper.
/** Hidden from people, present for bots: the honeypot field. */
export const HONEYPOT_CLASS_NAME: string | undefined = cn("sr-only")
