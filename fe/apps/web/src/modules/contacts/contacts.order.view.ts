import { agentMessageViews, type AgentMessageWords } from "@nivo-lite/plugin-registry/client"
import type { ContactHistoryOrderView, ContactHistoryOrderWords } from "@/modules/types"
import { lineOrderOf } from "./contacts.order"

/** What a registered view is given besides its payload (the view's own context type, read from the registry). */
type PreviewContext = Parameters<(typeof agentMessageViews)[number]["preview"]>[1]

/** The words of the message card for an order body: only the key/value labels are drawn, the rest is empty. */
const wordsOf = (words: ContactHistoryOrderWords): AgentMessageWords => ({
    approve: "",
    edit: "",
    reject: "",
    sendEdited: "",
    cancel: "",
    why: "",
    evidence: "",
    rule: "",
    openDetail: "",
    openWork: "",
    from: "",
    to: "",
    via: "",
    outboundTo: "",
    editLabel: "",
    states: { waiting: "", approved: "", sent: "", rejected: "", failed: "", expired: "" },
    kinds: { total: words.total, customer: "", deliver: words.deliver, openConnections: "" },
})

/**
 * What the `order.summary` view is given to draw the body of an order inside a thread line: the labels of the total and the delivery
 * row and the registry's own views; the record is the empty envelope the body never reads.
 */
const previewContextOf = (words: ContactHistoryOrderWords): PreviewContext => ({
    record: {
        id: "",
        kind: "order.summary",
        intent: "notify",
        agent: "",
        to: "",
        at: "",
        level: "",
        title: "",
        summary: "",
        payload: {},
        options: [],
        why: [],
        detailHref: "",
        note: "",
    },
    words: wordsOf(words),
    views: agentMessageViews,
})

/** The kind the sales flow registers for an order notice; its view draws the body of an order everywhere in the app. */
const ORDER_KIND = "order.summary"

/**
 * The order card of a line's `orderJson` (the sender's `LineOrder` snapshot): its number, whether it was paid, and the body the registered
 * `order.summary` view draws (the same body as the workbench thread's order card and the team chat's order notice). Null when the text is
 * no order, so the line shows its words alone. Read only: nothing here pays or confirms.
 */
export const orderViewOf = (orderJson: string | null, words: ContactHistoryOrderWords): ContactHistoryOrderView | null => {
    const order = lineOrderOf(orderJson)
    if (order === null) return null
    const view = agentMessageViews.find((entry) => entry.kind.id === ORDER_KIND)
    return {
        orderNo: order.orderNo,
        status: { label: order.paid ? words.paid : words.pending, isPaid: order.paid },
        body:
            view === undefined
                ? null
                : view.preview(
                      {
                          orderNo: order.orderNo,
                          lines: order.lines,
                          amountText: order.amountText,
                          customer: "",
                          address: order.address,
                      },
                      previewContextOf(words),
                  ),
    }
}
