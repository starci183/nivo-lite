import { cn } from "@heroui/react";

/** Vertical rhythm of the Hiring workbench: figures, tabs, panel. */
export const PAGE_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-4", "py-2", "md:py-4");
export const TABS_CLASS_NAME = cn("max-w-full", "overflow-x-auto");
export const PANEL_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-4", "focus-visible:outline-2", "focus-visible:outline-focus");

export const METRICS_CLASS_NAME = cn("grid", "grid-cols-2", "gap-2", "lg:grid-cols-4");
export const METRIC_CLASS_NAME = cn("flex", "min-h-24", "min-w-0", "flex-col", "justify-between", "gap-1", "rounded-lg", "border", "border-separator", "bg-surface", "p-3", "md:p-4");
export const METRIC_ALERT_CLASS_NAME = cn("border-warning");

export const SECTION_HEAD_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "justify-between", "gap-2");
export const ROW_CLASS_NAME = cn("flex", "flex-col", "gap-3", "border-b", "border-separator", "px-4", "py-3", "last:border-b-0", "md:flex-row", "md:items-start", "md:justify-between");
export const ROW_MAIN_CLASS_NAME = cn("flex", "min-w-0", "flex-1", "flex-col", "gap-1");
export const ROW_ACTIONS_CLASS_NAME = cn("flex", "shrink-0", "flex-wrap", "items-center", "gap-2");
export const LIST_CLASS_NAME = cn("m-0", "flex", "list-none", "flex-col", "p-0");
export const CHIPS_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-x-2", "gap-y-1");
export const FORM_CLASS_NAME = cn("flex", "flex-col", "gap-3");
export const FORM_GRID_CLASS_NAME = cn("grid", "grid-cols-1", "gap-3", "md:grid-cols-2");
export const QUOTE_CLASS_NAME = cn("m-0", "whitespace-pre-wrap", "break-words", "rounded-lg", "bg-surface-secondary", "px-3", "py-2", "text-sm", "leading-relaxed");
export const QUESTION_CLASS_NAME = cn("flex", "flex-col", "gap-2", "rounded-lg", "border", "border-separator", "p-3");

/** The pipeline board: one lane per stage, scrolls sideways inside the page. Hidden on phones, where the pipeline is a list. */
export const BOARD_CLASS_NAME = cn("hidden", "auto-cols-[minmax(15rem,1fr)]", "grid-flow-col", "gap-3", "overflow-x-auto", "pb-2", "md:grid", "xl:auto-cols-fr");
export const LANE_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-2", "rounded-xl", "bg-surface-secondary", "p-2");
export const LANE_OVER_CLASS_NAME = cn("outline-2", "outline-accent");
export const LANE_HEAD_CLASS_NAME = cn("flex", "items-center", "justify-between", "gap-2", "px-1", "pt-1");
export const LANE_BODY_CLASS_NAME = cn("m-0", "flex", "min-h-16", "list-none", "flex-col", "gap-2", "p-0");
export const CARD_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-2", "rounded-lg", "border", "border-separator", "bg-surface", "p-3");
export const CARD_DRAG_CLASS_NAME = cn("cursor-grab", "active:cursor-grabbing");
/** The phone pipeline: stages stacked as a list. */
export const PIPELINE_LIST_CLASS_NAME = cn("flex", "flex-col", "gap-4", "md:hidden");

/** The week calendar: seven day columns on wide screens, a plain agenda on phones. */
export const WEEK_CLASS_NAME = cn("grid", "grid-cols-1", "gap-2", "md:grid-cols-7");
export const DAY_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-2", "rounded-lg", "border", "border-separator", "bg-surface", "p-2");
export const SLOT_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-1", "rounded-md", "bg-surface-secondary", "p-2");

export const SCORE_CLASS_NAME = cn("flex", "items-baseline", "gap-2");
export const REASON_CLASS_NAME = cn("flex", "items-start", "gap-2");
export const CV_FRAME_CLASS_NAME = cn("h-96", "w-full", "rounded-lg", "border", "border-separator");
export const AD_GRID_CLASS_NAME = cn("grid", "grid-cols-1", "gap-3");
