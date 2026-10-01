import { cn } from "@heroui/react";

/** The page: header, banner, KPI band, then the responsibilities beside the rail. */
export const PAGE_CLASS_NAME = cn("flex", "flex-col", "gap-4");

/** Header actions: the secondary and the one primary. */
export const HEADER_ACTIONS_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-3");

/** Decision banner content: mark, copy, link. */
export const BANNER_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-4");

/** Banner copy column. */
export const BANNER_COPY_CLASS_NAME = cn("flex", "min-w-0", "flex-1", "basis-56", "flex-col", "gap-1");

/** The KPI band: five cards on one line on wide screens. */
export const KPI_GRID_CLASS_NAME = cn("grid", "grid-cols-2", "gap-2", "sm:grid-cols-3", "lg:grid-cols-5");

/** One KPI: label over the number. */
export const KPI_CLASS_NAME = cn("flex", "min-h-12", "flex-col", "gap-1", "rounded-lg", "p-2", "no-underline", "hover:bg-surface-secondary", "focus-visible:outline-2", "focus-visible:outline-focus");

/** Rail: pipeline, agents, activity stacked. */
export const RAIL_CLASS_NAME = cn("flex", "flex-col", "gap-6");

/** A row in a rail card. */
export const RAIL_ROW_CLASS_NAME = cn("list-none", "px-4", "py-3");

/** Agent row: tile, name and status, chat link. */
export const AGENT_ROW_CLASS_NAME = cn("flex", "list-none", "items-center", "gap-3", "px-4", "py-3");

/** Agent name over handle. */
export const AGENT_TEXT_CLASS_NAME = cn("flex", "min-w-0", "flex-1", "flex-col", "gap-1");

/** Activity row: kind icon, text, time. */
export const ACTIVITY_ROW_CLASS_NAME = cn("flex", "items-start", "gap-3");

/** Activity text column. */
export const ACTIVITY_TEXT_CLASS_NAME = cn("flex", "min-w-0", "flex-1", "flex-col", "gap-1");

/** Actor and time share a line. */
export const ACTIVITY_HEAD_CLASS_NAME = cn("flex", "items-baseline", "justify-between", "gap-3");

/** Main column: section title line, then owner sections. */
export const MAIN_CLASS_NAME = cn("flex", "flex-col", "gap-4");

/** Needs-you strip: mark, copy, one action. */
export const NEEDS_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-3");

/** Page: tighter top rhythm inside the shell's page area. */
export const PAGE_INSET_CLASS_NAME = cn("py-2", "md:py-4");

/** A stack of governance content. */
export const STACK_CLASS_NAME = cn("flex", "flex-col", "gap-3");

/** One governance block: heading then card. */
export const BLOCK_CLASS_NAME = cn("flex", "flex-col", "gap-3");

/** Three department tiles: one column on phones, three from sm. */
export const DEPT_GRID_CLASS_NAME = cn("grid", "grid-cols-1", "gap-2", "sm:grid-cols-3");

/** One department tile (a link into Office). */
export const DEPT_TILE_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-1", "rounded-lg", "border", "border-separator", "p-3", "no-underline", "hover:bg-surface-secondary", "focus-visible:outline-2", "focus-visible:outline-focus");

/** Result metrics: two across on phones, five on wide screens. */
export const METRIC_GRID_CLASS_NAME = cn("grid", "grid-cols-1", "gap-3", "min-[480px]:grid-cols-2", "lg:grid-cols-5");

/** One result metric: label, value, context. */
export const METRIC_TILE_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-1", "break-words");

/** A goal line: text with an optional link. */
export const GOAL_LINE_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-x-3", "gap-y-1");

/** Badges on one wrapping line. */
export const CHIP_ROW_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-2");

/** A waiting item or decision row. */
export const WAIT_ROW_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-1", "rounded-lg", "px-2", "py-2", "no-underline", "hover:bg-surface-secondary", "focus-visible:outline-2", "focus-visible:outline-focus");

/** Status results: one row per status, separated by a hairline. */
export const STATUS_LIST_CLASS_NAME = cn("flex", "flex-col", "divide-y", "divide-separator");

/** One status row: what it is on the left, live and simulated side by side on the right (stacked on phones). */
export const STATUS_ROW_CLASS_NAME = cn("grid", "grid-cols-1", "gap-2", "py-3", "first:pt-0", "last:pb-0", "md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)]", "md:gap-4");

/** Status label over its evidence line. */
export const STATUS_LABEL_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-1");

/** Live and simulated cells: two across even on phones. */
export const STATUS_SPLIT_CLASS_NAME = cn("grid", "grid-cols-2", "gap-3", "md:contents");

/** One origin cell: origin label, value, record count. */
export const STATUS_CELL_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-0.5", "break-words");
