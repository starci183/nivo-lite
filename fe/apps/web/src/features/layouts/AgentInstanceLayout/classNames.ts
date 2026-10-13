/** The module switcher: a horizontal strip on narrow widths, a sticky column from lg. */
export const RAIL = "flex min-w-0 gap-2 overflow-x-auto lg:sticky lg:top-0 lg:flex-col lg:overflow-visible"

/** The link back to the whole catalogue, shown from lg. */
export const RAIL_HEAD = "hidden lg:block"

/** The name and the status of one agent in the rail. */
export const RAIL_COPY = "flex min-w-0 flex-col items-start gap-1"

/** The frame body: trail, header, tabs and the routed tab. */
export const MAIN = "flex min-w-0 flex-col gap-6"

/** The trail above the header. */
export const HEAD = "flex min-w-0 flex-col gap-2"

/** The mascot, the name and the facts of the agent. */
export const HEADER = "flex min-w-0 flex-wrap items-center gap-4"

/** The copy next to the mascot. */
export const HEADER_COPY = "flex min-w-0 flex-1 basis-60 flex-col gap-1"

/** The name with its badges. */
export const HEADER_TITLE = "flex flex-wrap items-center gap-2"

/** The facts under the name. */
export const HEADER_META = "flex flex-wrap items-center gap-x-4 gap-y-1"
