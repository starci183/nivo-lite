import { cn } from "@heroui/react"

/** The bar fills the shell header (a flex row), so the page measure inside it centres instead of shrinking to its content. */
export const BAR_CLASS_NAME = cn("min-w-0", "flex-1")

/** The bar row spans the measure: the logo at the start, the language and account menus at the end (GAP-4). */
export const TOP_CLASS_NAME = cn("flex", "w-full", "items-center", "justify-between", "gap-4")

/** Language switch beside the account menu (GAP-3). */
export const TOP_END_CLASS_NAME = cn("flex", "items-center", "gap-3")
