import { cn } from "@heroui/react";

/** Whole workbench: tabs over one panel. */
export const BENCH_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-6");
export const PANEL_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-6");
export const BLOCK_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-3");
export const ROW_CLASS_NAME = cn("flex", "min-w-0", "flex-wrap", "items-center", "gap-3");
export const ROW_END_CLASS_NAME = cn("flex", "min-w-0", "flex-wrap", "items-center", "justify-between", "gap-3");
export const FORM_GRID_CLASS_NAME = cn("grid", "grid-cols-1", "gap-3", "sm:grid-cols-2", "lg:grid-cols-4");
export const FORM_GRID_3_CLASS_NAME = cn("grid", "grid-cols-1", "gap-3", "sm:grid-cols-3");
export const LIST_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "divide-y", "divide-separator");
export const LIST_ITEM_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-2", "py-3", "sm:flex-row", "sm:items-center", "sm:justify-between");
export const TEXTAREA_CLASS_NAME = cn("w-full");

/** Measures row. */
export const MEASURES_CLASS_NAME = cn("grid", "grid-cols-2", "gap-px", "overflow-hidden", "rounded-lg", "border", "border-separator", "bg-separator", "lg:grid-cols-4");
export const MEASURE_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-1", "bg-surface", "p-3");
export const MEASURE_VALUE_CLASS_NAME = cn("text-xl", "font-semibold", "tracking-tight", "text-foreground", "tabular-nums");

/** Week grid (people x days): scrolls sideways inside its own frame on narrow screens, replaced by the day list below md. */
export const GRID_FRAME_CLASS_NAME = cn("hidden", "overflow-x-auto", "rounded-lg", "border", "border-separator", "md:block");
export const GRID_CLASS_NAME = cn("grid", "min-w-[900px]", "grid-cols-[150px_repeat(7,minmax(104px,1fr))]");
export const GRID_HEAD_CLASS_NAME = cn("border-b", "border-separator", "bg-surface-secondary", "p-2", "text-xs", "font-medium", "text-muted");
export const GRID_NAME_CLASS_NAME = cn("flex", "flex-col", "justify-center", "gap-0.5", "border-b", "border-separator", "bg-surface", "p-2");
export const GRID_CELL_CLASS_NAME = cn("flex", "min-h-14", "flex-col", "gap-1", "border-b", "border-l", "border-separator", "p-1");
export const GRID_CELL_TARGET_CLASS_NAME = cn("bg-accent/10");
export const GRID_CELL_OFF_CLASS_NAME = cn("bg-surface-secondary");

/** One shift chip: position colour on the left edge, rule breaks in red. */
export const CHIP_CLASS_NAME = cn("flex", "w-full", "min-w-0", "flex-col", "gap-0.5", "rounded-md", "border", "border-separator", "bg-surface", "px-2", "py-1", "text-left", "text-xs", "text-foreground", "transition-colors");
export const CHIP_PICKED_CLASS_NAME = cn("ring-2", "ring-accent");
export const CHIP_BROKEN_CLASS_NAME = cn("border-danger", "bg-danger/10");
export const CHIP_OPEN_CLASS_NAME = cn("border-dashed");

/** Coverage strip: one column per day. */
export const COVERAGE_CLASS_NAME = cn("grid", "grid-cols-1", "gap-2", "sm:grid-cols-4", "lg:grid-cols-7");
export const COVERAGE_DAY_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-1", "rounded-lg", "border", "border-separator", "bg-surface", "p-2");
export const COVER_ROW_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-0.5");
export const COVER_BAR_CLASS_NAME = cn("h-1.5", "w-full", "overflow-hidden", "rounded-full", "bg-surface-secondary");

/** Day list for phones. */
export const DAYLIST_CLASS_NAME = cn("flex", "flex-col", "gap-2", "md:hidden");
export const DAYTABS_CLASS_NAME = cn("flex", "gap-1", "overflow-x-auto", "pb-1");
export const DAY_PILL_CLASS_NAME = cn("flex", "min-w-12", "flex-col", "items-center", "rounded-lg", "border", "border-separator", "px-2", "py-1", "text-xs");
export const DAY_PILL_ON_CLASS_NAME = cn("border-accent", "bg-accent/10", "font-semibold");

export const NOTE_CLASS_NAME = cn("whitespace-pre-line", "text-sm", "text-foreground");
export const SWATCH_CLASS_NAME = cn("inline-block", "size-2.5", "shrink-0", "rounded-full");
