import { cn } from "@heroui/react"

/** The post, the apply card and the foot line, stacked (GAP-6). */
export const STACK_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-6")

/** The inside of a card, stacked (GAP-4 case-3). */
export const CARD_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-4")

/** The foot line, centred. */
export const FOOT_CLASS_NAME = cn("text-center")

// grammar gap: no Common honeypot field; the bot trap is a grammar Input in an inert, screen-reader-only wrapper.
/** Hidden from people, present for bots: the honeypot field. */
export const HONEYPOT_CLASS_NAME = cn("sr-only")
