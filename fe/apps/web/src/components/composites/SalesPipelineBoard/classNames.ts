import { cn } from "@heroui/react"

/** One lane column: an equal share of the board, never narrower than 11rem, so a narrow screen scrolls the band. */
export const LANE_CLASS_NAME: string | undefined = cn("flex", "min-w-44", "flex-1", "flex-col")
