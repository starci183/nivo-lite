import { cn } from "@heroui/react";

/** One responsibility row inside its card: tile, text column, actions. */
export const ROW_CLASS_NAME = cn("flex", "list-none", "flex-wrap", "items-center", "gap-4", "border-t", "border-separator", "px-4", "py-4", "first:border-t-0", "sm:flex-nowrap");

/** The text column of a row. */
export const ROW_BODY_CLASS_NAME = cn("flex", "min-w-0", "flex-1", "basis-56", "flex-col", "gap-1");

/** Title and status badge share the first line. */
export const ROW_TITLE_CLASS_NAME = cn("flex", "min-w-0", "flex-wrap", "items-center", "gap-2");

/** The meta line: owner and due, separated by dots. */
export const ROW_META_CLASS_NAME = cn("flex", "flex-wrap", "items-center", "gap-x-2", "gap-y-1");

/** Open and the actions menu, kept together on the right. */
export const ROW_ACTIONS_CLASS_NAME = cn("flex", "shrink-0", "items-center", "gap-2");

/** A list of row cards. */
export const ROW_LIST_CLASS_NAME = cn("m-0", "flex", "list-none", "flex-col", "gap-3", "p-0");

/** The stack of owner sections. */
export const GROUPS_CLASS_NAME = cn("flex", "flex-col", "gap-6");

/** One owner section: its header over its rows. */
export const SECTION_CLASS_NAME = cn("flex", "flex-col", "gap-3");

/** The owner header: mark, name and role on the left, count on the right. */
export const SECTION_HEAD_CLASS_NAME = cn("flex", "items-center", "justify-between", "gap-3", "px-1");

/** Mark beside the owner name and role. */
export const OWNER_MARK_CLASS_NAME = cn("flex", "min-w-0", "items-center", "gap-3");

/** Owner name over role. */
export const OWNER_TEXT_CLASS_NAME = cn("flex", "min-w-0", "flex-col");

/** Board: filters, tabs, list. */
export const BOARD_CLASS_NAME = cn("flex", "flex-col", "gap-6");

/** Filter cards in one row, with clear filters at the end. */
export const FILTERS_CLASS_NAME = cn("grid", "grid-cols-1", "items-center", "gap-4", "sm:grid-cols-2", "lg:grid-cols-4");

/** Search, tabs and sort toolbar. */
export const TOOLBAR_CLASS_NAME = cn("flex", "flex-col", "gap-4", "lg:flex-row", "lg:items-end", "lg:justify-between");

/** Search box width cap. */
export const SEARCH_CLASS_NAME = cn("w-full", "lg:w-64");

/** Sort select width cap. */
export const SORT_CLASS_NAME = cn("w-full", "lg:w-52");

/** Right side of the toolbar: search and sort. */
export const TOOLBAR_END_CLASS_NAME = cn("flex", "flex-col", "gap-4", "sm:flex-row", "sm:items-end");

/** Section title line: heading with count on the left, stamp on the right. */
export const LIST_HEAD_CLASS_NAME = cn("flex", "items-baseline", "justify-between", "gap-3", "px-1");

/** Heading and count. */
export const LIST_TITLE_CLASS_NAME = cn("flex", "items-baseline", "gap-3");
