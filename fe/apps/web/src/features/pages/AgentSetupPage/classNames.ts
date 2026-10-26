/** The two columns of the tab, edge to edge in the joined surface: stacked on narrow widths, side by side from xl. */
export const SPLIT = "flex min-h-0 min-w-0 flex-1 flex-col xl:flex-row"

/** The chat column takes the remaining width. */
export const CHAT_COLUMN = "flex min-h-112 min-w-0 flex-col xl:min-h-0 xl:flex-1"

/** The line between the columns: horizontal below xl. */
export const SEPARATOR_HORIZONTAL = "xl:hidden"

/** The vertical hairline between the columns: hidden below xl, a column from xl. */
export const SEPARATOR_VERTICAL = "hidden shrink-0 xl:flex"

/** The checklist column keeps a fixed width from xl. */
export const SIDE_COLUMN = "min-w-0 xl:w-104 xl:shrink-0 xl:overflow-y-auto"
