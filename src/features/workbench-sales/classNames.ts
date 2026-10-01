import { cn } from "@heroui/react";

/** Vertical rhythm of the workbench: metrics, tabs, panel. */
export const PAGE_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-4", "py-2", "md:py-4");
/** A tab strip that scrolls sideways on phones instead of widening the page. */
export const TABS_CLASS_NAME = cn("max-w-full", "overflow-x-auto");
/** The panel under the tabs. */
export const PANEL_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-3", "focus-visible:outline-2", "focus-visible:outline-focus");

/** Header metrics: four figures in one band. */
export const METRICS_CLASS_NAME = cn("grid", "grid-cols-2", "gap-2", "lg:grid-cols-4");
/** One metric: label over the figure over its basis. */
export const METRIC_CLASS_NAME = cn("flex", "min-h-24", "min-w-0", "flex-col", "justify-between", "gap-1", "rounded-lg", "border", "border-separator", "bg-surface", "p-3", "md:p-4");
/** Metric that needs the person: accent edge. */
export const METRIC_ALERT_CLASS_NAME = cn("border-warning");

/** A list inside a card. */
export const LIST_CLASS_NAME = cn("m-0", "flex", "list-none", "flex-col", "p-0");
/** One list row: divided, stacks on phones and spreads on wide screens. */
export const ROW_CLASS_NAME = cn("flex", "flex-col", "gap-3", "border-b", "border-separator", "px-4", "py-3", "last:border-b-0", "md:flex-row", "md:items-start", "md:justify-between");
/** Row text column. */
export const ROW_MAIN_CLASS_NAME = cn("flex", "min-w-0", "flex-1", "flex-col", "gap-1");
/** Row action column. */
export const ROW_ACTIONS_CLASS_NAME = cn("flex", "shrink-0", "flex-wrap", "items-center", "gap-2");
/** Chips and facts on one wrapping line. */
export const CHIPS_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-x-2", "gap-y-1");
/** A quoted block (draft, evidence). */
export const QUOTE_CLASS_NAME = cn("flex", "flex-col", "gap-1", "rounded-lg", "bg-surface-secondary", "px-3", "py-2");
/** Stacked form fields inside a row or dialog. */
export const FORM_CLASS_NAME = cn("flex", "flex-col", "gap-3");

/** The board: five stage lanes that scroll sideways inside the page, never the page itself. */
export const BOARD_CLASS_NAME = cn("grid", "auto-cols-[minmax(16rem,1fr)]", "grid-flow-col", "gap-3", "overflow-x-auto", "pb-2", "snap-x", "snap-mandatory", "lg:auto-cols-fr");
/** One lane. */
export const LANE_CLASS_NAME = cn("flex", "min-w-0", "snap-start", "flex-col", "gap-2", "rounded-xl", "bg-surface-secondary", "p-2");
/** Lane header: stage, count, value. */
export const LANE_HEAD_CLASS_NAME = cn("flex", "items-center", "justify-between", "gap-2", "px-1", "pt-1");
/** Lane cards. */
export const LANE_BODY_CLASS_NAME = cn("m-0", "flex", "list-none", "flex-col", "gap-2", "p-0");
/** A deal card. */
export const CARD_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-2", "rounded-lg", "border", "border-separator", "bg-surface", "p-3");
/** Stage choice grid inside the move dialog. */
export const STAGE_CHOICES_CLASS_NAME = cn("flex", "flex-wrap", "gap-2");
