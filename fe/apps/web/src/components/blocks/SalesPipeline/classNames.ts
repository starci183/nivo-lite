import { cn } from "@heroui/react"

/** The pipeline board: one lane per stage, the width of the page, the region keeps it as wide as its lanes; the scroll region owns the sideways overflow. */
export const BOARD_CLASS_NAME = cn("flex", "w-full", "items-start", "gap-3", "pb-2")

/** One lane column: an equal share of the board, never narrower than 11rem, so a narrow screen scrolls the band. */
export const LANE_CLASS_NAME = cn("flex", "min-w-44", "flex-1", "flex-col")
