import { cn } from "@heroui/react"

/** Required-field groups stacked; a Divider sits between groups. */
export const REQUIRED_LIST_CLASS = cn("flex", "flex-col")

/** Required-field group row; separator-facing sides get `py-3`. */
export const REQUIRED_ROW_CLASS = cn("py-3", "first:pt-0", "last:pb-0")
