import { cn } from "@heroui/react"

/** The semantic week table gives way to the day list below md. */
export const FRAME_CLASS_NAME = cn("hidden", "min-w-0", "md:block")

/** The name and workload inside the table's row header. */
export const NAME_CLASS_NAME = cn("flex", "flex-col", "justify-center")

/** Day list for phones. */
export const DAYLIST_CLASS_NAME = cn("min-w-0", "md:hidden")

/** Day cells keep their height when empty; chips stack inside through `Stack gap="identity"`. */
export const CELL_CLASS_NAME = cn("min-h-14", "min-w-0")
