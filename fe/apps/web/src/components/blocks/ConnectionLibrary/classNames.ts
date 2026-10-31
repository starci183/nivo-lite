/** The tile grid (one column on a phone) and the anatomy inside one tile. */
export const connectionLibraryClassNames = {
    grid: "grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3",
    card: "flex h-full min-w-0 flex-col gap-3",
    cardHead: "flex items-center gap-3",
    cardName: "min-w-0 flex-1",
    /** The "I want it" command sits under the name of a planned connector. */
    cardFoot: "mt-auto flex flex-col items-start gap-2",
} as const
