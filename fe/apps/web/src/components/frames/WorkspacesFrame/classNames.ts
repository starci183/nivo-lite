import { cn } from "@heroui/react"

/** The bar fills the shell header (a flex row), so its row spans the header instead of shrinking to its content. */
export const BAR_CLASS_NAME: string | undefined = cn("min-w-0", "flex-1")
