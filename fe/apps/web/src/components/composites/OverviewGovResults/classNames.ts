/** A stack of governance content. */
export const STACK_CLASS_NAME = "flex flex-col gap-3"
/** A goal line: text with an optional link. */
export const GOAL_LINE_CLASS_NAME = "flex flex-wrap items-center gap-x-3 gap-y-1"
/** Status results: one row per status, separated by a hairline. */
export const STATUS_LIST_CLASS_NAME = "flex flex-col divide-y divide-separator"
/** One status row: what it is on the left, live and simulated side by side on the right. */
export const STATUS_ROW_CLASS_NAME =
    "grid grid-cols-1 gap-2 py-3 first:pt-0 last:pb-0 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)] md:gap-4"
/** Status label over its evidence line. */
export const STATUS_LABEL_CLASS_NAME = "flex min-w-0 flex-col gap-1"
/** Live and simulated cells: two across even on phones. */
export const STATUS_SPLIT_CLASS_NAME = "grid grid-cols-2 gap-3 md:contents"
/** One origin cell: origin label, value, record count. */
export const STATUS_CELL_CLASS_NAME = "flex min-w-0 flex-col gap-1 break-words"
