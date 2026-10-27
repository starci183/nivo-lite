/** The dialog body stacks its parts; the column pickers take one column on a phone, two from md up. */
export const contractImportDialogClassNames = {
    body: "flex flex-col gap-4",
    actions: "flex flex-wrap items-center gap-2",
    columns: "grid grid-cols-1 gap-3 md:grid-cols-2",
} as const
