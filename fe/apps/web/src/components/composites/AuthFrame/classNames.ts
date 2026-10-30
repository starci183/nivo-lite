import { cn } from "@heroui/react"

/** The split screen: the art half and the form half side by side from lg, the form alone below it. */
export const AUTH_SPLIT_CLASS_NAME = cn("grid", "min-h-dvh", "lg:grid-cols-2")
/** Art half: edge to edge and top to bottom with a rounded bottom-end corner, with the brand copy over the picture; shown from lg only so the form stays in the first phone screen. */
export const AUTH_ART_PANE_CLASS_NAME = cn("relative", "isolate", "hidden", "overflow-hidden", "rounded-br-[3rem]", "lg:block")
/** The plain ground under everything: a one-colour picture stretched over the whole half (SURFACE-6 case-1, aria-hidden). */
export const AUTH_GROUND_CLASS_NAME = cn("absolute", "inset-0", "-z-20", "[&>*]:h-full", "[&_img]:h-full", "[&_img]:w-full", "[&_img]:object-cover")
/** The scene over the ground: centred and scaled to the half, clear of the logo above and the copy below (SURFACE-6 case-1, aria-hidden). */
export const AUTH_ART_CLASS_NAME = cn(
    "absolute",
    "inset-x-8",
    "top-24",
    "bottom-40",
    "-z-10",
    "flex",
    "items-center",
    "justify-center",
    "[&>*]:aspect-[975/1428]",
    "[&>*]:h-full",
    "[&>*]:max-w-full",
    "[&>*]:w-auto",
    "[&_img]:h-full",
    "[&_img]:w-full",
)
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
