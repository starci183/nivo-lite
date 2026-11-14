/** A day of the year. */
type YearDay = {
    /** The month, 1 to 12. */
    readonly month: number
    /** The day of the month. */
    readonly day: number
}

/** The n-th weekday of a month. */
type NthWeekday = {
    /** The month, 1 to 12. */
    readonly month: number
    /** The weekday, Sunday 0. */
    readonly weekday: number
    /** Its rank in the month, from 1. */
    readonly n: number
}

/** What every occasion has: its key and its name. */
type Named = {
    /** The stable key. */
    readonly key: string
    /** Its name, as the prompts read it. */
    readonly name: string
}

/** An occasion on a fixed day of the year. */
type FixedOccasion = Named & {
    /** The day of the year it falls on. */
    readonly fixed: YearDay
}

/** An occasion on the n-th weekday (Sunday 0) of a month. */
type NthOccasion = Named & {
    /** The weekday of the month it falls on. */
    readonly nth: NthWeekday
}

/** An occasion of the lunar calendar, by its date in each year. */
type DatedOccasion = Named & {
    /** Its day in each year the calendar holds. */
    readonly dates: Readonly<Record<string, string>>
}

/** One occasion of the calendar: when it falls, how many days ahead posts prepare it, and the angle a post may take. */
export type Occasion = (FixedOccasion | NthOccasion | DatedOccasion) & {
    /** How many days ahead posts prepare it. */
    readonly leadDays: number
    /** The angle a post may take; never an offer. */
    readonly angle: string
}

/** The Vietnamese calendar occasions a plan may pin a post to (carried from the content planner); an occasion is never an offer. */
export const OCCASIONS: ReadonlyArray<Occasion> = [
    {
        key: "new_year",
        name: "New Year 1/1",
        fixed: { month: 1, day: 1 },
        leadDays: 7,
        angle: "New Year wishes, reflect on the past year, and share the shop's plans.",
    },
    {
        key: "tet",
        name: "Tet",
        dates: { "2026": "2026-02-17", "2027": "2027-02-06", "2028": "2028-01-26", "2029": "2029-02-13", "2030": "2030-02-03" },
        leadDays: 30,
        angle: "Holiday opening hours, wishes, suitable products or services, and advance booking reminders.",
    },
    {
        key: "valentine",
        name: "Valentine's Day 14/2",
        fixed: { month: 2, day: 14 },
        leadDays: 10,
        angle: "Gifts and experiences for couples, with advance booking reminders.",
    },
    {
        key: "women_day",
        name: "International Women's Day 8/3",
        fixed: { month: 3, day: 8 },
        leadDays: 10,
        angle: "Appreciation and gift ideas. Mention offers only when the shop actually has them.",
    },
    {
        key: "hung_kings",
        name: "Hung Kings Festival",
        dates: { "2026": "2026-04-26", "2027": "2027-04-16", "2028": "2028-04-04", "2029": "2029-04-23", "2030": "2030-04-12" },
        leadDays: 5,
        angle: "Holiday opening hours.",
    },
    {
        key: "liberation",
        name: "Reunification Day 30/4 and Labour Day 1/5",
        fixed: { month: 4, day: 30 },
        leadDays: 10,
        angle: "Long weekend opening hours, family ideas, and early booking reminders.",
    },
    {
        key: "mothers_day",
        name: "Mother's Day",
        nth: { month: 5, weekday: 0, n: 2 },
        leadDays: 10,
        angle: "Gifts and appreciation for mothers.",
    },
    {
        key: "children_day",
        name: "Children's Day 1/6",
        fixed: { month: 6, day: 1 },
        leadDays: 7,
        angle: "Activities and gifts for children and families.",
    },
    {
        key: "family_day",
        name: "Vietnamese Family Day 28/6",
        fixed: { month: 6, day: 28 },
        leadDays: 5,
        angle: "Family moments and ideas to enjoy together.",
    },
    {
        key: "vu_lan",
        name: "Vu Lan",
        dates: { "2026": "2026-08-27", "2027": "2027-08-16", "2028": "2028-09-03", "2029": "2029-08-24", "2030": "2030-08-13" },
        leadDays: 5,
        angle: "Thoughtful appreciation for parents.",
    },
    {
        key: "national_day",
        name: "National Day 2/9",
        fixed: { month: 9, day: 2 },
        leadDays: 10,
        angle: "Holiday opening hours and suitable ideas for the break.",
    },
    {
        key: "double_9",
        name: "9.9 shopping day",
        fixed: { month: 9, day: 9 },
        leadDays: 5,
        angle: "Online shopping occasion. Mention offers only when the shop actually has them.",
    },
    {
        key: "mid_autumn",
        name: "Mid-Autumn Festival",
        dates: { "2026": "2026-09-25", "2027": "2027-09-15", "2028": "2028-10-03", "2029": "2029-09-22", "2030": "2030-09-12" },
        leadDays: 14,
        angle: "Mid-Autumn gifts and children's activities.",
    },
    {
        key: "double_10",
        name: "10.10 shopping day",
        fixed: { month: 10, day: 10 },
        leadDays: 5,
        angle: "Online shopping occasion. Mention offers only when the shop actually has them.",
    },
    {
        key: "vn_women_day",
        name: "Vietnamese Women's Day 20/10",
        fixed: { month: 10, day: 20 },
        leadDays: 10,
        angle: "Appreciation, gifts, and wishes for customers and staff.",
    },
    {
        key: "double_11",
        name: "11.11 shopping day",
        fixed: { month: 11, day: 11 },
        leadDays: 7,
        angle: "Online shopping occasion. Mention offers only when the shop actually has them.",
    },
    {
        key: "teachers_day",
        name: "Vietnamese Teachers' Day 20/11",
        fixed: { month: 11, day: 20 },
        leadDays: 10,
        angle: "Appreciation, gifts, and thanks for teachers.",
    },
    {
        key: "black_friday",
        name: "Black Friday",
        nth: { month: 11, weekday: 5, n: 4 },
        leadDays: 10,
        angle: "Sale week. Mention real recorded offers only and never invent discount figures.",
    },
    {
        key: "double_12",
        name: "12.12 shopping day",
        fixed: { month: 12, day: 12 },
        leadDays: 5,
        angle: "Year-end shopping occasion. Mention real recorded offers only.",
    },
    {
        key: "noel",
        name: "Christmas 24-25/12",
        fixed: { month: 12, day: 24 },
        leadDays: 14,
        angle: "Gifts, year-end atmosphere, and Christmas opening hours.",
    },
]
