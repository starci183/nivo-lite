/** The typed grid: a scrolling box of rows, fixed-width cells and the add buttons under it. */
export const csvImportGridClassNames = {
    root: "flex min-w-0 flex-col gap-2",
    scroll: "max-h-96 overflow-auto rounded-lg border",
    row: "flex items-end gap-2 p-2",
    cell: "w-40 shrink-0",
    actions: "flex flex-wrap items-center gap-2",
} as const
