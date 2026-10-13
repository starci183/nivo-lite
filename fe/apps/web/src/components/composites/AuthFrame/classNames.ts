import { cn } from "@heroui/react"

/** Language switch row above both panes, aligned to the end. */
export const AUTH_LOCALE_CLASS_NAME = cn("flex", "justify-end", "px-4", "py-3", "lg:px-8")
/** Brand card inset on the rail: same stepped inset as the form pane (PADDING-7: p-6 -> p-8). */
export const AUTH_BRAND_PANE_CLASS_NAME = cn("p-6", "lg:p-8")
/** Brand card body under the edge-to-edge art band of the joined card: the band owns no inset, the body takes the outer-edge inset (PADDING-4) and stacks pitch then details (GAP-5). */
export const AUTH_BRAND_STACK_CLASS_NAME = cn("flex", "flex-col", "gap-6", "p-4")
/** SURFACE-6 case-1: decorative accent band with one aria-hidden mascot and no copy; shown from lg only so the form stays in the first phone screen. */
export const AUTH_ART_BAND_CLASS_NAME = cn(
    "relative",
    "isolate",
    "hidden",
    "min-h-32",
    "overflow-hidden",
    "bg-accent",
    "lg:block",
    "lg:min-h-56",
)
/** Pitch under the band: logo, headline, tagline (GAP-4). */
export const AUTH_PITCH_CLASS_NAME = cn("flex", "flex-col", "gap-4")
/** Selling points and the offer, hidden below lg (GAP-4). */
export const AUTH_DETAILS_CLASS_NAME = cn("hidden", "flex-col", "gap-4", "lg:flex")
/** Tagline, hidden below lg. */
export const AUTH_TAGLINE_CLASS_NAME = cn("hidden", "lg:block")
/** Selling points (GAP-3); List owns the reset. */
export const AUTH_POINTS_CLASS_NAME = cn("flex", "flex-col", "gap-3")
/** One point: its mark beside its line (GAP-2). */
export const AUTH_POINT_CLASS_NAME = cn("flex", "items-center", "gap-2")
/** Form pane: centres the auth card with the same stepped inset (PADDING-7). */
export const AUTH_FORM_PANE_CLASS_NAME = cn("flex", "items-center", "justify-center", "p-6", "lg:p-8")
/** Width of the auth card. */
export const AUTH_CARD_CLASS_NAME = cn("w-full", "max-w-md")
/** Privacy and terms links under the auth card. */
export const AUTH_LEGAL_CLASS_NAME = cn("pt-4")
