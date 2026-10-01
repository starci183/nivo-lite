import { cn } from "@heroui/react";

/** Page rhythm: header, filters, cards. */
export const PAGE_CLASS = cn("flex", "flex-col", "gap-6");

/** Console chrome: a top bar with the brand, nav and who is signed in. */
export const BAR_CLASS = cn("flex", "flex-wrap", "items-center", "justify-between", "gap-x-6", "gap-y-2", "border-b", "border-separator", "px-4", "py-3", "md:px-8");
export const NAV_CLASS = cn("flex", "flex-wrap", "items-center", "gap-2");

/** Search box + filter buttons. */
export const FILTERS_CLASS = cn("flex", "flex-wrap", "items-end", "gap-3");
export const SEARCH_FORM_CLASS = cn("flex", "flex-wrap", "items-end", "gap-3");
export const CHIPS_CLASS = cn("flex", "flex-wrap", "items-center", "gap-2");

/** Data table: wide, scrolls sideways inside its region on phones. */
export const TABLE_CLASS = cn("w-full", "min-w-[64rem]", "border-collapse", "text-left", "text-sm");
export const TH_CLASS = cn("whitespace-nowrap", "border-b", "border-separator", "px-3", "py-2", "text-xs", "font-semibold", "uppercase", "tracking-wide", "text-muted");
export const TD_CLASS = cn("border-b", "border-separator", "px-3", "py-3", "align-top");
export const TD_NUM_CLASS = cn("border-b", "border-separator", "px-3", "py-3", "text-right", "align-top", "tabular-nums");
export const CELL_STACK_CLASS = cn("flex", "flex-col", "items-start", "gap-1");
export const BADGE_WRAP_CLASS = cn("flex", "flex-wrap", "gap-1");

/** Overview facts (label over value) and key/value grids. */
export const FACTS_CLASS = cn("grid", "grid-cols-2", "gap-x-6", "gap-y-4", "md:grid-cols-4");
export const FACT_CLASS = cn("flex", "min-w-0", "flex-col", "gap-0.5");
export const GRID_CLASS = cn("grid", "grid-cols-1", "gap-6", "xl:grid-cols-2");
export const STACK_CLASS = cn("flex", "flex-col", "gap-4");
export const LIST_CLASS = cn("m-0", "flex", "list-none", "flex-col", "p-0");
export const ROW_CLASS = cn("flex", "flex-wrap", "items-center", "justify-between", "gap-x-4", "gap-y-1", "border-t", "border-separator", "py-2.5", "first:border-t-0");
export const ROW_MAIN_CLASS = cn("flex", "min-w-0", "flex-1", "basis-56", "flex-col", "gap-0.5");
export const ROW_META_CLASS = cn("flex", "flex-wrap", "items-center", "gap-2");

/** Support action panels with an in-page confirmation step. */
export const ACTION_CLASS = cn("flex", "flex-col", "gap-3", "rounded-xl", "border", "border-divider", "p-4");
export const ACTION_ROW_CLASS = cn("flex", "flex-wrap", "items-end", "gap-3");
export const CONFIRM_CLASS = cn("flex", "flex-wrap", "items-center", "gap-3");

/** Error / job messages: small monospace, wraps. */
export const MONO_CLASS = cn("break-words", "font-mono", "text-xs", "text-muted");
