import { cn } from "@heroui/react";

/** The whole workbench: sub-tabs over one panel. */
export const WORKBENCH_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-6");

/** A panel's stacked blocks. */
export const PANEL_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-8");

/** One block: heading line, then content. */
export const BLOCK_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-3");

/** Heading line with an action on the right. */
export const BLOCK_HEAD_CLASS_NAME = cn("flex", "flex-wrap", "items-end", "justify-between", "gap-3");

/** Measure grid: two across on phones, four from lg. */
export const MEASURE_GRID_CLASS_NAME = cn("grid", "grid-cols-1", "gap-px", "overflow-hidden", "rounded-lg", "border", "border-separator", "bg-separator", "sm:grid-cols-2", "lg:grid-cols-4");

/** One measure cell: label, live value, simulated line, source. */
export const MEASURE_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-1", "bg-surface", "p-4");

/** The big number of a measure. */
export const MEASURE_VALUE_CLASS_NAME = cn("text-2xl", "font-semibold", "tracking-tight", "text-foreground", "tabular-nums");

/** Weekly bars. */
export const BARS_CLASS_NAME = cn("flex", "h-36", "items-end", "gap-3", "border-b", "border-separator", "px-1");

/** One week column. */
export const BAR_COLUMN_CLASS_NAME = cn("flex", "h-full", "min-w-0", "flex-1", "flex-col", "justify-end");

/** Stacked bar body (live over simulated). */
export const BAR_STACK_CLASS_NAME = cn("flex", "w-full", "flex-col", "justify-end", "overflow-hidden", "rounded-t");

/** Live part of a bar: accent. */
export const BAR_LIVE_CLASS_NAME = cn("w-full", "bg-accent");

/** Simulated part of a bar: muted, hatched by lightness only. */
export const BAR_SIM_CLASS_NAME = cn("w-full", "bg-muted", "opacity-40");

/** Week labels under the bars. */
export const BAR_LABELS_CLASS_NAME = cn("flex", "gap-3", "px-1", "pt-2");

/** Legend line. */
export const LEGEND_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-x-4", "gap-y-1");

/** Legend swatch. */
export const SWATCH_CLASS_NAME = cn("inline-block", "size-2.5", "rounded-sm");

/** A divided list with a border around it. */
export const LIST_CLASS_NAME = cn("m-0", "flex", "list-none", "flex-col", "divide-y", "divide-separator", "overflow-hidden", "rounded-lg", "border", "border-separator", "bg-surface", "p-0");

/** One list row: main text, aside amount. */
export const ROW_CLASS_NAME = cn("flex", "flex-wrap", "items-start", "justify-between", "gap-x-4", "gap-y-1", "px-4", "py-3");

/** Row text column. */
export const ROW_MAIN_CLASS_NAME = cn("flex", "min-w-0", "flex-1", "basis-56", "flex-col", "gap-1");

/** Row aside: amount over status. */
export const ROW_ASIDE_CLASS_NAME = cn("flex", "shrink-0", "flex-col", "items-end", "gap-1");

/** Chips on one line. */
export const CHIPS_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-2");

/** Ledger row as a full-width button. */
export const LEDGER_ROW_CLASS_NAME = cn(
  "flex", "w-full", "flex-wrap", "items-start", "justify-between", "gap-x-4", "gap-y-1", "bg-transparent", "px-4", "py-3", "text-left",
  "hover:bg-surface-secondary", "focus-visible:outline-2", "focus-visible:-outline-offset-2", "focus-visible:outline-focus", "cursor-pointer",
);

/** Form grid for the manual evidence form. */
export const FORM_GRID_CLASS_NAME = cn("grid", "grid-cols-1", "gap-4", "sm:grid-cols-2");

/** A form field that spans both columns. */
export const FORM_WIDE_CLASS_NAME = cn("sm:col-span-2");

/** Native date input dressed like the field inputs. */
export const DATE_INPUT_CLASS_NAME = cn("h-10", "w-full", "rounded-lg", "border", "border-separator", "bg-surface", "px-3", "text-sm", "text-foreground", "focus-visible:outline-2", "focus-visible:outline-focus");

/** Form frame. */
export const FORM_CLASS_NAME = cn("flex", "flex-col", "gap-4", "rounded-lg", "border", "border-separator", "bg-surface", "p-4");

/** Actions line of a form. */
export const FORM_ACTIONS_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-3");

/** Question cards sit in a column; the card brings its own thread layout. */
export const QUESTIONS_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-4");

/** Lineage: a vertical line of steps. */
export const LINEAGE_CLASS_NAME = cn("m-0", "flex", "list-none", "flex-col", "gap-0", "p-0");

/** One lineage step with its connecting rule. */
export const STEP_CLASS_NAME = cn("relative", "flex", "flex-col", "gap-1", "border-l", "border-separator", "pb-4", "pl-4", "last:pb-0");

/** Drawer body. */
export const DRAWER_BODY_CLASS_NAME = cn("flex", "flex-col", "gap-6", "p-4");

/** Filter strip over a list. */
export const FILTER_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "justify-between", "gap-3");
