import { cn } from "@heroui/react"

/** The commands that stand in the head from the medium width: the buttons of the conversation. */
export const WIDE_ONLY_CLASS_NAME: string | undefined = cn("hidden", "md:block")
/** The one menu of a phone, which holds every command the head carries from the medium width. */
export const PHONE_ONLY_CLASS_NAME: string | undefined = cn("md:hidden")
