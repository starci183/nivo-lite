import { cn } from "@heroui/react"

/** The split screen: the art half and the form half side by side from lg, the form alone below it. */
export const AUTH_SPLIT_CLASS_NAME = cn("grid", "min-h-dvh", "lg:grid-cols-2")
/** Art half: the Backdrop fills it top to bottom; shown from lg only so the form stays in the first phone screen. */
export const AUTH_ART_PANE_CLASS_NAME = cn("hidden", "min-h-dvh", "flex-col", "lg:flex", "[&>*]:flex-1")
/** Form half: the language menu at the top, the auth card centred, the legal links at the bottom (PADDING-7). */
export const AUTH_FORM_PANE_CLASS_NAME = cn("flex", "min-h-dvh", "flex-col", "p-6", "lg:p-8")
/** Language menu row, aligned to the end. */
export const AUTH_LOCALE_CLASS_NAME = cn("flex", "justify-end")
/** Centres the auth card in the remaining height. */
export const AUTH_CENTER_CLASS_NAME = cn(
    "flex",
    "flex-1",
    "flex-col",
    "items-center",
    "justify-center",
    "gap-6",
    "py-8",
)
/** Logo above the card below lg, where the art half is hidden. */
export const AUTH_COMPACT_LOGO_CLASS_NAME = cn("flex", "justify-center", "lg:hidden")
/** Width of the auth card. */
export const AUTH_CARD_CLASS_NAME = cn("w-full", "max-w-sm")
/** Privacy and terms links at the bottom of the form half. */
export const AUTH_LEGAL_CLASS_NAME = cn("flex", "justify-center")
