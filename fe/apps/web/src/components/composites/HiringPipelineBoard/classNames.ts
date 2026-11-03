import { cn } from "@heroui/react"

/** The pipeline board: one lane per stage; the scroll region owns the sideways overflow. Hidden on phones, where the pipeline is a list. */
export const BOARD_CLASS_NAME: string | undefined = cn("min-w-full")

/** The board frame: only from the medium step up. */
export const BOARD_FRAME_CLASS_NAME: string | undefined = cn("hidden", "md:block")

/** One lane column: a fixed 15rem track on narrow screens, an equal share on wide ones. */
export const LANE_CLASS_NAME: string | undefined = cn("flex", "w-60", "shrink-0", "flex-col", "xl:w-auto", "xl:min-w-0", "xl:flex-1")

/** The phone pipeline: stages stacked as a list. */
export const LIST_CLASS_NAME: string | undefined = cn("md:hidden")

/** The same, grabbable on the board. */
export const CARD_DRAG_CLASS_NAME: string | undefined = cn("cursor-grab", "active:cursor-grabbing")
