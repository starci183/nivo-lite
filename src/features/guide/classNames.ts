import { cn } from "@heroui/react"

export const VIEWPORT_CLASS = cn("pointer-events-none", "fixed", "inset-0", "z-0")
export const BUBBLE_CLASS = cn(
  "fixed", "left-0", "top-0", "z-50", "flex", "size-14", "touch-none", "select-none", "items-center", "justify-center", "rounded-full",
  "bg-accent", "text-accent-foreground", "shadow-lg", "outline-none", "focus-visible:ring-2", "focus-visible:ring-focus", "focus-visible:ring-offset-2",
  "cursor-grab", "active:cursor-grabbing",
)
export const BUBBLE_ICON_CLASS = cn("pointer-events-none", "flex", "size-6", "items-center", "justify-center")
export const PANEL_CLASS = cn(
  "fixed", "z-50", "flex", "flex-col", "overflow-hidden", "rounded-2xl", "border", "border-separator", "bg-surface", "shadow-xl",
)
export const PANEL_HEAD_CLASS = cn("flex", "items-start", "justify-between", "gap-3", "border-b", "border-separator", "px-4", "py-3")
export const PANEL_HEAD_TEXT_CLASS = cn("flex", "min-w-0", "flex-col", "gap-1")
export const MESSAGES_CLASS = cn("flex", "min-h-0", "flex-1", "flex-col", "gap-3", "overflow-y-auto", "px-4", "py-3")
export const USER_MSG_CLASS = cn("max-w-[85%]", "self-end", "rounded-2xl", "rounded-br-md", "bg-accent-soft", "px-3", "py-2")
export const GUIDE_MSG_CLASS = cn("flex", "max-w-[92%]", "flex-col", "gap-2", "self-start", "rounded-2xl", "rounded-bl-md", "bg-surface-secondary", "px-3", "py-2")
export const STEPS_CLASS = cn("flex", "list-decimal", "flex-col", "gap-1", "pl-5", "text-sm")
export const LINKS_CLASS = cn("flex", "flex-wrap", "gap-2")
export const SUGGEST_CLASS = cn("flex", "flex-wrap", "gap-2", "px-4", "pb-3")
export const FOOT_CLASS = cn("border-t", "border-separator", "px-4", "py-3")
export const ASK_ROW_CLASS = cn("flex", "items-end", "gap-2")
export const ASK_INPUT_CLASS = cn("min-w-0", "flex-1")
