import type {
    ClassifyOutput,
    Intent,
    ModelClaim,
    ModelOrder,
    ModelReply,
    OrderLine,
    OrderSlot,
    PaymentClaimSlot,
} from "./classify.types"

const NAME_MAX = 200
const ADDRESS_MAX = 500
const QUANTITY_MAX = 10_000
const THOUSAND = 1000
const MILLION = 1_000_000

/** "5k", "1,5tr", "2 triệu", "500 nghìn": a number and a unit word. */
const WITH_UNIT = /^\d+(?:[.,]\d+)?\s*(?:k|nghìn|ngàn|nghin|ngan|tr|triệu|trieu)$/u
const CURRENCY_TAIL = /(?:vnđ|vnd|đ)\s*$/u
const MILLION_UNIT = /(?:tr|triệu|trieu)$/u

const textOrNull = (value: string | null, max: number): string | null => {
    const text = value?.trim().slice(0, max) ?? ""
    return text === "" ? null : text
}

/** An amount of VND from what the customer wrote ("5k", "5.000đ", "1,5tr", 5000); null when it is no positive amount. */
export const vndOf = (value: number | string | null): number | null => {
    if (typeof value === "number") return Number.isFinite(value) && value >= 1 ? Math.round(value) : null
    const text = (value ?? "").toLowerCase().replace(CURRENCY_TAIL, "").trim()
    if (WITH_UNIT.test(text)) {
        const factor = MILLION_UNIT.test(text) ? MILLION : THOUSAND
        return vndOf(Math.round(Number.parseFloat(text.replace(",", ".")) * factor))
    }
    const digits = text.replaceAll(/[.,\s]/gu, "")
    return /^\d+$/u.test(digits) ? vndOf(Number(digits)) : null
}

const lineOf = (item: ModelOrder["items"][number]): ReadonlyArray<OrderLine> => {
    const name = textOrNull(item.name, NAME_MAX)
    const quantity = Math.min(Math.max(Math.round(item.quantity ?? 1), 1), QUANTITY_MAX)
    return name === null ? [] : [{ name, quantity, priceVnd: null }]
}

const orderOf = (order: ModelOrder): OrderSlot => ({
    items: order.items.flatMap(lineOf),
    address: textOrNull(order.address, ADDRESS_MAX),
    customer: textOrNull(order.customer, NAME_MAX),
})

const claimOf = (claim: ModelClaim): PaymentClaimSlot => ({
    amountVnd: vndOf(claim.amount_vnd),
    payerName: textOrNull(claim.payer_name, NAME_MAX),
})

/** The intents the model listed plus the ones its slots imply, each once; `other` stands only when nothing else does. */
const intentsOf = (
    listed: ReadonlyArray<Intent>,
    order: OrderSlot | null,
    claim: PaymentClaimSlot | null,
): ReadonlyArray<Intent> => {
    const implied: ReadonlyArray<Intent> = [
        order === null ? "other" : "order",
        claim === null ? "other" : "payment_claim",
    ]
    const raised = [...new Set([...listed, ...implied])].filter((intent) => intent !== "other")
    return raised.length === 0 ? ["other"] : raised
}

/** The classification the model's reply comes to: slots cleaned, intents reconciled with the slots. */
export const classificationOf = (reply: ModelReply): ClassifyOutput => {
    const order = reply.order === null ? null : orderOf(reply.order)
    const paymentClaim = reply.payment_claim === null ? null : claimOf(reply.payment_claim)
    return { intents: intentsOf(reply.intents, order, paymentClaim), order, paymentClaim }
}
