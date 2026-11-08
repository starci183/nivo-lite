import { wordListOf } from "../../messages/catalog"
import { plainOf } from "./claims.policy"

/** A number ends where no letter or digit follows. */
const NOT_LETTER = String.raw`(?![\p{L}\p{N}])`
/** A number with an optional decimal part, then the unit word. */
const AMOUNT = String.raw`(\d+(?:[.,]\d+)?)\s*`
const MILLION_WORDS = `(?:${wordListOf("unitMillion").join("|")})`
const THOUSAND_WORDS = `(?:${wordListOf("unitThousand").join("|")})`
const MILLION = new RegExp(`${AMOUNT}${MILLION_WORDS}${NOT_LETTER}`, "gu")
const THOUSAND = new RegExp(`${AMOUNT}${THOUSAND_WORDS}${NOT_LETTER}`, "gu")
const PLAIN = /\d{1,3}(?:[.,]\d{3})+(?!\d)|\d{4,}/gu
const PERCENT = /\d{1,12}(?:[.,]\d{1,12})?\s{0,8}%/gu
/** Plain numbers below this are not amounts (counts, small quantities). */
const PLAIN_MIN = 1000
const UNIT_THOUSAND = 1000
const UNIT_MILLION = 1_000_000
/** Words that make a percentage a discount. */
const DISCOUNT_WORDS: ReadonlyArray<string> = ["giam", "khuyen mai", "uu dai", "chiet khau", "discount", "sale"]

const scaled = (text: string, pattern: RegExp, factor: number): ReadonlyArray<number> =>
    [...text.matchAll(pattern)]
        .map((match) => Math.round(Number.parseFloat(match[0].replace(",", ".")) * factor))
        .filter((value) => Number.isFinite(value) && value > 0)

/** Every money amount written in a text, in VND: dotted (`5.000.000`), in millions (`1,5tr`) or in thousands (`500k`), with or without accents. */
export const amountsIn = (text: string): ReadonlyArray<number> => {
    const lower = text.normalize("NFC").toLowerCase()
    const plain = [...lower.matchAll(PLAIN)]
        .map((match) => Number(match[0].replaceAll(/[.,]/gu, "")))
        .filter((value) => value >= PLAIN_MIN)
    return [...new Set([...scaled(lower, MILLION, UNIT_MILLION), ...scaled(lower, THOUSAND, UNIT_THOUSAND), ...plain])]
}

const percentsIn = (text: string): ReadonlyArray<number> =>
    [...text.matchAll(PERCENT)].map((match) => Number.parseFloat(match[0].replace(",", ".")))

/** True when the reply names an amount, or a discount percentage, that the documents do not write: it is an invented figure. */
export const hasInventedFigure = (reply: string, documents: string): boolean => {
    const known = new Set(amountsIn(documents))
    if (amountsIn(reply).some((amount) => !known.has(amount))) return true
    const discounted = DISCOUNT_WORDS.some((word) => plainOf(reply).includes(word))
    const knownPercents = new Set(percentsIn(documents))
    return discounted && percentsIn(reply).some((percent) => !knownPercents.has(percent))
}
