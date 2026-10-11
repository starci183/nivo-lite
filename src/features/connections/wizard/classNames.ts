import { cn } from "@heroui/react"

export const WIZARD_CLASS = cn("flex", "min-w-0", "flex-col", "gap-6")
export const BODY_CLASS = cn("flex", "min-w-0", "flex-col", "gap-4")
export const FIELDS_CLASS = cn("grid", "grid-cols-1", "gap-4", "md:grid-cols-2")
export const FOOTER_CLASS = cn("flex", "flex-col", "gap-2", "sm:flex-row", "sm:flex-wrap", "sm:items-center")
export const SCREEN_CLASS = cn("flex", "min-w-0", "flex-col", "gap-3", "rounded-lg", "bg-surface-secondary", "p-4")
export const ITEMS_CLASS = cn("flex", "min-w-0", "flex-col", "gap-3")
export const BUTTONS_CLASS = cn("flex", "flex-wrap", "items-center", "gap-2")
export const OPTION_CLASS = cn("w-fit", "max-w-full", "rounded-md", "bg-surface", "px-3", "py-1", "text-sm", "font-semibold")
export const WAITING_CLASS = cn("flex", "items-center", "gap-3")
export const PULSE_CLASS = cn("size-2", "shrink-0", "animate-pulse", "rounded-full", "bg-accent")
export const NUMBERED_CLASS = cn("flex", "list-decimal", "flex-col", "gap-1", "pl-5", "text-sm")
