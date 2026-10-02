import { cn } from "@heroui/react"

export const PAGE_CLASS = cn("flex", "flex-col", "gap-6")
export const HEAD_CLASS = cn("flex", "flex-wrap", "items-center", "gap-3")
export const CHIP_CLASS = cn("rounded-full", "bg-surface-tertiary", "px-3", "py-1", "text-xs", "font-medium", "text-muted")
export const LINK_CLASS = cn("text-accent", "underline", "underline-offset-2")
export const MUTED_LINK_CLASS = cn("text-sm", "text-muted", "underline", "underline-offset-2")
export const FILTERS_CLASS = cn("flex", "flex-wrap", "gap-2")
export const FILTER_BASE_CLASS = cn("min-h-9", "rounded-full", "border", "px-3", "text-sm", "font-medium", "transition-colors")
export const FILTER_ON_CLASS = cn(FILTER_BASE_CLASS, "border-accent", "bg-accent-soft", "text-accent")
export const FILTER_OFF_CLASS = cn(FILTER_BASE_CLASS, "border-separator", "bg-surface", "text-foreground")

export const LAYOUT_CLASS = cn("grid", "grid-cols-1", "items-start", "gap-4", "lg:grid-cols-[minmax(0,1fr)_26rem]")
export const GRID_CLASS = cn("grid", "grid-cols-1", "gap-3", "sm:grid-cols-2", "lg:grid-cols-1", "2xl:grid-cols-2")
export const GRID_WIDE_CLASS = cn("grid", "grid-cols-1", "gap-3", "sm:grid-cols-2", "xl:grid-cols-3")
export const SOLO_CLASS = cn("flex", "min-w-0", "flex-col", "gap-4")
export const LIST_CLASS = cn("flex", "flex-col", "gap-2")

export const CARD_CLASS = cn("flex", "min-w-0", "flex-col", "gap-3", "rounded-lg", "border", "border-separator", "bg-surface", "p-4")
export const CARD_SELECTED_CLASS = cn(CARD_CLASS, "border-accent", "ring-1", "ring-accent")
export const CARD_BUTTON_CLASS = cn("flex", "min-w-0", "flex-col", "gap-2", "rounded-md", "text-left", "outline-none", "focus-visible:ring-2", "focus-visible:ring-accent")
export const CARD_TOP_CLASS = cn("flex", "min-w-0", "items-start", "gap-3")
export const CARD_TEXT_CLASS = cn("flex", "min-w-0", "flex-1", "flex-col", "gap-1")
export const CARD_FOOT_CLASS = cn("flex", "flex-wrap", "items-center", "justify-between", "gap-2")
export const TRIGGER_CLASS = cn("flex", "items-center", "gap-1.5", "text-xs", "text-muted")
export const BOLT_CLASS = cn("size-3.5", "shrink-0")

const TILE_BASE = cn("flex", "size-10", "shrink-0", "items-center", "justify-center", "rounded-lg")
/** One accent per module, from the design tokens: chatbot = brand accent, sales = info, accounting = success, workspace = foreground. */
export const TILE_CLASS = {
  chatbot: cn(TILE_BASE, "bg-accent/10", "text-accent"),
  sales: cn(TILE_BASE, "bg-info/10", "text-info"),
  accounting: cn(TILE_BASE, "bg-success/10", "text-success"),
  workspace: cn(TILE_BASE, "bg-foreground/10", "text-foreground"),
} as const
/** A module without an accent of its own uses the workspace tile. */
export const tileClass = (scope: string) => (TILE_CLASS as Record<string, (typeof TILE_CLASS)["workspace"] | undefined>)[scope] ?? TILE_CLASS.workspace

export const DETAIL_CLASS = cn("flex", "min-w-0", "flex-col", "gap-5", "rounded-lg", "border", "border-separator", "bg-surface", "p-4", "lg:sticky", "lg:top-4")
export const SECTION_CLASS = cn("flex", "min-w-0", "flex-col", "gap-3", "border-t", "border-separator", "pt-4")
export const FIELDS_CLASS = cn("flex", "flex-col", "gap-3")
export const ACTIONS_CLASS = cn("flex", "flex-wrap", "items-center", "gap-2")
export const CHIPS_CLASS = cn("flex", "flex-wrap", "gap-1.5")
export const VAR_CHIP_CLASS = cn("rounded-md", "bg-surface-secondary", "px-2", "py-0.5", "font-mono", "text-xs", "text-muted")
export const BUBBLE_CLASS = cn("max-w-full", "whitespace-pre-line", "rounded-2xl", "rounded-tl-sm", "bg-surface-tertiary", "px-4", "py-3", "text-sm", "text-foreground")
export const LIST_PLAIN_CLASS = cn("flex", "list-disc", "flex-col", "gap-1", "pl-5", "text-sm")
export const FACTS_CLASS = cn("flex", "flex-col", "gap-1")

export const RUN_ROW_CLASS = cn("flex", "flex-col", "gap-1", "border-t", "border-separator", "py-2", "first:border-t-0")
export const RUN_HEAD_CLASS = cn("flex", "flex-wrap", "items-center", "gap-2")
export const DISCLOSURE_CLASS = cn("text-sm", "text-muted", "[&>summary]:cursor-pointer", "[&>summary]:py-1")
export const DISCLOSURE_BODY_CLASS = cn("mt-1", "flex", "flex-col", "gap-2", "rounded-md", "bg-surface-secondary", "p-3", "text-sm", "text-foreground")
export const HIDDEN_ROW_CLASS = cn("flex", "flex-wrap", "items-center", "justify-between", "gap-2", "border-t", "border-separator", "py-2", "first:border-t-0")

export const MODULE_HEAD_CLASS = cn("flex", "flex-wrap", "items-start", "justify-between", "gap-2")
