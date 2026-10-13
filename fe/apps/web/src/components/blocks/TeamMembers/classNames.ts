import { cn } from "@heroui/react"

/** Avatar + name + email column (GAP-3). */
export const IDENTITY_CLASS_NAME = cn("flex", "min-w-0", "flex-1", "basis-64", "items-center", "gap-3")

/** Name / email lines of one identity (GAP-1). */
export const IDENTITY_TEXT_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-1")

/** Name line (name + "You" badge, GAP-2). */
export const NAME_LINE_CLASS_NAME = cn("flex", "min-w-0", "items-center", "gap-2")
