import type { WorkItem } from "@modules/domain/decisions"
import type { ChatMatch, OptionalChatVerdict, WaitingView } from "./flow-engine.contracts"

/** "@nivo" anywhere in the message: the owner addresses NIVO itself. */
const ADDRESSED = /@nivo\b/i

/** "@nivo", "@nivo:" or "@nivo," as it is stripped from the message body. */
const ADDRESS_TOKEN = /@nivo\b[:,]?/gi

/** Another handle ("@sales"): the message is for an agent. */
const OTHER_HANDLE = /@[a-z0-9-]+/i

const REJECT_RE = /^(tu choi|khong duyet|khong dong y|khong chap nhan|reject|decline|no\b|huy|bo qua)/
const APPROVE_RE = /^(dong y|duyet|approve|chap nhan|tiep tuc|cu lam)/
/** Casual words count as approval only when NIVO is addressed ("@nivo ok"). */
const APPROVE_WEAK_RE = /^(ok\b|oke|okay|yes\b|go ahead|lam di)/

const HONORIFIC = /^(anh|chi|em|co|chu|ong|ba|bac|di|thay|mr|mrs|ms)\s+/
const HONOR_WORDS = new Set([
    "anh",
    "chi",
    "em",
    "co",
    "chu",
    "ong",
    "ba",
    "bac",
    "di",
    "thay",
    "mr",
    "mrs",
    "ms",
    "khach",
    "hang",
])
/** "chi Lan", "anh Tuan", "khach (hang) Hung" (folded): the word after the cue names a person. */
const PERSON_CUE = /(?:^|[^a-z])(?:anh|chi|co|chu|ong|ba|bac|khach(?: hang)?)\s+([a-z]+)/g
/** Words after a cue (or capitalised mid-sentence) that are not names. */
const NOT_NAME = new Set([
    "ay",
    "nay",
    "do",
    "kia",
    "hang",
    "oi",
    "nhe",
    "nha",
    "a",
    "ha",
    "la",
    "da",
    "cua",
    "voi",
    "va",
    "thi",
    "duyet",
    "dong",
    "tu",
    "ok",
    "oke",
    "yes",
    "no",
    "don",
    "hoa",
    "bao",
    "gia",
    "cam",
    "on",
    "i",
    "the",
    "order",
    "invoice",
    "approve",
    "reject",
    "vnd",
])
/** Order, invoice or bank references typed by the owner: "FB-1234", "INV-202609-0001", "DH123". */
const REF_RE = /[a-z]{1,6}-?\d{3,}(?:-\d+)*/gi
/** One word of the original message, with the sentence break before it when there is one. */
const WORD_RE = /([.!?:;]\s*)?([\p{L}\p{N}-]+)/gu

/** The kind of work a message names, by its words. */
const ACTION_HINTS: ReadonlyArray<readonly [RegExp, string]> = [
    [/hoa don|invoice/, "issue_invoice"],
    [/thanh toan|chuyen khoan|doi soat|payment|reconcile/, "reconcile_payment"],
    [/bao gia|quote/, "send_quote"],
    [/(?:^|[^a-z])don(?:$|[^a-z])|order/, "confirm_order"],
    [/follow|theo doi|nhan lai/, "send_follow_up"],
    [/tra loi|answer|reply/, "reply_customer"],
    [/cham soc|care/, "send_care"],
    [/phan loai|classify/, "classify_lead"],
]

/** Lower case, no accents, the barred d as "d", single spaces. */
export const fold = (text: string): string =>
    text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\u0111/g, "d")
        .replace(/\s+/g, " ")
        .trim()

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`)

/** Whole-word containment on folded text ("minh" is in "don cua anh minh", not in "minhanh"). */
export const hasWord = (hay: string, needle: string): boolean =>
    needle.length >= 2 && new RegExp(`(?:^|[^a-z0-9])${escapeRegExp(needle)}(?:$|[^a-z0-9])`).test(hay)

/** Whether the message addresses NIVO. */
export const isAddressed = (text: string): boolean => ADDRESSED.test(text)

/** The message without the "@nivo" address. */
export const withoutAddress = (text: string): string => text.replace(ADDRESS_TOKEN, "").trim()

/** Whether the message names another agent's handle. */
export const namesOtherHandle = (body: string): boolean => OTHER_HANDLE.test(body)

/** What the message decides on waiting work, or null when it decides nothing. */
export const verdictOf = (body: string, addressed: boolean): OptionalChatVerdict => {
    const folded = fold(body)
    if (REJECT_RE.test(folded)) return "rejected"
    if (APPROVE_RE.test(folded) || (addressed && APPROVE_WEAK_RE.test(folded))) return "approved"
    return null
}

/** "45 trieu", "45tr", "3,5 trieu", "45.000.000", "3000000 vnd" as VND; null when the text names no amount. */
export const parseVnd = (text: string): number | null => {
    const folded = fold(text)
    const millions = /(\d+(?:[.,]\d+)?)\s*(trieu|tr\b|m\b|million)/.exec(folded)
    if (millions?.[1] !== undefined) return Math.round(Number(millions[1].replace(",", ".")) * 1_000_000)
    const plain = /(\d{1,3}(?:[.,]\d{3})+|\d{5,})/.exec(folded)
    if (plain?.[1] !== undefined) return Number(plain[1].replace(/[.,]/g, ""))
    return null
}

const textField = (item: WorkItem, key: string): string => {
    const value = item.proposal.fields[key]
    return typeof value === "string" ? value : ""
}

/** The customer of a waiting item: the lead's name, else the customer or payer the proposal names. */
export const waitingCustomerOf = (item: WorkItem, leadName: string): string =>
    (leadName || textField(item, "customer") || textField(item, "payer")).trim()

/** The order, invoice or bank reference of a waiting item, or blank. */
export const refOf = (item: WorkItem): string =>
    ["order_no", "reference", "invoice_no"].map((key) => textField(item, key).trim()).find((ref) => ref.length >= 3) ??
    ""

/** The money of a waiting item, VND, or null. */
export const amountOf = (item: WorkItem): number | null => {
    const value = item.proposal.amount_vnd ?? item.proposal.fields.amount_vnd
    return typeof value === "number" && Number.isFinite(value) ? value : null
}

/** The waiting items whose customer the message names, with the name that matched. */
const nameHitsOf = (folded: string, waiting: ReadonlyArray<WaitingView>): Map<string, string> => {
    const hits = new Map<string, string>()
    for (const view of waiting) {
        const full = fold(view.customer)
        if (full === "") continue
        const short = full.replace(HONORIFIC, "")
        const hit = [full, short].filter((name) => hasWord(folded, name)).sort((a, b) => b.length - a.length)[0]
        if (hit !== undefined) hits.set(view.item.id, hit)
    }
    // "Minh Anh" named: the item of plain "Minh" is not meant too.
    const names = [...hits.values()]
    for (const [id, name] of [...hits])
        if (names.some((other) => other !== name && other.includes(name))) hits.delete(id)
    return hits
}

/** The people the owner names ("chi Lan", "Anh Tuan", "khach Hung", a capitalised word mid-sentence). */
const mentionsOf = (text: string, folded: string): Set<string> => {
    const mentions = new Set<string>()
    for (const match of folded.matchAll(PERSON_CUE)) {
        const word = match[1] ?? ""
        if (word.length >= 2 && !NOT_NAME.has(word) && !HONOR_WORDS.has(word)) mentions.add(word)
    }
    let first = true
    for (const match of text.matchAll(WORD_RE)) {
        const word = match[2] ?? ""
        const isStart = first || match[1] !== undefined
        first = false
        if (isStart || /\d/.test(word) || !/^\p{Lu}/u.test(word)) continue
        const name = fold(word)
        if (name.length >= 2 && !NOT_NAME.has(name) && !HONOR_WORDS.has(name) && name !== "nivo") mentions.add(name)
    }
    return mentions
}

/**
 * The waiting items a typed decision may apply to. Every clue named in the text (customer, people, reference, amount, kind of
 * work) is a hard filter; an amount matches the item's amount, or fills a missing amount on an item already identified (or the
 * only one waiting).
 */
export const matchWaiting = (text: string, waiting: ReadonlyArray<WaitingView>): ChatMatch => {
    const folded = fold(text)
    const nameHits = nameHitsOf(folded, waiting)
    const mentions = mentionsOf(text, folded)
    const refTokens = [...folded.matchAll(REF_RE)].map((match) => match[0].replace(/-/g, ""))
    const refHit = (view: WaitingView): boolean => {
        const ref = fold(view.ref)
        return ref !== "" && (refTokens.includes(ref.replace(/-/g, "")) || hasWord(folded, ref))
    }
    const refNamed = refTokens.length > 0 || waiting.some(refHit)
    const amount = parseVnd(text.replace(REF_RE, " "))
    const action = ACTION_HINTS.find(([pattern]) => pattern.test(folded))?.[1] ?? null
    const identified = nameHits.size > 0 || refNamed
    let pool = waiting
    if (nameHits.size > 0) pool = pool.filter((view) => nameHits.has(view.item.id))
    if (mentions.size > 0)
        pool = pool.filter((view) => [...mentions].every((name) => hasWord(fold(view.customer), name)))
    if (refNamed) pool = pool.filter(refHit)
    if (amount !== null)
        pool = pool.filter(
            (view) =>
                view.amount === amount ||
                (view.item.missing_fields.includes("amount_vnd") && (identified || waiting.length === 1)),
        )
    if (action !== null) pool = pool.filter((view) => view.item.action === action)
    return { pool, amount, clues: identified || mentions.size > 0 || amount !== null || action !== null }
}
