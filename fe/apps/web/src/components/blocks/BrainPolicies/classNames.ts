import { cn } from "@heroui/react"

/** The value at the end of a rule row: on a phone it is held to a narrow column so the name keeps its width (it wraps inside it), from the medium width it takes what it needs. */
export const VALUE_CLASS_NAME: string | undefined = cn("min-w-0", "max-w-36", "text-right", "md:max-w-none")
