import { cn } from "@heroui/react"

/** Required-field groups: one hairline between groups. */
export const REQUIRED_LIST_CLASS = cn("flex", "flex-col", "divide-y", "divide-separator")

/** Required-field group row; separator-facing sides get `py-3`. */
export const REQUIRED_ROW_CLASS = cn("py-3", "first:pt-0", "last:pb-0")
