/** Search, filters and the grid, stacked. */
export const connectionLibraryClassNames = {
    filters: "flex min-w-0 flex-col gap-4",
    /** Search grows, the sort sits beside it from sm, stacked on phones. */
    toolbar: "flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center",
    search: "min-w-0 flex-1",
    /** The sort keeps a compact width beside the search. */
    sort: "w-full sm:w-48 sm:shrink-0",
    /** Connector cards: one column on a phone, up to three on a wide screen. */
    grid: "grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3",
    card: "flex h-full min-w-0 flex-col gap-3",
    cardHead: "flex items-center gap-3",
    /** Badge on the left, action on the right (wraps on narrow cards). */
    cardFoot: "mt-auto flex flex-wrap items-center justify-between gap-2",
} as const
