/** The rail beside the grouped tiles, the toolbar over them and the tile grid (one column on a phone). */
export const connectionLibraryClassNames = {
    layout: "flex min-w-0 flex-col gap-6 lg:flex-row lg:items-start",
    /** The category rail keeps a fixed width beside the content from lg. */
    rail: "w-full min-w-0 lg:w-60 lg:shrink-0",
    content: "flex min-w-0 flex-1 flex-col gap-4",
    /** Search grows; the agent filter and the sort sit beside it from sm, stacked on phones. */
    toolbar: "flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end",
    search: "min-w-0 flex-1",
    select: "w-full sm:w-44 sm:shrink-0",
    group: "flex min-w-0 flex-col gap-3",
    grid: "grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3",
    card: "flex h-full min-w-0 flex-col gap-3",
    cardHead: "flex items-center gap-3",
    cardName: "min-w-0 flex-1",
    /** The "I want it" command sits under the name of a planned connector. */
    cardFoot: "mt-auto flex flex-col items-start gap-2",
} as const
