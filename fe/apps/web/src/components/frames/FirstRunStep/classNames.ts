import { cn } from "@heroui/react"

/** The step rail beside the step card from the large breakpoint, the pair centred; one full-width column on a narrow screen (GAP-6). */
export const STEP_CLASS_NAME: string | undefined = cn(
    "grid",
    "w-full",
    "grid-cols-1",
    "items-start",
    "justify-center",
    "gap-6",
    "lg:grid-cols-[18rem_32rem]",
    "lg:pt-12",
)
/** The step rail card: from the large breakpoint only, a narrow screen shows the step bar instead. */
export const STEP_RAIL_CLASS_NAME: string | undefined = cn("hidden", "lg:block")
/** The segmented step bar above the card on a narrow screen. */
export const STEP_BAR_CLASS_NAME: string | undefined = cn("lg:hidden")
/** The step card column at the form width beside the rail. */
export const STEP_CARD_CLASS_NAME: string | undefined = cn("min-w-0")
/** The finished screen: the mascot over the ready card, centred at the form measure. */
export const STEP_DONE_CLASS_NAME: string | undefined = cn(
    "mx-auto",
    "flex",
    "w-full",
    "max-w-lg",
    "flex-col",
    "items-center",
    "gap-6",
    "lg:pt-12",
)
/** The rail mascot is decoration: a phone, where the rail sits above the form, shows none. */
export const STEP_ART_CLASS_NAME: string | undefined = cn("hidden", "shrink-0", "lg:flex")
/** The wide step: the track over a full-width body at the product measure (GAP-7 between them). */
export const STEP_WIDE_CLASS_NAME: string | undefined = cn(
    "mx-auto",
    "flex",
    "w-full",
    "max-w-6xl",
    "flex-col",
    "gap-8",
    "lg:pt-2",
)
/** The horizontal step track of the wide step, from the large breakpoint; a narrow screen shows the step bar. */
export const STEP_TRACK_CLASS_NAME: string | undefined = cn("hidden", "w-full", "max-w-2xl", "self-center", "lg:block")
