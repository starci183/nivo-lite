import type { OverviewWindow } from "./overview.contracts"

/** The start of the founding offer (the product time zone, UTC+7). */
const FOUNDING_FROM = "2026-09-28T17:00:00.000Z"

/** The end of the founding offer. */
const FOUNDING_TO = "2026-10-31T16:59:59.000Z"

/** How many evidence lines the dashboard shows. */
export const RECENT_EVENTS = 6

const DAY_MS = 86_400_000

/** The window the dashboard reads at `now`: the last 7 days and the founding offer. */
export const windowAt = (now: Date): OverviewWindow => ({
    since7: new Date(now.getTime() - 7 * DAY_MS).toISOString(),
    foundingFrom: FOUNDING_FROM,
    foundingTo: FOUNDING_TO,
})
