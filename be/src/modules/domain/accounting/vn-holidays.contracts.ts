/** Public holidays on a fixed solar date (Labour Code 2019, art. 112), `MM-DD`. */
export const FIXED_HOLIDAYS: ReadonlyArray<string> = ["01-01", "04-30", "05-01", "09-02"]

/**
 * The lunar-calendar and adjacent days off announced for each year (Lunar New Year, Hung Kings, the day next to National Day, and the
 * compensatory days). Extend this list when the government announces the next year's schedule.
 */
export const DATED_HOLIDAYS: ReadonlyArray<string> = [
    "2026-02-14",
    "2026-02-15",
    "2026-02-16",
    "2026-02-17",
    "2026-02-18",
    "2026-02-19",
    "2026-02-20",
    "2026-02-21",
    "2026-02-22",
    "2026-04-27",
    "2026-09-01",
    "2027-02-05",
    "2027-02-06",
    "2027-02-07",
    "2027-02-08",
    "2027-02-09",
    "2027-02-10",
    "2027-04-16",
    "2027-09-03",
]
