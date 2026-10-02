import { cn } from "@heroui/react";

/** Vertical rhythm of the workbench: figures, tabs, panel. */
export const PAGE_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-4", "py-2", "md:py-4");
/** A tab strip that scrolls sideways on phones instead of widening the page. */
export const TABS_CLASS_NAME = cn("max-w-full", "overflow-x-auto");
/** The panel under the tabs. */
export const PANEL_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-3", "focus-visible:outline-2", "focus-visible:outline-focus");

/** Header figures: four in one band. */
export const METRICS_CLASS_NAME = cn("grid", "grid-cols-2", "gap-2", "lg:grid-cols-4");
/** One figure: label over the number over its basis. */
export const METRIC_CLASS_NAME = cn("flex", "min-h-24", "min-w-0", "flex-col", "justify-between", "gap-1", "rounded-lg", "border", "border-separator", "bg-surface", "p-3", "md:p-4");

/** A list inside a card. */
export const LIST_CLASS_NAME = cn("m-0", "flex", "list-none", "flex-col", "p-0");
/** One list row: stacks on phones, spreads on wide screens. */
export const ROW_CLASS_NAME = cn("flex", "flex-col", "gap-3", "border-b", "border-separator", "px-4", "py-3", "last:border-b-0", "md:flex-row", "md:items-start", "md:justify-between");
/** Row text column. */
export const ROW_MAIN_CLASS_NAME = cn("flex", "min-w-0", "flex-1", "flex-col", "gap-1");
/** Row action column. */
export const ROW_ACTIONS_CLASS_NAME = cn("flex", "shrink-0", "flex-wrap", "items-center", "gap-2");
/** Chips and facts on one wrapping line. */
export const CHIPS_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-x-2", "gap-y-1");
/** A quoted block (draft, evidence). */
export const QUOTE_CLASS_NAME = cn("flex", "flex-col", "gap-1", "rounded-lg", "bg-surface-secondary", "px-3", "py-2", "break-words");
/** Stacked form fields. */
export const FORM_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-3");
/** Padding of content inside a card. */
export const BODY_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-3", "p-4");
/** Two fields side by side from tablet width. */
export const FIELD_PAIR_CLASS_NAME = cn("grid", "grid-cols-1", "gap-3", "sm:grid-cols-2");
/** Three fields side by side from tablet width. */
export const FIELD_TRIPLE_CLASS_NAME = cn("grid", "grid-cols-1", "gap-3", "sm:grid-cols-3");

/** Overview: two columns from desktop width. */
export const OVERVIEW_GRID_CLASS_NAME = cn("grid", "grid-cols-1", "gap-3", "lg:grid-cols-2");
/** One label and value line (programme stats). */
export const STAT_LINE_CLASS_NAME = cn("flex", "items-baseline", "justify-between", "gap-3", "border-b", "border-separator", "py-2", "last:border-b-0");
/** The public link and its copy button. */
export const LINK_ROW_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-2", "sm:flex-row", "sm:items-center");
/** The selectable address. */
export const LINK_VALUE_CLASS_NAME = cn("min-w-0", "flex-1", "break-all", "rounded-lg", "bg-surface-secondary", "px-3", "py-2", "text-sm", "text-foreground");

/** Members: the list and, from desktop width, the detail panel beside it. */
export const SPLIT_CLASS_NAME = cn("grid", "min-w-0", "grid-cols-1", "gap-3", "lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]", "lg:items-start");
/** Filters above the member list. */
export const FILTERS_CLASS_NAME = cn("grid", "grid-cols-1", "gap-3", "p-4", "sm:grid-cols-3");
/** A member row is one button-like row. */
export const MEMBER_BUTTON_CLASS_NAME = cn("flex", "w-full", "min-w-0", "flex-col", "gap-1", "border-b", "border-separator", "px-4", "py-3", "text-left", "last:border-b-0", "hover:bg-surface-secondary", "focus-visible:outline-2", "focus-visible:outline-focus", "focus-visible:-outline-offset-2");
/** The selected member row. */
export const MEMBER_ACTIVE_CLASS_NAME = cn("bg-accent-soft");
/** Facts of a member row (points, last visit, spend). */
export const FACTS_CLASS_NAME = cn("flex", "flex-wrap", "gap-x-4", "gap-y-1");
/** Ledger timeline entry. */
export const LEDGER_ITEM_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-1", "border-l-2", "border-separator", "py-1", "pl-3");
/** A reward line inside the member detail. */
export const REWARD_LINE_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-2", "border-b", "border-separator", "py-2", "last:border-b-0", "sm:flex-row", "sm:items-center", "sm:justify-between");
/** Result block after an action. */
export const RESULT_CLASS_NAME = cn("flex", "flex-col", "gap-1", "rounded-lg", "border", "border-separator", "px-3", "py-2");
/** Tier distribution row: name, bar, count. */
export const TIER_ROW_CLASS_NAME = cn("flex", "flex-col", "gap-1", "py-1");
/** The segment checkboxes on one wrapping line. */
export const CHECKS_CLASS_NAME = cn("flex", "flex-wrap", "gap-x-6", "gap-y-2");
/** Repeating sub-form row (tier, category) in the settings card. */
export const SUBROW_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-3", "rounded-lg", "border", "border-separator", "p-3");
/** The member detail column. */
export const DETAIL_CLASS_NAME = cn("min-w-0");
