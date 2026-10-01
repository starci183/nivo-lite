import { cn } from "@heroui/react";

/** Vertical stack of the panel sections. */
export const STACK_CLASS_NAME = cn("flex", "flex-col", "gap-6");
/** Group of a label and its content. */
export const GROUP_CLASS_NAME = cn("flex", "flex-col", "gap-3");
/** Bullet list reset. */
export const LIST_CLASS_NAME = cn("m-0", "flex", "list-none", "flex-col", "gap-3", "p-0");
/** One bullet row. */
export const ITEM_CLASS_NAME = cn("flex", "items-start", "gap-3");
/** Actions row in the header. */
export const HEADER_ACTIONS_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-2");
/** Header row: prepared-by line and actions. */
export const HEADER_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "justify-between", "gap-3");
/** Two facts columns that collapse to one on narrow screens. */
export const FACTS_GRID_CLASS_NAME = cn("grid", "grid-cols-1", "gap-x-6", "md:grid-cols-2");
/** Quoted customer words. */
export const QUOTE_CLASS_NAME = cn("m-0", "rounded-xl", "border-l-4", "border-accent", "bg-surface-secondary", "px-4", "py-3");
/** Signals chips. */
export const CHIPS_CLASS_NAME = cn("flex", "flex-wrap", "gap-2");
