/** The open tab's region and the docked live panel side by side, wrapping under each other on a narrow screen (GAP-6 between page regions). */
export const sepayConsoleClassNames = {
    frame: "flex flex-wrap items-start gap-6",
    main: "flex min-w-0 flex-[999_1_32rem] flex-col gap-4",
    aside: "flex min-w-0 flex-[1_1_20rem] flex-col gap-4",
} as const
