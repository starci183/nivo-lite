import { cn } from "@heroui/react"

/** The add command with its words shows from the medium width; a phone gets the icon alone. */
export const ADD_WORDS_CLASS_NAME: string | undefined = cn("hidden", "md:flex")

/** The icon-only add command of a phone. */
export const ADD_ICON_CLASS_NAME: string | undefined = cn("flex", "md:hidden")
