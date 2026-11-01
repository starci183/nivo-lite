/** The provider mark sits inside the tile artwork slot; a bank wordmark gets a fixed row-height frame. */
export const providerLogoClassNames = {
    mark: "size-7",
    /** The 48px mark of a library tile header; with no mark the glyph keeps the 40px tile. */
    largeMark: "size-12 shrink-0",
    wordmark: "h-10 w-16 shrink-0",
} as const
