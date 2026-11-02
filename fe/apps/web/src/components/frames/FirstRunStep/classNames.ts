import { cn } from "@heroui/react"

/** The step track centred above the step body (GAP-6). */
export const STEP_CLASS_NAME = cn("flex", "flex-col", "items-center", "gap-6")
/** The step card (its own form measure) beside the step mascot, centred as one group; the mascot drops below the card on a narrow screen and never covers a field or action (GAP-7). */
export const STEP_BODY_CLASS_NAME = cn(
    "flex",
    "w-full",
    "flex-col",
    "items-center",
    "justify-center",
    "gap-8",
    "lg:flex-row",
)
/** The step track at a fixed share of the card width so short step names stay on one line. */
export const STEP_TRACK_CLASS_NAME = cn("w-full", "max-w-xl")
/** The step mascot keeps its own size beside the card instead of taking the free width. */
export const STEP_ART_CLASS_NAME = cn("flex", "shrink-0", "justify-center")
/** The card column at the form measure, so the card and the mascot sit together in the centre. */
export const STEP_CARD_CLASS_NAME = cn("w-full", "max-w-lg", "min-w-0")
