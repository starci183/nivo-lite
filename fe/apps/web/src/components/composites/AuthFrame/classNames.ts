import { cn } from "@heroui/react"

/** Art pane on the rail: holds the ink brand card at full height with the stepped inset (PADDING-7); shown from lg only so the form stays in the first phone screen. */
export const AUTH_ART_PANE_CLASS_NAME = cn("hidden", "min-h-dvh", "flex-col", "p-8", "lg:flex", "[&>*]:flex-1")
/** Brand copy inside the ink card: the logo at the top, headline and tagline at the bottom (GAP-6). */
export const AUTH_ART_COPY_CLASS_NAME = cn("flex", "h-full", "flex-col", "justify-between", "gap-6")
/** Headline and tagline (GAP-2). */
export const AUTH_ART_BOTTOM_CLASS_NAME = cn("flex", "max-w-md", "flex-col", "gap-2")
/** Form pane: the language switch at the top, the auth card centred, the legal links at the bottom, at the stepped inset (PADDING-7). */
export const AUTH_FORM_PANE_CLASS_NAME = cn("flex", "min-h-dvh", "flex-col", "p-6", "lg:p-8")
/** Language switch row, aligned to the end. */
export const AUTH_LOCALE_CLASS_NAME = cn("flex", "justify-end")
/** Centres the auth card in the remaining height. */
export const AUTH_CENTER_CLASS_NAME = cn("flex", "flex-1", "flex-col", "items-center", "justify-center", "gap-6", "py-8")
/** Logo above the card below lg, where the art pane is hidden. */
export const AUTH_COMPACT_LOGO_CLASS_NAME = cn("flex", "justify-center", "lg:hidden")
/** Width of the auth card. */
export const AUTH_CARD_CLASS_NAME = cn("w-full", "max-w-sm")
/** Privacy and terms links at the bottom of the form pane. */
export const AUTH_LEGAL_CLASS_NAME = cn("flex", "justify-center")
