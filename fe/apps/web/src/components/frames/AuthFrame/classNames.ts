import { cn } from "@heroui/react"

/** The bar fills the shell header (a flex row), so its row spans the header instead of shrinking to its content. */
export const AUTH_BAR_CLASS_NAME: string | undefined = cn("min-w-0", "flex-1")
/** The body under the bar: the card area takes the free height, the legal links close the page (GAP-7). */
export const AUTH_BODY_CLASS_NAME: string | undefined = cn("flex", "min-h-full", "flex-col", "items-center", "gap-6", "p-3", "md:p-6")
/** The free height above the legal links; the card sits at its centre. */
export const AUTH_MAIN_CLASS_NAME: string | undefined = cn("flex", "w-full", "flex-1", "items-center", "justify-center")
/** The card column at the auth measure, full width on a phone. */
export const AUTH_CARD_CLASS_NAME: string | undefined = cn("w-full", "max-w-md")
