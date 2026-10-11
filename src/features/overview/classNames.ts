import { cn } from "@heroui/react";

/** The page: header, banner, KPI band, then the responsibilities beside the rail. */
export const PAGE_CLASS_NAME = cn("flex", "flex-col", "gap-4");

/** Header actions: the secondary and the one primary. */
export const HEADER_ACTIONS_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-3");



/** The KPI band: five whole-action cards on one line on wide screens (GAP-4 case-2: cards in one collection grid). */
export const KPI_GRID_CLASS_NAME = cn("grid", "grid-cols-2", "gap-4", "sm:grid-cols-3", "lg:grid-cols-5");

/** One KPI's copy: label over the number (GAP-1). */
export const KPI_COPY_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-1");


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


/** Page: tighter top rhythm inside the shell's page area. */
export const PAGE_INSET_CLASS_NAME = cn("py-2", "md:py-4");

/** A stack of governance content. */
export const STACK_CLASS_NAME = cn("flex", "flex-col", "gap-3");

/** One governance block: heading then card. */
export const BLOCK_CLASS_NAME = cn("flex", "flex-col", "gap-3");

/** Three department tiles: one column on phones, three from sm. */
export const DEPT_GRID_CLASS_NAME = cn("grid", "grid-cols-1", "gap-4", "sm:grid-cols-3");

/** One department card's copy: name, done, waiting, last activity (GAP-1). */
export const TILE_COPY_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-1");

/** Waiting items: nested whole-action cards stacked (GAP-3). */
export const WAIT_LIST_CLASS_NAME = cn("flex", "flex-col", "gap-3");

/** Decision history rows: one hairline between rows (BOUNDARY-3 case-1). */
export const HISTORY_LIST_CLASS_NAME = cn("divide-y", "divide-separator");

/** One decision history row: separator-facing sides take `py-3` (PADDING-3), the outer edges close on the card inset. */
export const HISTORY_ROW_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-1", "py-3", "first:pt-0", "last:pb-0");




/** A goal line: text with an optional link. */
export const GOAL_LINE_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-x-3", "gap-y-1");

/** Badges on one wrapping line. */
export const CHIP_ROW_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-2");


/** Status results: one row per status, separated by a hairline. */
export const STATUS_LIST_CLASS_NAME = cn("flex", "flex-col", "divide-y", "divide-separator");

/** One status row: what it is on the left, live and simulated side by side on the right (stacked on phones). */
export const STATUS_ROW_CLASS_NAME = cn("grid", "grid-cols-1", "gap-2", "py-3", "first:pt-0", "last:pb-0", "md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)]", "md:gap-4");

/** Status label over its evidence line. */
export const STATUS_LABEL_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-1");

/** Live and simulated cells: two across even on phones. */
export const STATUS_SPLIT_CLASS_NAME = cn("grid", "grid-cols-2", "gap-3", "md:contents");

/** One origin cell: origin label, value, record count. */
export const STATUS_CELL_CLASS_NAME = cn("flex", "min-w-0", "flex-col", "gap-1", "break-words");
