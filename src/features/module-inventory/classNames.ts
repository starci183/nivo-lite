import { cn } from "@heroui/react";

/** Vertical rhythm of the workbench: metrics, tabs, panel. */
export const PAGE_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-4", "py-2", "md:py-4");
export const TABS_CLASS_NAME = cn("max-w-full", "overflow-x-auto");
export const PANEL_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-3");
export const METRICS_CLASS_NAME = cn("grid", "grid-cols-2", "gap-2", "lg:grid-cols-4");
export const METRIC_CLASS_NAME = cn("flex", "min-h-24", "min-w-0", "flex-col", "justify-between", "gap-1", "rounded-lg", "border", "border-separator", "bg-surface", "p-3", "md:p-4");
export const METRIC_ALERT_CLASS_NAME = cn("border-warning");

export const LIST_CLASS_NAME = cn("m-0", "flex", "list-none", "flex-col", "p-0");
export const ROW_CLASS_NAME = cn("flex", "flex-col", "gap-3", "border-b", "border-separator", "px-4", "py-3", "last:border-b-0", "md:flex-row", "md:items-center", "md:justify-between");
export const ROW_MAIN_CLASS_NAME = cn("flex", "min-w-0", "flex-1", "flex-col", "gap-1");
export const ROW_ACTIONS_CLASS_NAME = cn("flex", "shrink-0", "flex-wrap", "items-center", "gap-2");
export const CHIPS_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-x-2", "gap-y-1");
export const TOOLBAR_CLASS_NAME = cn("flex", "flex-col", "gap-2", "md:flex-row", "md:items-end", "md:justify-between");
export const TOOLBAR_FIELD_CLASS_NAME = cn("min-w-0", "md:w-80");
export const FORM_CLASS_NAME = cn("flex", "flex-col", "gap-3", "pb-4");
export const FORM_GRID_CLASS_NAME = cn("grid", "grid-cols-1", "gap-3", "sm:grid-cols-2");
export const QUOTE_CLASS_NAME = cn("flex", "flex-col", "gap-1", "rounded-lg", "bg-surface-secondary", "px-3", "py-2", "whitespace-pre-wrap");
export const LINE_ROW_CLASS_NAME = cn("grid", "grid-cols-[minmax(0,1fr)_6rem_6rem]", "items-end", "gap-2");

export const BOARD_CLASS_NAME = cn("grid", "auto-cols-[minmax(17rem,1fr)]", "grid-flow-col", "gap-3", "overflow-x-auto", "pb-2", "snap-x", "snap-mandatory", "lg:auto-cols-fr");
export const LANE_CLASS_NAME = cn("flex", "min-w-0", "snap-start", "flex-col", "gap-2", "rounded-xl", "bg-surface-secondary", "p-2");
export const LANE_HEAD_CLASS_NAME = cn("flex", "items-center", "justify-between", "gap-2", "px-1", "pt-1");
export const LANE_BODY_CLASS_NAME = cn("m-0", "flex", "list-none", "flex-col", "gap-2", "p-0");
export const CARD_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-2", "rounded-lg", "border", "border-separator", "bg-surface", "p-3");

/** The stock-take row: name over unit, count field to the right (thumb reach on a phone). */
export const COUNT_ROW_CLASS_NAME = cn("flex", "items-center", "justify-between", "gap-3", "border-b", "border-separator", "px-4", "py-3", "last:border-b-0");
export const COUNT_FIELD_CLASS_NAME = cn("w-28", "shrink-0");
export const TEXT_BLOCK_CLASS_NAME = cn("min-w-0", "break-words");
