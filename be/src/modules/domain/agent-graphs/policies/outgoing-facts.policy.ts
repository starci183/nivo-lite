import type { FactValues } from "../agent-graphs.contracts"

/** The fact keys read from the text that leaves. */
export const OUTGOING_AMOUNT = "outgoing.amount_vnd"
export const OUTGOING_HAS_AMOUNT = "outgoing.has_amount"
export const OUTGOING_HAS_LINK = "outgoing.has_link"
export const OUTGOING_HAS_PHONE = "outgoing.has_phone"
export const OUTGOING_LENGTH = "outgoing.length"
export const OUTGOING_SAYS_RECEIVED = "outgoing.says_received"

/** A run of digits with its grouping marks. */
const FIGURE = /\d[\d.,]*/gu

/** The unit right after a figure, and the digit of "5tr5" after the unit; the text is already plain, so there are no accents to spell. */
const UNIT = /^\s?(?:ty|trieu|tr|nghin|ngan|k|dong|vnd|d|₫)(\d?)(?![\p{L}\p{N}])/u

/** A figure grouped in thousands, "5.000.000"; one that starts with 0 is a phone or a code, not a sum. */
const GROUPED = /^[1-9]\d{0,2}(?:[.,]\d{3})+$/u

const DECIMAL = /^\d+[.,]\d{1,2}$/u

const LINK = /https?:\/\/\S+|www\.\S+|\b[\p{L}\d-]+\.(?:com|vn|net|org|io|me)\b/iu

/** A Vietnamese mobile or landline number, with or without separators or the country code. */
const PHONE = /(?<!\d)(?:\+?84|0)(?:[\s.-]?\d){8,10}(?!\d)/u

/** Words that tell a customer the money arrived, in plain text. A graph may branch on them; whether it did is the `money.*` facts' to say. */
const SAYS_RECEIVED: ReadonlyArray<string> = [
    "da nhan tien",
    "da nhan duoc tien",
    "da nhan thanh toan",
    "da nhan duoc thanh toan",
    "da nhan chuyen khoan",
    "da nhan duoc chuyen khoan",
    "da nhan khoan",
    "thanh toan thanh cong",
    "da thanh toan du",
    "payment received",
    "payment was received",
    "payment has been received",
    "received your payment",
]

/** The barred d in both cases, which no accent stripping removes. */
const BARRED_D = new RegExp(`[${String.fromCodePoint(0x1_10, 0x1_11)}]`, "gu")

const MILLION = 1_000_000
const BILLION = 1_000_000_000

/** What one unit is worth in dong. */
const WORTH: Readonly<Record<string, number>> = {
    ty: BILLION,
    trieu: MILLION,
    tr: MILLION,
    nghin: 1000,
    ngan: 1000,
    k: 1000,
}

/** The text lower-cased with its accents gone, so a rule reads the same with or without them. */
export const plainOf = (text: string): string =>
    text
        .normalize("NFD")
        .replaceAll(/\p{Diacritic}/gu, "")
        .replaceAll(BARRED_D, "d")
        .toLowerCase()

const withoutTail = (figure: string): string =>
    figure.endsWith(".") || figure.endsWith(",") ? figure.slice(0, -1) : figure

/** The number a figure stands for: marks that group in thousands are dropped, and a last one before one or two digits is a decimal mark. */
const numberOf = (figure: string): number =>
    Number(DECIMAL.test(figure) ? figure.replace(",", ".") : figure.replaceAll(/[.,]/gu, ""))

const sumOf = (figure: string, after: string): ReadonlyArray<number> => {
    const unit = UNIT.exec(after)
    if (unit === null) return GROUPED.test(figure) ? [numberOf(figure)] : []
    const worth = WORTH[unit[0].trim().replace(/\d$/u, "")] ?? 1
    const tenths = (Number(unit[1]) * worth) / 10
    const value = numberOf(figure) * worth + tenths
    return Number.isFinite(value) ? [Math.round(value)] : []
}

/** The sums the text states, in dong: figures with a money unit, and bare figures grouped in thousands. */
export const amountsOf = (text: string): ReadonlyArray<number> => {
    const plain = plainOf(text)
    return [...plain.matchAll(FIGURE)].flatMap((match) => {
        const figure = withoutTail(match[0])
        return sumOf(figure, plain.slice(match.index + figure.length))
    })
}

/**
 * What a text says that a backend can read for itself, with no model: the largest sum it states (0 when it states none, which is a
 * reading and not a gap), whether it holds a link or a phone number, whether it tells the customer money arrived, and how long it is. A
 * blank text states nothing and answers nothing, so a condition on it falls to the `else`. Meaning is out of reach here on purpose
 * (section 15.14): the phrases are a fixed list, so a paraphrase is not seen.
 */
export const outgoingFactsOf = (text: string | null | undefined): FactValues => {
    if (text === null || text === undefined || text.trim() === "") return {}
    const amounts = amountsOf(text)
    const plain = plainOf(text)
    return {
        [OUTGOING_AMOUNT]: Math.max(0, ...amounts),
        [OUTGOING_HAS_AMOUNT]: amounts.length > 0,
        [OUTGOING_HAS_LINK]: LINK.test(text),
        [OUTGOING_HAS_PHONE]: PHONE.test(text),
        [OUTGOING_LENGTH]: text.length,
        [OUTGOING_SAYS_RECEIVED]: SAYS_RECEIVED.some((phrase) => plain.includes(phrase)),
    }
}
