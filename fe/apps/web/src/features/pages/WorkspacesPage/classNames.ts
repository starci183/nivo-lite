import { cn } from "@heroui/react"

/** Page regions (GAP-5). */
export const STACK_CLASS_NAME = cn("flex", "flex-col", "gap-6")

/** Welcome card: copy column beside the art band from md, stacked on mobile (GAP-5). */
export const WELCOME_GRID_CLASS_NAME = cn("grid", "grid-cols-1", "md:grid-cols-5")

/** Copy column of the welcome card (GAP-4). */
export const WELCOME_COPY_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "items-start", "gap-4", "p-4", "md:col-span-3")

/** SURFACE-6 case-1: the decorative hero band at full accent strength; it carries one aria-hidden image and no copy. This is the page's only brand signature moment (DISCIPLINE-3). */
export const WELCOME_ART_CLASS_NAME = cn(
    "relative",
    "isolate",
    "order-first",
    "h-40",
    "overflow-hidden",
    "bg-accent",
    "md:order-none",
    "md:col-span-2",
    "md:h-auto",
)

/** A square frame as tall as the band, centred: the square mascot fits the band whatever its height. */
export const WELCOME_IMAGE_CLASS_NAME = cn(
    "absolute",
    "inset-y-0",
    "left-1/2",
    "aspect-square",
    "h-full",
    "-translate-x-1/2",
)
