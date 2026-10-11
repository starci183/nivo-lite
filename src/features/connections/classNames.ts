import { cn } from "@heroui/react"

export const PAGE_CLASS = cn("flex", "flex-col", "gap-6")
export const STACK_CLASS = cn("flex", "min-w-0", "flex-col", "gap-4")
export const ROW_CLASS = cn("flex", "flex-wrap", "items-center", "gap-x-4", "gap-y-3", "border-t", "border-separator", "py-3", "first:border-t-0")
export const ROW_MAIN_CLASS = cn("flex", "min-w-0", "flex-1", "basis-64", "flex-col", "gap-1")
export const ACTIONS_CLASS = cn("flex", "flex-wrap", "items-center", "gap-2")
export const FORM_GRID_CLASS = cn("grid", "grid-cols-1", "gap-4", "md:grid-cols-2")
export const BOX_CLASS = cn("flex", "min-w-0", "flex-col", "gap-2", "rounded-lg", "bg-surface-secondary", "p-3")
export const FULL_BOX_CLASS = cn(BOX_CLASS, "w-full")
export const CODE_CLASS = cn("break-all", "font-mono", "text-xs")
export const STEPS_CLASS = cn("flex", "list-decimal", "flex-col", "gap-1", "pl-5", "text-sm")
export const HEAD_CLASS = cn("flex", "flex-wrap", "items-center", "justify-between", "gap-3")
