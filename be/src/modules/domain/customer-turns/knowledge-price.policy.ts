/** A number ends where no letter or digit follows. */
const NOT_LETTER = String.raw`(?![\p{L}\p{N}])`
/** A number with an optional decimal part, then the unit word. */
const AMOUNT = String.raw`(\d+(?:[.,]\d+)?)\s*`
/** "trieu" (million) with or without its accent, or "tr". */
const MILLION_WORDS = String.raw`(?:tri\u1ec7u|trieu|tr)`
/** "nghin" / "ngan" (thousand) with or without accents, or "k". */
const THOUSAND_WORDS = String.raw`(?:k|ngh\u00ecn|ng\u00e0n|nghin|ngan)`
const MILLION = new RegExp(`${AMOUNT}${MILLION_WORDS}${NOT_LETTER}`, "gu")
const THOUSAND = new RegExp(`${AMOUNT}${THOUSAND_WORDS}${NOT_LETTER}`, "gu")
const PLAIN = /\d{1,3}(?:[.,]\d{3})+(?!\d)|\d{4,}/gu
/** Plain numbers below this are not amounts (session counts, small quantities). */
const PLAIN_MIN = 1000

const scaled = (text: string, pattern: RegExp, factor: number): ReadonlyArray<number> =>
    [...text.matchAll(pattern)]
        .map((match) => Math.round(Number(String(match[1]).replace(",", ".")) * factor))
        .filter((value) => Number.isFinite(value) && value > 0)

/**
 * Every money amount written in the owner's business knowledge, in VND: "5.000.000 dong", "5,000,000", "5000000", "5 trieu" (million),
 * "1,5tr", "500k", "500 nghin" (thousand), with or without accents. Plain numbers below 1.000 are not amounts.
 */
export const pricesInKnowledge = (knowledge: string | null): ReadonlyArray<number> => {
    const text = (knowledge ?? "").normalize("NFC").toLowerCase()
    const plain = [...text.matchAll(PLAIN)]
        .map((match) => Number(match[0].replace(/[.,]/gu, "")))
        .filter((value) => Number.isFinite(value) && value >= PLAIN_MIN)
    return [...new Set([...scaled(text, MILLION, 1_000_000), ...scaled(text, THOUSAND, 1000), ...plain])]
}

/** True when this exact amount is a price the owner wrote in the knowledge: the chatbot never takes an order at an invented price. */
export const isKnownPrice = (knowledge: string | null, amount: number): boolean =>
    Number.isFinite(amount) && amount > 0 && pricesInKnowledge(knowledge).includes(Math.round(amount))
