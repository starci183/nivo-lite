import { cn } from "@heroui/react"

/** The heading over the grid and the day list (GAP-3). */
export const SECTION_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-3")

/** The semantic week table gives way to the day list below md. */
export const FRAME_CLASS_NAME = cn("hidden", "min-w-0", "md:block")

/** The name and workload inside the table's row header. */
export const NAME_CLASS_NAME = cn("flex", "flex-col", "justify-center", "gap-1")

/** Day list for phones. */
export const DAYLIST_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-3", "md:hidden")

/** A row of the day list: the shift, who has it and what it breaks (GAP-2). */
export const DAY_ROW_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-2")

/** Stack shift chips within their semantic day cell; Grammar owns the cell and chip paint. */
export const CELL_CLASS_NAME = cn("flex", "min-h-14", "flex-col", "gap-1")
