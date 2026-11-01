/** The tile grid (one column on a phone) and the anatomy inside one tile. */
export const connectionLibraryClassNames = {
    card: "flex h-full min-w-0 flex-col gap-3",
    /** The status and the command share the foot row, pinned to the bottom of an equal-height tile. */
    cardFoot: "mt-auto flex flex-col gap-2",
} as const
