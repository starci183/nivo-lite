import { z } from "zod"
import { messageTextOf, messageView } from "./message-text"
import type { Message } from "./message-text"

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
    /** How many rows the value holds when the filter was given its tabs by a read that counts them; the counts read overrides it. */
    readonly count?: number
}

/** The longest label a tab row of a read carries as plain text. */
const LABEL_MAX = 200

/** One tab a read yields: the value the param takes, its words (text, or a message of the module) and optionally its count. */
export interface TabRow {
    /** The value the param takes when the tab is chosen. */
    readonly value: string
    /** The words on the tab: plain text, or a message translated in the words of the module. */
    readonly label: string | Message
    /** How many rows the tab holds, when the read knows. */
    readonly count?: number | undefined
    /** Whether rows with this value wait for the viewer. */
    readonly attention?: boolean | undefined
}

/** The shape of the tabs a read yields: the rows of the tabs, bounded like the tabs of a block. */
export const tabRowsView: z.ZodType<ReadonlyArray<TabRow>> = z
    .array(
        z.object({
            value: z.string().min(1).max(64),
            label: z.union([z.string().max(LABEL_MAX), messageView]),
            count: z.number().int().nonnegative().optional(),
            attention: z.boolean().optional(),
        }),
    )
    .max(COUNTS_MAX)

/** The tabs a read's rows stand for, with their words in the viewer's language; a row whose value is the all tab's or repeats one is left out. */
export const tabSpecsOf = (rows: ReadonlyArray<TabRow>, translate: (key: string) => string): ReadonlyArray<TabSpec> => {
    const seen = new Set<string>([ALL_TAB])
    return rows.flatMap((row): ReadonlyArray<TabSpec> => {
        if (seen.has(row.value)) return []
        seen.add(row.value)
        return [
            {
                value: row.value,
                label: messageTextOf(row.label, translate),
                attention: row.attention === true,
                ...(row.count === undefined ? {} : { count: row.count }),
            },
        ]
    })
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
        const count = counts === null ? spec.count : (counts.counts[spec.value] ?? 0)
        if (count === undefined) return { id: spec.value, label: spec.label }
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

/** The counts of a filter whose read settled with nothing: every tab stays, each with a count of zero. */
export const EMPTY_TAB_COUNTS: TabCounts = { counts: {}, total: 0 }

/** The name of the menu that holds the folded tabs: the message with its `{count}` replaced by how many tabs fold. */
export const moreLabelOf = (template: string, count: number): string => template.replaceAll("{count}", String(count))
