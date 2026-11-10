import type { InboxLeadQuery } from "@/modules/api"
import type { InboxJourneyEntryView } from "@/modules/types"
import type { InboxWords } from "./rows"
import { channelKeyOf, sectionOf } from "./shared"

type Detail = InboxLeadQuery["inboxLead"]
type Entry = Detail["timeline"][number]

/** The words of an authority action, supplied by the caller (the one door every screen reads an action key through). */
type ActionWord = (action: string) => string

/** The actions of an agent that are words said to the customer: they sit on the shop's side as bubbles, not as cards. */
const REPLY_ACTION = /^(reply_|message_|send_(follow_up|quote|care|email|offer|promo|lead_offer))/

/** The action key behind an entry of an agent, without its namespace. */
const actionKeyOf = (entry: Entry): string => entry.text.slice(entry.text.lastIndexOf(".") + 1)

/** How an entry is drawn: the customer's bubble, the agent's bubble, the agent's card or a centred milestone line. */
const kindOf = (entry: Entry): InboxJourneyEntryView["kind"] => {
    if (entry.kind === "message") return "customer"
    if (entry.kind === "order" || entry.kind === "payment") return "milestone"
    return entry.kind === "agent" && REPLY_ACTION.test(actionKeyOf(entry)) ? "reply" : "action"
}

/** What an entry says: the customer's words, or what an agent did, an order, a payment or a decision, in the reader's language. */
const entryTextOf = (entry: Entry, words: InboxWords, action: ActionWord): string => {
    if (entry.kind === "message") return entry.text
    if (entry.kind === "order") return words.t("journeyOrder", { order: entry.text })
    if (entry.kind === "payment") {
        return words.t("journeyPaid", { amount: entry.amountVnd === null ? "" : words.money(entry.amountVnd) })
    }
    if (entry.kind === "decision") {
        const key = `journeyDecision_${entry.status ?? ""}`
        return key === "journeyDecision_" ? action(entry.text) : words.t(key)
    }
    return action(entry.text)
}

/** The calendar day of an instant in the local zone, the key two entries share when they fall on one day. */
const dayKeyOf = (iso: string): string => {
    const at = new Date(iso)
    return `${at.getFullYear()}-${at.getMonth() + 1}-${at.getDate()}`
}

/** The words that head a day: today, yesterday or the date. */
const dayLabelOf = (iso: string, words: InboxWords): string => {
    const section = sectionOf(iso, words.now)
    if (section === "today") return words.t("sectionToday")
    return section === "yesterday" ? words.t("sectionYesterday") : words.date(iso)
}

/** The journey, oldest first: what the customer sent against what the agents and the owner did, each with the day it falls on. */
export const journeyOf = (
    data: Detail,
    name: string,
    words: InboxWords,
    action: ActionWord,
): ReadonlyArray<InboxJourneyEntryView> =>
    data.timeline.map((entry) => {
        const channel = channelKeyOf(entry.channel ?? data.lead.channel)
        const agent = data.lead.agentName ?? words.t("approvalAgent")
        return {
            id: entry.id,
            kind: kindOf(entry),
            group: entry.kind === "message" ? "message" : "agent",
            who: entry.kind === "message" ? name : entry.kind === "decision" ? words.t("journeyOwner") : agent,
            time: words.clock(entry.at),
            day: dayKeyOf(entry.at),
            dayLabel: dayLabelOf(entry.at, words),
            text: entryTextOf(entry, words, action),
            channelKey: channel,
            channelBadge: words.t(`badge_${channel}`),
            channelLabel: words.t(`channel_${channel}`),
        }
    })
