import { cn } from "@heroui/react"

/** The search and the three filter buttons stand in one row. */
export const TOOLBAR_CLASS_NAME: string | undefined = cn("flex", "items-center", "gap-2")

/** The search takes the width the filter buttons leave: a track share structure cannot express. */
export const SEARCH_CLASS_NAME: string | undefined = cn("min-w-0", "flex-1")
