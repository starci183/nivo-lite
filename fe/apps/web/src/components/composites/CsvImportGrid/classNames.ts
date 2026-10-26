/** The typed grid: rows in a Grammar scroll region, fixed-width cells and the add buttons under it. */
export const csvImportGridClassNames = {
    root: "flex min-w-0 flex-col gap-2",
    row: "flex items-end gap-2 p-2",
    cell: "w-40 shrink-0",
    actions: "flex flex-wrap items-center gap-2",
} as const
