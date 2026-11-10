import { cn } from "@heroui/react"

/** Every step: the step track over the step body, one column at the product measure (GAP-7 between them). */
export const STEP_CLASS_NAME: string | undefined = cn("mx-auto", "flex", "w-full", "max-w-6xl", "flex-col", "gap-8", "lg:pt-2")
/** The segmented step bar on a narrow screen; the horizontal track takes its place from the large breakpoint. */
export const STEP_BAR_CLASS_NAME: string | undefined = cn("lg:hidden")
/** The horizontal step track, from the large breakpoint, at the same place on every step. */
export const STEP_TRACK_CLASS_NAME: string | undefined = cn("hidden", "w-full", "max-w-3xl", "self-center", "lg:block")
/** A form step's card, centred at the form width under the track. */
export const STEP_FORM_CLASS_NAME: string | undefined = cn("mx-auto", "w-full", "max-w-xl", "min-w-0")
