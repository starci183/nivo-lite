import { cn } from "@heroui/react"

/** The split screen: the art half and the form half side by side from lg, the form alone below it. */
export const AUTH_SPLIT_CLASS_NAME = cn("grid", "min-h-dvh", "lg:grid-cols-2")
/** Art half: full bleed, edge to edge and top to bottom, with the brand copy over the picture; shown from lg only so the form stays in the first phone screen. */
export const AUTH_ART_PANE_CLASS_NAME = cn("relative", "isolate", "hidden", "overflow-hidden", "lg:block")
/** The picture under the copy: fills the half (SURFACE-6 case-1, aria-hidden). */
export const AUTH_ART_CLASS_NAME = cn("absolute", "inset-0", "-z-10", "[&_img]:h-full", "[&_img]:w-full", "[&>*]:h-full")
/** Brand copy over the picture: the logo at the top, headline and tagline at the bottom, at the stepped inset (PADDING-7). */
export const AUTH_ART_COPY_CLASS_NAME = cn("flex", "h-full", "flex-col", "justify-between", "gap-6", "p-8")
/** Headline and tagline (GAP-2). */
export const AUTH_ART_BOTTOM_CLASS_NAME = cn("flex", "max-w-md", "flex-col", "gap-2")
/** Form half: the language menu at the top, the auth card centred, the legal links at the bottom (PADDING-7). */
export const AUTH_FORM_PANE_CLASS_NAME = cn("flex", "min-h-dvh", "flex-col", "p-6", "lg:p-8")
/** Language menu row, aligned to the end. */
export const AUTH_LOCALE_CLASS_NAME = cn("flex", "justify-end")
/** Centres the auth card in the remaining height. */
export const AUTH_CENTER_CLASS_NAME = cn("flex", "flex-1", "flex-col", "items-center", "justify-center", "gap-6", "py-8")
/** Logo above the card below lg, where the art half is hidden. */
export const AUTH_COMPACT_LOGO_CLASS_NAME = cn("flex", "justify-center", "lg:hidden")
/** Width of the auth card. */
export const AUTH_CARD_CLASS_NAME = cn("w-full", "max-w-sm")
/** Privacy and terms links at the bottom of the form half. */
export const AUTH_LEGAL_CLASS_NAME = cn("flex", "justify-center")
