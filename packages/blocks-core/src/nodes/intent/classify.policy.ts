import { wordListOf } from "../../messages/catalog"
import type { WordKey } from "../../messages/catalog"
import type {
    AttachmentSlot,
    ClassifyInput,
    ClassifyOutput,
    DeliveryPlace,
    Intent,
    ModelClaim,
    ModelOrder,
    ModelReply,
    OrderLine,
    OrderSlot,
    PaymentClaimSlot,
    TriggerFile,
} from "./classify.types"

const NAME_MAX = 200
const ADDRESS_MAX = 500
const QUANTITY_MAX = 10_000
const THOUSAND = 1000
const MILLION = 1_000_000

const alternation = (key: WordKey): string => wordListOf(key).join("|")

/** A number and a unit word: thousands (`5k`) or millions (`1,5tr`), written with or without accents. */
const WITH_UNIT = new RegExp(
    String.raw`^\d+(?:[.,]\d+)?\s*(?:${alternation("unitThousand")}|${alternation("unitMillion")})$`,
    "u",
)
const CURRENCY_TAIL = new RegExp(String.raw`(?:${alternation("currencyTail")})\s*$`, "u")
const MILLION_UNIT = new RegExp(`(?:${alternation("unitMillion")})$`, "u")

/** The pending messages of a batch: one per non-blank line. */
export const messagesOf = (text: string): ReadonlyArray<string> => text.split("\n").filter((line) => line.trim() !== "")

const textOrNull = (value: string | null | undefined, max: number): string | null => {
    const text = value?.trim().slice(0, max) ?? ""
    return text === "" ? null : text
}

/** An amount of VND from what the customer wrote (thousands as `5k`, a dotted `5.000`, millions as `1,5tr`, a plain 5000); null when it is no positive amount. */
export const vndOf = (value: number | string | null | undefined): number | null => {
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

/** The names under which a model may put the delivery address when it does not use `address`. */
const ADDRESS_ALIASES: ReadonlyArray<string> = [
    "delivery_address",
    "shipping_address",
    "deliveryAddress",
    "shippingAddress",
    "address_line",
    "dia_chi",
    "location",
]

/** The address the model gave: `address`, else the first alias that holds text. */
const addressOf = (order: ModelOrder): string | null => {
    const given = [order.address, ...ADDRESS_ALIASES.map((name) => order[name])]
    const found = given.map((value) => textOrNull(typeof value === "string" ? value : null, ADDRESS_MAX))
    return found.find((address) => address !== null) ?? null
}

const DELIVERY_WORD = "giao"
const LETTER_OR_DIGIT = /[\p{L}\p{N}]/u

/** Where the first delivery word starts in a line, or -1; a word that continues a longer one ("tragiao") does not count. */
const deliveryWordAt = (line: string): number => {
    const lower = line.toLowerCase()
    for (let from = lower.indexOf(DELIVERY_WORD); from !== -1; from = lower.indexOf(DELIVERY_WORD, from + 1)) {
        const before = Array.from(line.slice(0, from)).at(-1)
        if (before === undefined || !LETTER_OR_DIGIT.test(before)) return from
    }
    return -1
}
const HAS_DIGIT = /\d/u
const TRAILING_MARKS = ".,;!"

/** The text without the spaces and punctuation marks that end it. */
const withoutTrailingMarks = (text: string): string => {
    let end = text.length
    while (end > 0 && (TRAILING_MARKS.includes(text.charAt(end - 1)) || text.charAt(end - 1).trim() === "")) end -= 1
    return text.slice(0, end)
}
const LEADING_SEPARATOR = /^[:-]/u

const GOODS_WORDS = wordListOf("deliverGoodsWords")
const PLACE_WORDS = wordListOf("deliverToWords")
const ADDRESS_WORDS = wordListOf("deliverAddressWords")

/** What is left of a text after one word of a list (written with or without accents, any case) once some space has passed; a space inside the word stands for any run of spaces. Null when no word leads the text. */
const afterLeadingWord = (text: string, words: ReadonlyArray<string>): string | null => {
    if (text.trimStart().length === text.length) return null
    for (const word of words) {
        let rest = text
        const parts = word.split(" ")
        const matched = parts.every((part) => {
            rest = rest.trimStart()
            if (!rest.toLowerCase().startsWith(part.toLowerCase())) return false
            rest = rest.slice(part.length)
            return true
        })
        if (matched) return rest
    }
    return null
}

/** The place written after a delivery word ("giao", then the goods or the place word, then the address word when the customer says it), and whether the customer named it an address. */
const deliveryPlaceOf = (line: string): DeliveryPlace | null => {
    const start = deliveryWordAt(line)
    if (start === -1) return null
    const afterDelivery = line.slice(start + DELIVERY_WORD.length)
    const afterGoods = afterLeadingWord(afterDelivery, GOODS_WORDS) ?? afterDelivery
    const afterPlaceWord = afterLeadingWord(afterGoods, PLACE_WORDS) ?? afterGoods
    const afterAddressWord = afterLeadingWord(afterPlaceWord, ADDRESS_WORDS)
    const trimmed = (afterAddressWord ?? afterPlaceWord).trimStart()
    const place = trimmed.replace(LEADING_SEPARATOR, "").trimStart()
    return place === "" ? null : { place, named: afterAddressWord !== null }
}

/**
 * The delivery address written in the words of the customer, for when the model left it out: what follows a delivery word ("giao 25 Nguyen Hue",
 * "giao toi dia chi 69 Hang Xanh", with their accents). The place counts when the customer said the address word or when it holds a number, so a
 * remark such as "giao hang nhanh nhe" is no address.
 */
export const addressInWords = (text: string): string | null => {
    for (const line of messagesOf(text.normalize("NFC"))) {
        const found = deliveryPlaceOf(line)
        const place = withoutTrailingMarks(found?.place ?? "").slice(0, ADDRESS_MAX)
        if (found !== null && place !== "" && (found.named || HAS_DIGIT.test(place))) return place
    }
    return null
}

const orderOf = (order: ModelOrder): OrderSlot => ({
    items: order.items.flatMap(lineOf),
    address: addressOf(order),
    customer: textOrNull(order.customer, NAME_MAX),
})

/** The order slot with the address the customer wrote filled in when the model had none; an order the model named but gave no slot for becomes a slot with the address alone. */
const orderWithAddress = (order: OrderSlot | null, listed: ReadonlyArray<Intent>, text: string): OrderSlot | null => {
    const written = addressInWords(text)
    if (order === null)
        return listed.includes("order") && written !== null ? { items: [], address: written, customer: null } : null
    return order.address === null ? { ...order, address: written } : order
}

const claimOf = (claim: ModelClaim): PaymentClaimSlot => ({
    amountVnd: vndOf(claim.amount_vnd),
    payerName: textOrNull(claim.payer_name, NAME_MAX),
})

/** The intents the model listed plus the ones its slots imply, each once; `other` stands only when nothing else does. */
const intentsOf = (
    listed: ReadonlyArray<Intent>,
    order: OrderSlot | null,
    claim: PaymentClaimSlot | null,
    attachment: AttachmentSlot | null,
): ReadonlyArray<Intent> => {
    const slots = [
        ["order", order],
        ["payment_claim", claim],
        ["attachment", attachment],
    ] as const
    const implied = slots.filter(([, slot]) => slot !== null).map(([intent]) => intent)
    const raised = [...new Set([...listed, ...implied])].filter((intent) => intent !== "other")
    return raised.length === 0 ? ["other"] : raised
}

/** The most pictures the model is shown in one call. */
export const IMAGES_SHOWN_MAX = 4

/** The pictures the customer sent in the burst, in the order of the messages. */
export const imagesOf = (messages: ClassifyInput["messages"]): ReadonlyArray<TriggerFile> =>
    (messages ?? []).flatMap((message) => message.attachments).filter((file) => file.contentType.startsWith("image/"))

/**
 * The classification the model reply comes to for a burst with `imageCount` pictures: slots cleaned (what the customer did not say is
 * null), a receipt picture is a payment claim, any other picture, and one the model gave no kind for, is an `attachment`, so a burst of
 * a picture alone is never `other`.
 */
export const classificationOf = (reply: ModelReply, imageCount: number, text: string): ClassifyOutput => {
    const kinds = Array.from({ length: imageCount }, (_, index) => reply.images[index] ?? "unreadable")
    const receipts = kinds.filter((kind) => kind === "payment_receipt").length
    const others = kinds.filter((kind) => kind !== "payment_receipt")
    const order = orderWithAddress(reply.order == null ? null : orderOf(reply.order), reply.intents, text)
    const stated = reply.payment_claim == null ? null : claimOf(reply.payment_claim)
    const paymentClaim = stated ?? (receipts > 0 ? { amountVnd: null, payerName: null } : null)
    const attachment =
        others.length === 0 ? null : { count: others.length, understood: others.every((kind) => kind === "other") }
    return { intents: intentsOf(reply.intents, order, paymentClaim, attachment), order, paymentClaim, attachment }
}
