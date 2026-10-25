import { cn } from "@heroui/react"

/** A section heading with the job filter on the right (GAP-2). */
export const HEAD_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "justify-between", "gap-2")

/** The pipeline board: one lane per stage; the scroll region owns the sideways overflow. Hidden on phones, where the pipeline is a list. */
export const BOARD_CLASS_NAME = cn("flex", "min-w-full", "gap-3", "pb-2")

/** The board frame: only from the medium step up. */
export const BOARD_FRAME_CLASS_NAME = cn("hidden", "md:block")

/** One lane column: a fixed 15rem track on narrow screens, an equal share on wide ones. */
export const LANE_CLASS_NAME = cn("flex", "w-60", "shrink-0", "flex-col", "xl:w-auto", "xl:min-w-0", "xl:flex-1")

/** The phone pipeline: stages stacked as a list. */
export const LIST_CLASS_NAME = cn("flex", "flex-col", "gap-4", "md:hidden")

/** What sits under a card's name (GAP-2). */
export const CARD_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-2")

/** The same, grabbable on the board. */
export const CARD_DRAG_CLASS_NAME = cn(CARD_CLASS_NAME, "cursor-grab", "active:cursor-grabbing")

/** A card's commands (GAP-2). */
export const ACTIONS_CLASS_NAME = cn("flex", "shrink-0", "flex-wrap", "items-center", "gap-2")
