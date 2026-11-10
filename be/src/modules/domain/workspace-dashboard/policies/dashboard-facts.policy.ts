import type { ChannelFacts, Compared } from "../workspace-dashboard.contracts"

/** A measure the database answered, as a number: text (bigint, numeric) is read, null and anything else is zero. */
export const numberOf = (value: unknown): number => {
    if (typeof value !== "number" && typeof value !== "string") return 0
    const read = Number(value)
    return Number.isFinite(read) ? read : 0
}

/** A figure in the period and in the period before it. */
export const comparedOf = (current: unknown, previous: unknown): Compared => ({
    current: numberOf(current),
    previous: numberOf(previous),
})

/** A part over its whole, 0..1; null while there is no whole (nothing to divide by is not zero percent). */
export const rateOf = (part: number, whole: number): number | null => (whole > 0 ? Math.min(1, part / whole) : null)

/** Leads and revenue per channel: every channel either side knows, the one with the most leads first, then the most revenue, then by name. */
export const channelsOf = (
    leads: ReadonlyMap<string, number>,
    revenue: ReadonlyMap<string, number>,
): ReadonlyArray<ChannelFacts> =>
    [...new Set([...leads.keys(), ...revenue.keys()])]
        .map((channel) => ({
            channel,
            leads: leads.get(channel) ?? 0,
            revenueVnd: revenue.get(channel) ?? 0,
        }))
        .filter((facts) => facts.leads > 0 || facts.revenueVnd > 0)
        .sort(
            (left, right) =>
                right.leads - left.leads ||
                right.revenueVnd - left.revenueVnd ||
                left.channel.localeCompare(right.channel),
        )
