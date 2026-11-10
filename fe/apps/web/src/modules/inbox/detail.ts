import type { InboxLeadQuery } from "@/modules/api"
import type { InboxDetailView, InboxFactView, InboxOrderView } from "@/modules/types"
import { journeyOf } from "./journey"
import { chipViewsOf } from "./rows"
import type { InboxWords } from "./rows"
import { INBOX_STAGES, channelKeyOf, chipToneOf, maskedPhoneOf, sectionOf } from "./shared"

type Detail = InboxLeadQuery["inboxLead"]

/** The words of an authority action, supplied by the caller (the one door every screen reads an action key through). */
type ActionWord = (action: string) => string

const present = (id: string, term: string, text: string | null | undefined): ReadonlyArray<InboxFactView> =>
    text === null || text === undefined || text.trim() === "" ? [] : [{ id, term, text }]

/** The orders of the aside, each with its number and value, what it holds and where it stands. */
const ordersOf = (data: Detail, words: InboxWords): ReadonlyArray<InboxOrderView> =>
    data.orders.map((order) => ({
        id: order.id,
        title: [order.orderNo, order.amountVnd === null ? null : words.money(order.amountVnd)]
            .filter((part) => part !== null)
            .join(" · "),
        description: order.itemsText ?? "",
        badge: {
            key: order.status,
            label: words.t(`orderStatus_${order.status}`),
            tone:
                order.status === "paid"
                    ? "success"
                    : chipToneOf(order.status === "cancelled" ? "x" : "awaiting_payment"),
        },
    }))

/** The facts the agent extracted: what, how much, when and where, and a note. */
const needsFactsOf = (data: Detail, words: InboxWords): ReadonlyArray<InboxFactView> => [
    ...present("items", words.t("factItems"), data.needs.items),
    ...present("value", words.t("factValue"), data.needs.valueVnd === null ? null : words.money(data.needs.valueVnd)),
    ...present("delivery", words.t("factDelivery"), data.needs.delivery),
    ...present("note", words.t("factNote"), data.needs.note),
]

/** Who the customer is: phone (hidden in the middle), Zalo link, first seen, what they bought. */
const customerFactsOf = (data: Detail, words: InboxWords): ReadonlyArray<InboxFactView> => [
    ...present("phone", words.t("custPhone"), data.phone === null ? null : maskedPhoneOf(data.phone)),
    { id: "zalo", term: words.t("custZalo"), text: words.t(data.zaloLinked ? "zaloLinked" : "zaloNotLinked") },
    {
        id: "first",
        term: words.t("custFirst"),
        text:
            sectionOf(data.lead.firstAt, words.now) === "today"
                ? words.t("sectionToday")
                : words.date(data.lead.firstAt),
    },
    { id: "bought", term: words.t("custBought"), text: words.t("boughtCount", { n: data.paidCount }) },
]

/** Where the customer came from: the channel and how, the page, the campaign and the device. */
const sourceFactsOf = (data: Detail, words: InboxWords): ReadonlyArray<InboxFactView> => {
    const channel = words.t(`channel_${channelKeyOf(data.source.channel)}`)
    const via = data.source.via === null ? null : words.t(`via_${data.source.via}`)
    const device = data.source.device
    return [
        {
            id: "channel",
            term: words.t("sourceChannel"),
            text: [channel, via].filter((part) => part !== null).join(" · "),
        },
        ...present("page", words.t("sourcePage"), data.source.landing),
        ...present("campaign", words.t("sourceCampaign"), data.source.campaign),
        ...present(
            "device",
            words.t("sourceDevice"),
            device === null
                ? null
                : ["mobile", "desktop", "tablet"].includes(device)
                  ? words.t(`device_${device}`)
                  : device,
        ),
    ]
}

/** The line under the name: where the customer came from and how long ago they last wrote. */
const sourceLineOf = (data: Detail, words: InboxWords): string => {
    const parts = sourceFactsOf(data, words)
        .filter((fact) => fact.id !== "device")
        .map((fact) => fact.text)
    return words.t("sourceLine", { parts: parts.join(" · "), ago: words.ago(data.lead.lastAt) })
}

/** The opened customer as the head, the cards and the aside draw it, every word in the reader's language. */
export const detailViewOf = (data: Detail, words: InboxWords, action: ActionWord): InboxDetailView => {
    const lead = data.lead
    const name = lead.name === "" ? words.t("unnamed") : lead.name
    const channel = channelKeyOf(lead.channel)
    const stageKey = lead.chips.find((key) => key !== "needs_you") ?? lead.stage
    const agent = data.approval?.agentName ?? lead.agentName ?? words.t("approvalAgent")
    const approval = data.approval
    const body = [approval?.itemsText ?? null, approval?.amountVnd == null ? null : words.money(approval.amountVnd)]
        .filter((part) => part !== null)
        .join(" · ")
    return {
        id: lead.id,
        name,
        channelKey: channel,
        channelBadge: words.t(`badge_${channel}`),
        channelLabel: words.t(`channel_${channel}`),
        stageChip: chipViewsOf([stageKey], words.t)[0] ?? { key: stageKey, label: stageKey, tone: "neutral" },
        sourceLine: sourceLineOf(data, words),
        agent:
            lead.agentId === null || lead.agentName === null
                ? null
                : { id: lead.agentId, name: lead.agentName, avatarUrl: lead.agentAvatarUrl },
        steps: INBOX_STAGES.map((id) => ({ id, label: words.t(`step_${id}`) })),
        currentStep: lead.stage,
        approval:
            approval === null
                ? null
                : {
                      title:
                          approval.orderId === null || approval.orderNo === null
                              ? words.t("approvalDecision", { agent })
                              : words.t("approvalOrder", { agent, order: approval.orderNo }),
                      body,
                      orderId: approval.orderId,
                  },
        needsSummary: data.needs.summary ?? words.t("needsEmpty"),
        needsFacts: needsFactsOf(data, words),
        journey: journeyOf(data, name, words, action),
        customerFacts: customerFactsOf(data, words),
        sourceFacts: sourceFactsOf(data, words),
        orders: ordersOf(data, words),
        phone: data.phone,
    }
}
