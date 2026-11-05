import { cn } from "@heroui/react"

/** The compose command with its words shows from the medium width; a phone gets the icon alone. */
export const COMPOSE_WORDS_CLASS_NAME: string | undefined = cn("hidden", "md:flex")

/** The icon-only compose command of a phone. */
export const COMPOSE_ICON_CLASS_NAME: string | undefined = cn("flex", "md:hidden")
