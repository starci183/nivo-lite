/** The month grid: seven columns (GAP-1 between the chips of a day). */
export const GRID_CLASS_NAME = "grid grid-cols-7"
/** Weekday header cell: a recessed band with a seam below it (SURFACE-3, BOUNDARY-1). */
export const GRID_HEAD_CLASS_NAME = "flex justify-center border-b border-separator bg-surface-secondary px-2 py-1"
const CELL = "flex min-h-28 min-w-0 flex-col gap-1 border-b border-r border-separator p-1 [&:nth-child(7n)]:border-r-0"
/** A cell outside the month; the seventh column drops its inline seam (BOUNDARY-4 case-2). */
export const OUT_CELL_CLASS_NAME = `${CELL} bg-surface-secondary`
/** The class of a day cell: today is tinted, the cell a post is dragged over is outlined. */
export const cellClassName = (today: boolean, over: boolean): string =>
    [CELL, today ? "bg-accent-soft" : "", over ? "outline-2 outline-accent -outline-offset-2" : ""]
        .filter(Boolean)
        .join(" ")
