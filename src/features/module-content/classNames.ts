import { cn } from "@heroui/react";

export const PAGE_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-4", "py-2", "md:py-4");
export const TABS_CLASS_NAME = cn("max-w-full", "overflow-x-auto");
export const PANEL_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-3", "focus-visible:outline-2", "focus-visible:outline-focus");
export const TOOLBAR_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-2");
export const METRICS_CLASS_NAME = cn("grid", "grid-cols-2", "gap-2", "lg:grid-cols-4");
export const METRIC_CLASS_NAME = cn("flex", "min-h-24", "min-w-0", "flex-col", "justify-between", "gap-1", "rounded-lg", "border", "border-separator", "bg-surface", "p-3", "md:p-4");
export const METRIC_ALERT_CLASS_NAME = cn("border-warning");

export const LIST_CLASS_NAME = cn("m-0", "flex", "list-none", "flex-col", "p-0");
export const ROW_CLASS_NAME = cn("flex", "flex-col", "gap-2", "border-b", "border-separator", "px-4", "py-3", "last:border-b-0", "md:flex-row", "md:items-start", "md:justify-between");
export const ROW_MAIN_CLASS_NAME = cn("flex", "min-w-0", "flex-1", "flex-col", "gap-1");
export const ROW_ACTIONS_CLASS_NAME = cn("flex", "shrink-0", "flex-wrap", "items-center", "gap-2");
export const CHIPS_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-x-2", "gap-y-1");
export const QUOTE_CLASS_NAME = cn("flex", "flex-col", "gap-1", "rounded-lg", "bg-surface-secondary", "px-3", "py-2", "whitespace-pre-wrap", "break-words");
export const FORM_CLASS_NAME = cn("flex", "flex-col", "gap-3");
export const FORM_ROW_CLASS_NAME = cn("grid", "grid-cols-1", "gap-3", "sm:grid-cols-2");
export const ROW_BUTTON_CLASS_NAME = cn("w-full", "cursor-pointer", "text-left", "focus-visible:outline-2", "focus-visible:outline-focus");

/** Month grid: seven columns on wide screens; on phones the agenda list replaces it. */
export const GRID_WRAP_CLASS_NAME = cn("hidden", "md:block");
export const AGENDA_WRAP_CLASS_NAME = cn("md:hidden");
export const GRID_CLASS_NAME = cn("grid", "grid-cols-7", "overflow-hidden", "rounded-lg", "border", "border-separator", "bg-surface");
export const GRID_HEAD_CLASS_NAME = cn("border-b", "border-separator", "bg-surface-secondary", "px-2", "py-1", "text-center");
export const CELL_CLASS_NAME = cn("flex", "min-h-28", "min-w-0", "flex-col", "gap-1", "border-b", "border-r", "border-separator", "p-1", "[&:nth-child(7n)]:border-r-0");
export const CELL_OUT_CLASS_NAME = cn("bg-surface-secondary", "opacity-60");
export const CELL_TODAY_CLASS_NAME = cn("bg-accent/5");
export const CELL_DROP_CLASS_NAME = cn("outline-2", "outline-accent", "-outline-offset-2");
export const CHIP_CLASS_NAME = cn("flex", "min-w-0", "cursor-grab", "flex-col", "rounded-md", "border-l-4", "bg-surface-secondary", "px-1.5", "py-1", "text-left", "hover:bg-default", "focus-visible:outline-2", "focus-visible:outline-focus", "active:cursor-grabbing");
export const PILLAR_BORDERS: ReadonlyArray<string> = ["border-l-accent", "border-l-success", "border-l-warning", "border-l-danger", "border-l-default-foreground", "border-l-separator"];

export const BAR_TRACK_CLASS_NAME = cn("relative", "h-3", "w-full", "overflow-hidden", "rounded-full", "bg-surface-secondary");
export const BAR_FILL_CLASS_NAME = cn("absolute", "inset-y-0", "left-0", "rounded-full", "bg-accent");
export const BAR_TARGET_CLASS_NAME = cn("absolute", "inset-y-0", "w-0.5", "bg-foreground");

export const MEDIA_GRID_CLASS_NAME = cn("grid", "grid-cols-2", "gap-2", "sm:grid-cols-3");
export const MEDIA_TILE_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-1", "rounded-lg", "border", "border-separator", "p-1.5");
export const THUMB_CLASS_NAME = cn("aspect-video", "w-full", "rounded-md", "bg-surface-secondary", "object-cover");
export const HISTORY_CLASS_NAME = cn("m-0", "flex", "list-none", "flex-col", "gap-1", "p-0");
export const SELECT_NATIVE_CLASS_NAME = cn("w-full", "rounded-lg", "border", "border-separator", "bg-surface", "px-3", "py-2", "text-sm");
