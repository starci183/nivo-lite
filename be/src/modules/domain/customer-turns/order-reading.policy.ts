import type { CapturedOrder, CustomerReply } from "./customer-turns.contracts"

/** One priced item the owner wrote in the business knowledge: its name as written and its unit price in VND. */
export interface PricedItem {
    /** The name as the owner wrote it (its own spelling, hyphens kept). */
    readonly name: string
    /** The unit price, whole VND. */
    readonly priceVnd: number
}

/** A price as it stands in the text: where it starts and ends, and its value in VND. */
interface PriceMark {
    readonly start: number
    readonly end: number
    readonly value: number
}

/** A number is free-standing: no letter, digit, hyphen or underscore is glued to it (a code like `ab-2026-x` holds no price). */
const FREE_BEFORE = String.raw`(?<![\p{L}\p{N}_\-])`
const FREE_AFTER = String.raw`(?![\p{L}\p{N}_\-])`
const AMOUNT = String.raw`(\d+(?:[.,]\d+)?)\s*`
const MILLION = new RegExp(`${FREE_BEFORE}${AMOUNT}(?:tri\u1ec7u|trieu|tr)(?![\\p{L}\\p{N}])`, "gu")
const THOUSAND = new RegExp(`${FREE_BEFORE}${AMOUNT}(?:k|ngh\u00ecn|ng\u00e0n|nghin|ngan)(?![\\p{L}\\p{N}])`, "gu")
const PLAIN = new RegExp(`${FREE_BEFORE}(\\d{1,3}(?:[.,]\\d{3})+|\\d{4,})${FREE_AFTER}`, "gu")
/** Plain numbers below this are not prices (counts, small quantities). */
const PLAIN_MIN = 1000

/** Where the clause of a name starts: a line, a semicolon, or a comma or full stop that is not inside a number. */
const CLAUSE_BREAK = /[\n;]|[,.](?!\d)/gu
/** The words that stand between a name and its price (the Vietnamese "price", "all-in price", "is", and English "costs"), cut from the end of a name. */
const PRICE_LEAD =
    /(?:^|\s)(?:c\u00f3 gi\u00e1|gi\u00e1 tr\u1ecdn g\u00f3i|tr\u1ecdn g\u00f3i|gi\u00e1|l\u00e0|ch\u1ec9|price|costs?|at|for)$/iu
/** A name that ends in a comparison word ("from", "over", "under" and their Vietnamese words) is a threshold, not an item. */
const THRESHOLD_END =
    /(?:^|\s)(?:t\u1eeb|tr\u00ean|d\u01b0\u1edbi|\u0111\u1ebfn|h\u01a1n|kho\u1ea3ng|t\u1ed1i \u0111a|t\u1ed1i thi\u1ec3u|from|over|under|above|below)$/iu
/** List marks, separators and spaces that are never at the edge of a name. */
const EDGE_MARKS: ReadonlySet<string> = new Set([" ", "\t", "\n", "-", "*", "\u2022", "+", ":", "="])
/** A name is at least this long, so a stray letter never reads as an item. */
const NAME_MIN = 3

/** The buying verbs (Vietnamese "order", "buy", "take", "close", and English "order", "buy"). */
const BUY_WORDS: ReadonlySet<string> = new Set(["\u0111\u1eb7t", "mua", "l\u1ea5y", "ch\u1ed1t", "order", "buy"])
/** The words that refuse the verb after them ("not", "not yet"), and the words that may stand between ("want", "need", "want to"). */
const NOT_WORDS: ReadonlySet<string | undefined> = new Set(["kh\u00f4ng", "ch\u01b0a", "ko", "not", "don't"])
const WANT_WORDS: ReadonlySet<string | undefined> = new Set(["mu\u1ed1n", "c\u1ea7n", "want", "to"])
/** The end of a clause in the customer's message: a sentence mark, or a comma or full stop that is not inside a number. */
const CLAUSE_END = /[!?;\n]|[,.](?!\d)/gu
/** A quantity the customer wrote right before an item: a free-standing whole number of up to three digits. */
const QUANTITY = /(?<![\p{L}\p{N}.,])(\d{1,3})(?![\p{L}\p{N}]|[.,]\d)/gu
const ITEMS_MAX = 600

/** Folds a text for matching: Unicode form, case, and hyphens, underscores and slashes as spaces. */
const foldOf = (text: string): string =>
    text
        .normalize("NFC")
        .toLowerCase()
        .replace(/[-_/]+/gu, " ")
        .replace(/\s+/gu, " ")

const marksOf = (text: string, pattern: RegExp, read: (raw: string) => number): ReadonlyArray<PriceMark> =>
    [...text.matchAll(pattern)].flatMap((match) => {
        const value = read(String(match[1]))
        return Number.isFinite(value) && value > 0
            ? [{ start: match.index, end: match.index + match[0].length, value }]
            : []
    })

const scaledBy =
    (factor: number) =>
    (raw: string): number =>
        Math.round(Number(raw.replace(",", ".")) * factor)

const plainOf = (raw: string): number => {
    const value = Number(raw.replace(/[.,]/gu, ""))
    return value >= PLAIN_MIN ? value : Number.NaN
}

/** Every price mark of the text, in order, a mark inside an earlier one left out. */
const priceMarksOf = (text: string): ReadonlyArray<PriceMark> => {
    const marks = [
        ...marksOf(text, MILLION, scaledBy(1_000_000)),
        ...marksOf(text, THOUSAND, scaledBy(1000)),
        ...marksOf(text, PLAIN, plainOf),
    ].toSorted((a, b) => a.start - b.start)
    return marks.filter((mark, index) => marks.slice(0, index).every((earlier) => earlier.end <= mark.start))
}

/** The text without the list marks, separators and spaces at its two ends. */
const trimMarks = (text: string): string => {
    let start = 0
    let end = text.length
    while (start < end && EDGE_MARKS.has(text.charAt(start))) start += 1
    while (end > start && EDGE_MARKS.has(text.charAt(end - 1))) end -= 1
    return text.slice(start, end)
}

/** The words of a folded message, each without the marks around it. */
const wordsOf = (folded: string): ReadonlyArray<string> =>
    folded
        .split(" ")
        .map((word) => word.replace(/[^\p{L}\p{N}']/gu, ""))
        .filter((word) => word !== "")

/** True when the buying verb at this word is refused: "not" before it, with "want" or "need" allowed between. */
const isRefusedAt = (words: ReadonlyArray<string>, at: number): boolean => {
    let before = at - 1
    while (before >= 0 && WANT_WORDS.has(words[before])) before -= 1
    return before >= 0 && NOT_WORDS.has(words[before])
}

/** A clear purchase: a buying verb, and none of the buying verbs refused. */
const isPurchase = (folded: string): boolean => {
    const words = wordsOf(folded)
    const verbs = words.flatMap((word, index) => (BUY_WORDS.has(word) ? [index] : []))
    return verbs.length > 0 && verbs.every((index) => !isRefusedAt(words, index))
}

/** The name written right before a price: the end of its clause, after a colon, without the words that lead to the price. */
export const nameBefore = (text: string): string => {
    const breaks = [...text.matchAll(CLAUSE_BREAK)]
    const clause = text.slice((breaks.at(-1)?.index ?? -1) + 1)
    const colon = clause.lastIndexOf(":")
    const afterColon = colon < 0 ? clause : clause.slice(colon + 1)
    const named = afterColon.trim() === "" ? clause.slice(0, colon) : afterColon
    let name = trimMarks(named)
    for (let lead = PRICE_LEAD.exec(name); lead !== null; lead = PRICE_LEAD.exec(name)) {
        name = trimMarks(name.slice(0, lead.index))
    }
    return name.length < NAME_MIN || THRESHOLD_END.test(name) ? "" : name
}

/**
 * The priced items of the business knowledge: each price the owner wrote with the name right before it ("small basket 3.500.000 dong",
 * "Price: small basket 3,5 million", "sku-1: 500k"). A threshold ("orders from 5.000.000") and a number glued to a code are not items.
 */
export const pricedItemsOf = (knowledge: string | null): ReadonlyArray<PricedItem> => {
    const text = (knowledge ?? "").normalize("NFC")
    let from = 0
    return priceMarksOf(text).flatMap((mark) => {
        const name = nameBefore(text.slice(from, mark.start))
        from = mark.end
        return name === "" ? [] : [{ name, priceVnd: mark.value }]
    })
}

/** The items whose name has one price only: a name written at two prices is not something a customer can order unasked. */
const unambiguousOf = (items: ReadonlyArray<PricedItem>): ReadonlyArray<PricedItem> =>
    items.filter(
        (item, index) =>
            items.every((other) => foldOf(other.name) !== foldOf(item.name) || other.priceVnd === item.priceVnd) &&
            items.findIndex((other) => foldOf(other.name) === foldOf(item.name)) === index,
    )

const escaped = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`)

/** Where the folded name stands in the folded message as whole words, or -1. */
const placeOf = (message: string, name: string): number =>
    new RegExp(`(?<![\\p{L}\\p{N}])${escaped(foldOf(name).trim())}(?![\\p{L}\\p{N}])`, "u").exec(message)?.index ?? -1

/** The quantity written before the item in its own clause; one when none is written. */
const quantityBefore = (message: string, at: number): number => {
    const before = message.slice(0, at)
    const clause = before.slice(([...before.matchAll(CLAUSE_END)].at(-1)?.index ?? -1) + 1)
    const written = [...clause.matchAll(QUANTITY)].at(-1)
    return written === undefined ? 1 : Number(written[1])
}

/** One ordered line: the item as the owner wrote it, with its count when more than one. */
const lineOf = (quantity: number, name: string): string => (quantity === 1 ? name : `${quantity} \u00d7 ${name}`)

/**
 * The order a customer's message places, read from the message and the priced items of the knowledge alone, never from the model: a
 * buying verb, not refused, and one or more items the knowledge prices, each with the count written before it (one when none). The
 * total is the counts times the written prices. Null when the message buys nothing the knowledge prices; a name inside a longer name
 * that is also ordered is that longer item, not a second one.
 */
export const orderInMessage = (knowledge: string | null, message: string): CapturedOrder | null => {
    const folded = foldOf(message)
    if (!isPurchase(folded)) return null
    const found = unambiguousOf(pricedItemsOf(knowledge)).flatMap((item) => {
        const at = placeOf(folded, item.name)
        return at < 0 ? [] : [{ item, at }]
    })
    const ordered = found.filter(
        (entry) =>
            !found.some(
                (other) =>
                    other !== entry &&
                    foldOf(other.item.name).length > foldOf(entry.item.name).length &&
                    foldOf(other.item.name).includes(foldOf(entry.item.name).trim()),
            ),
    )
    const lines = ordered
        .toSorted((a, b) => a.at - b.at)
        .map((entry) => ({ ...entry, quantity: quantityBefore(folded, entry.at) }))
    if (lines.length === 0 || lines.some((line) => line.quantity < 1)) return null
    return {
        items: lines
            .map((line) => lineOf(line.quantity, line.item.name))
            .join(", ")
            .slice(0, ITEMS_MAX),
        amountVnd: lines.reduce((total, line) => total + line.quantity * line.item.priceVnd, 0),
    }
}

/**
 * The reply with the order the customer's message places, read from the message and the prices the owner wrote, never left to the
 * model: a clear purchase of a priced item is an order whatever the reply says. With no such purchase the reply's own order stands, and
 * the price rule of the turn still judges it. A payment claim places no order.
 */
export const withMessageOrder = (knowledge: string | null, message: string, reply: CustomerReply): CustomerReply => {
    if (reply.paymentClaim) return reply
    const read = orderInMessage(knowledge, message)
    return read === null ? reply : { ...reply, order: read }
}
