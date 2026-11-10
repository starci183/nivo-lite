import type { InboxLeadsQuery } from "@/modules/api"
import type { InboxChipView, InboxLeadRowView, InboxListView, InboxOptionView } from "@/modules/types"
import {
    ALL_OPTION,
    INBOX_CHANNELS,
    INBOX_SORTS,
    INBOX_TABS,
    SORT_WORDS,
    TAB_WORDS,
    channelKeyOf,
    chipToneOf,
    sectionOf,
} from "./shared"

/** A translator of the `inbox` catalog: a key, and the values of its placeholders. */
export type InboxTranslate = (key: string, values?: Readonly<Record<string, string | number>>) => string

/** The words and formats every view of the inbox draws with. */
export interface InboxWords {
    readonly t: InboxTranslate
    /** The moment the views are drawn at, for "today" and "yesterday". */
    readonly now: Date
    /** An amount in VND, as the reader's locale writes it. */
    readonly money: (amount: number) => string
    /** A clock time ("07:42"). */
    readonly clock: (iso: string) => string
    /** A short date ("8 Nov"). */
    readonly date: (iso: string) => string
    /** How long ago, in words ("2 min ago"). */
    readonly ago: (iso: string) => string
}

type Leads = InboxLeadsQuery["inboxLeads"]

/** The marks of a row, each with its words and tone. */
export const chipViewsOf = (keys: ReadonlyArray<string>, t: InboxTranslate): ReadonlyArray<InboxChipView> =>
    keys.map((key) => ({ key, label: t(`chip_${key}`), tone: chipToneOf(key) }))

/** One customer of the list. */
const rowOf = (lead: Leads["leads"][number], words: InboxWords): InboxLeadRowView => {
    const channel = channelKeyOf(lead.channel)
    const section = sectionOf(lead.lastAt, words.now)
    return {
        id: lead.id,
        name: lead.name === "" ? words.t("unnamed") : lead.name,
        channelKey: channel,
        channelBadge: words.t(`badge_${channel}`),
        channelLabel: words.t(`channel_${channel}`),
        time: section === "today" ? words.clock(lead.lastAt) : words.date(lead.lastAt),
        section,
        summary: lead.summary,
        chips: chipViewsOf(lead.chips, words.t),
        agent:
            lead.agentId === null || lead.agentName === null
                ? null
                : { id: lead.agentId, name: lead.agentName, avatarUrl: lead.agentAvatarUrl },
    }
}

/** The header's summary line: one short fact per number the read answered (the auto-reply share is left out while it has no value). */
const statsOf = (figures: Leads["figures"], t: InboxTranslate): ReadonlyArray<string> => [
    t("statVisitors", { n: figures.visitors7d }),
    t("statNew", { n: figures.newToday }),
    t("statNeeds", { n: figures.needsYou }),
    ...(figures.autoReplyPct === null ? [] : [t("statAuto", { n: figures.autoReplyPct })]),
]

/** The channel options of the filter: every channel, then each one the shop can receive on. */
const channelOptionsOf = (t: InboxTranslate): ReadonlyArray<InboxOptionView> => [
    { id: ALL_OPTION, label: t("optionAll") },
    ...INBOX_CHANNELS.map((channel) => ({ id: channel, label: t(`channel_${channel}`) })),
]

/** The tab counts of the answer, or zeros while there is none yet. */
const countOf = (counts: Leads["counts"] | undefined, tab: string): number => {
    if (counts === undefined) return 0
    if (tab === "new") return counts.new
    if (tab === "needs_you") return counts.needsYou
    if (tab === "ordered") return counts.ordered
    return tab === "paid" ? counts.paid : counts.all
}

/** What the user chose above the list; the answer's own rows come with it. */
export interface InboxChoice {
    readonly tab: string
    readonly query: string
    readonly channel: string
    readonly agent: string
    readonly sort: string
    readonly selectedId: string | null
}

/** The lead list pane: tabs with their counts, the selects, the summary facts and the rows. `answer` undefined is the first read. */
export const listViewOf = (answer: Leads | undefined, choice: InboxChoice, words: InboxWords): InboxListView => ({
    tabs: INBOX_TABS.map((tab) => ({
        id: tab,
        label: words.t(TAB_WORDS[tab] ?? "tabAll"),
        count: countOf(answer?.counts, tab),
    })),
    selectedTab: choice.tab,
    query: choice.query,
    channels: channelOptionsOf(words.t),
    channel: choice.channel,
    agents: [
        { id: ALL_OPTION, label: words.t("optionAll") },
        ...(answer?.agents ?? []).map((agent) => ({ id: agent.id, label: agent.name })),
    ],
    agent: choice.agent,
    sorts: INBOX_SORTS.map((sort) => ({ id: sort, label: words.t(SORT_WORDS[sort] ?? "sortRecent") })),
    sort: choice.sort,
    rows: (answer?.leads ?? []).map((lead) => rowOf(lead, words)),
    newToday: answer?.figures.newToday ?? 0,
    stats: statsOf(
        answer?.figures ?? { visitors7d: 0, newToday: 0, needsYou: 0, autoReplyPct: null, avgResponseSeconds: null },
        words.t,
    ),
    selectedId: choice.selectedId,
})
