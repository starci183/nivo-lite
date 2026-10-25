/** The header band of the column; the column owns the content edge, so the band bleeds its separator to it. */
export const HEAD_CLASS_NAME = "-mx-4 flex h-18 shrink-0 items-center gap-3 border-b border-separator px-4"

/** The title block of the header. */
export const HEAD_TEXT_CLASS_NAME = "flex min-w-0 flex-1 flex-col"

/** The search box band under the header. */
export const SEARCH_CLASS_NAME = "shrink-0 pt-3 pb-2"

/** The filter tab band under the search. */
export const TABS_CLASS_NAME = "shrink-0 pb-2"

/** The scrolling list: the one conversation list sits at the panel content edge. */
export const BODY_CLASS_NAME = "flex min-h-0 flex-1 flex-col overflow-y-auto pb-4"

/** The trailing cell of a row: the time over the indicators. */
export const TRAILING_CLASS_NAME = "flex shrink-0 flex-col items-end gap-1"

/** The indicators of a row side by side: the read double check, the mention mark, the count. */
export const INDICATOR_CLASS_NAME = "flex items-center gap-1"
