import { cn } from "@heroui/react"

/** The hue track and the swatch that opens the picker stand on one row. */
export const COLOR_ROW_CLASS_NAME: string | undefined = cn("flex", "items-center", "gap-3")

/** The hue track takes the row's width. */
export const COLOR_TRACK_CLASS_NAME: string | undefined = cn("flex-1")

/** The picker's popover content: the area, the hue track and the hex field in one column. */
export const COLOR_POPOVER_BODY_CLASS_NAME: string | undefined = cn("flex", "w-64", "flex-col", "gap-3")
