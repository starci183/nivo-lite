/** The main column and the docked live panel beside it from xl; stacked below (GAP-6 between page regions). */
export const sepayConsoleClassNames = {
    page: "flex min-w-0 flex-col gap-6",
    grid: "grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]",
    main: "flex min-w-0 flex-col gap-4",
    panel: "flex min-w-0 flex-col gap-4",
} as const
