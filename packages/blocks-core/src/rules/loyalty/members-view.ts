import { z } from "zod"
import { ALL_TAB, type TabCounts, type TabEntry } from "../../rows/filter-tabs"
import { textOf, valueAt } from "../../slots/paths"

/** The activity value of a customer who has gone quiet; its tab sits after the tiers. */
export const AT_RISK = "at_risk"

/** The sorts of the members list, in the order the select offers them; each is a sort of `loyalty.members`. */
export const MEMBER_SORTS: readonly ["points", "recent", "spend", "name"] = ["points", "recent", "spend", "name"]

/** One sort of the members list. */
export type MemberSort = (typeof MEMBER_SORTS)[number]

/** The message key of the words of a sort. */
export const sortKeyOf = (sort: MemberSort): string => `members_sort_${sort}`

/** The message keys of the words of a member row. */
export interface MemberWordKeys {
    /** The words that tell when the member last bought. */
    readonly lastPurchase: string
    /** The words that tell the points held. */
    readonly points: string
    /** The words of the mark of a member who went quiet. */
    readonly atRisk: string
}

/** The message keys of the other words of a member row. */
export const MEMBER_WORD_KEYS: MemberWordKeys = {
    lastPurchase: "members_last_purchase",
    points: "members_points",
    atRisk: "members_at_risk",
}

/** The most tiers a ladder lists. */
const TIERS_MAX = 20

/** The tiers of the ladder as `loyalty.tiers` answers them: the key a member list filters by, and the name the owner gave it. */
export const tiersView: z.ZodType<ReadonlyArray<{ readonly key: string; readonly name: string }>> = z
    .array(z.looseObject({ key: z.string().min(1).max(64), name: z.string().max(200) }))
    .max(TIERS_MAX)

/** One tier of the ladder. */
export type MemberTier = z.infer<typeof tiersView>[number]

/** The words on the tabs that are not tiers. */
export interface MemberTabWords {
    /** The tab that shows every member. */
    readonly all: string
    /** The tab of the members who have gone quiet. */
    readonly atRisk: string
}

/**
 * The tabs of the members list: all of them, a tab for each tier of the ladder in its order (a renamed ladder works as it is),
 * and the members who have gone quiet when the spec shows that tab. Counts are absent while a read is unknown.
 */
export const memberTabsOf = (
    tiers: ReadonlyArray<MemberTier>,
    tierCounts: TabCounts | null,
    activityCounts: TabCounts | null,
    words: MemberTabWords,
    showAtRisk: boolean,
): ReadonlyArray<TabEntry> => {
    const atRisk = activityCounts?.counts[AT_RISK] ?? 0
    return [
        { id: ALL_TAB, label: words.all, ...(tierCounts === null ? {} : { count: tierCounts.total }) },
        ...tiers.map((tier): TabEntry => ({
            id: tier.key,
            label: tier.name,
            ...(tierCounts === null ? {} : { count: tierCounts.counts[tier.key] ?? 0 }),
        })),
        ...(showAtRisk
            ? [
                  {
                      id: AT_RISK,
                      label: words.atRisk,
                      ...(activityCounts === null ? {} : { count: atRisk }),
                      ...(atRisk > 0 ? { isAttention: true } : {}),
                  },
              ]
            : []),
    ]
}

/** What the two params of the tabs hold: the tier chosen and the activity chosen, each null when it narrows nothing. */
export interface TabParams {
    /** The tier key the list is narrowed to; null when it is not narrowed by tier. */
    readonly tier: string | null
    /** The activity the list is narrowed to; null when it is not narrowed by activity. */
    readonly activity: string | null
}

/** The tab the params name: the quiet members, a tier of the ladder, or all of them. */
export const selectedMemberTab = (params: TabParams, tiers: ReadonlyArray<MemberTier>, showAtRisk: boolean): string => {
    if (showAtRisk && params.activity === AT_RISK) return AT_RISK
    return tiers.some((tier) => tier.key === params.tier) && params.tier !== null ? params.tier : ALL_TAB
}

/** What the params must hold for a tab to be chosen. */
export const paramsOfTab = (tab: string): TabParams => {
    if (tab === ALL_TAB) return { tier: null, activity: null }
    return tab === AT_RISK ? { tier: null, activity: AT_RISK } : { tier: tab, activity: null }
}

/** A phone or email with the middle hidden: the first four digits and the last three, or the first letter of an email. */
export const maskedContact = (contact: string): string => {
    const at = contact.indexOf("@")
    if (at > 0) return `${contact.slice(0, 1)}***${contact.slice(at)}`
    const compact = contact.replaceAll(/\s/g, "")
    const digits = compact.startsWith("84") && compact.length > 10 ? `0${compact.slice(2)}` : compact
    return digits.length < 8 ? contact : `${digits.slice(0, 4)} *** ${digits.slice(-3)}`
}

/** One member as the list draws them. */
export interface MemberEntry {
    /** The customer id. */
    readonly id: string
    /** The name. */
    readonly name: string
    /** The phone or email, hidden in the middle; empty when there is none. */
    readonly contact: string
    /** The name of the held tier; empty before the first purchase. */
    readonly tier: string
    /** The points held. */
    readonly points: number
    /** When the last purchase earned points, ISO text; empty when there is none. */
    readonly lastVisitAt: string
    /** Whether the customer has gone quiet. */
    readonly isAtRisk: boolean
}

/** The members of a read's records; a record without an id draws no row, and points that are no number count as none. */
export const memberEntriesOf = (records: ReadonlyArray<unknown>): ReadonlyArray<MemberEntry> =>
    records.flatMap((record) => {
        const id = textOf(valueAt(record, "id"))
        if (id === "") return []
        const points = valueAt(record, "points")
        return [
            {
                id,
                name: textOf(valueAt(record, "name")),
                contact: maskedContact(textOf(valueAt(record, "contact"))),
                tier: textOf(valueAt(record, "tier")),
                points: typeof points === "number" && Number.isFinite(points) ? points : 0,
                lastVisitAt: textOf(valueAt(record, "lastVisitAt")),
                isAtRisk: valueAt(record, "activity") === AT_RISK,
            },
        ]
    })

/** The line under a member's name: the hidden contact, then when they last bought; either may be missing. */
export const memberLineOf = (entry: MemberEntry, lastPurchase: string): string =>
    [entry.contact, lastPurchase].filter((part) => part !== "").join(" \u00b7 ")
