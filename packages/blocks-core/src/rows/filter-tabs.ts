import { z } from "zod"

/** The tab that shows every row; a filter value never takes this key. */
export const ALL_TAB = "all"

/** The most records a count may carry: one per tab, as many as the block lists. */
const COUNTS_MAX = 50

/** The shape of the counts read: the rows per filter value, and the rows with every value of the filter. */
export const countsView: z.ZodType<{ readonly counts: Readonly<Record<string, number>>; readonly total: number }> =
    z.object({
        counts: z
            .record(z.string().max(64), z.number().int().nonnegative())
            .refine((counts) => Object.keys(counts).length <= COUNTS_MAX),
        total: z.number().int().nonnegative(),
    })

/** The counts of a filter as the block reads them. */
export type TabCounts = z.infer<typeof countsView>

/** One filter a spec lists, with its words already in the viewer's language. */
export interface TabSpec {
    /** The value the param takes when the tab is chosen. */
    readonly value: string
    /** The words on the tab. */
    readonly label: string
    /** Whether rows with this value wait for the viewer, so the count draws as a warning. */
    readonly attention: boolean
}

/** One tab as the Grammar draws it: the count is absent while it is unknown. */
export interface TabEntry {
    /** The key of the tab: the filter value, or the key of the all tab. */
    readonly id: string
    /** The words on the tab. */
    readonly label: string
    /** How many rows the tab holds; absent while the counts are unknown. */
    readonly count?: number
    /** Whether the count draws as a warning: rows wait for the viewer. */
    readonly isAttention?: boolean
}

/** The tabs of a filter: the all tab first, then one per filter value, each with its count when the counts are known. */
export const tabEntriesOf = (
    allLabel: string,
    specs: ReadonlyArray<TabSpec>,
    counts: TabCounts | null,
): ReadonlyArray<TabEntry> => [
    { id: ALL_TAB, label: allLabel, ...(counts === null ? {} : { count: counts.total }) },
    ...specs.map((spec): TabEntry => {
        if (counts === null) return { id: spec.value, label: spec.label }
        const count = counts.counts[spec.value] ?? 0
        return {
            id: spec.value,
            label: spec.label,
            count,
            ...(spec.attention && count > 0 ? { isAttention: true } : {}),
        }
    }),
]

/** The tab that is selected for the param's value: the all tab when the param is absent or names no tab. */
export const selectedTab = (value: string | null, specs: ReadonlyArray<TabSpec>): string =>
    value !== null && specs.some((spec) => spec.value === value) ? value : ALL_TAB

/** What to write to the param when a tab is chosen: the all tab clears the param, which then takes its default. */
export const tabParamValue = (key: string): string | null => (key === ALL_TAB ? null : key)

/** The counts a skeleton draws while the counts read loads: the tabs keep their words and no count. */
export const TAB_COUNTS_PLACEHOLDER: TabCounts = { counts: {}, total: 0 }

/** The name of the menu that holds the folded tabs: the message with its `{count}` replaced by how many tabs fold. */
export const moreLabelOf = (template: string, count: number): string => template.replaceAll("{count}", String(count))
