import { cn } from "@heroui/react"

/** The step rail beside the step card from the large breakpoint, the pair centred; stacked above the card on a narrow screen (GAP-6). */
export const STEP_CLASS_NAME: string | undefined = cn(
    "grid",
    "w-full",
    "items-start",
    "justify-center",
    "gap-6",
    "lg:grid-cols-[18rem_32rem]",
    "lg:pt-12",
)
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
