/** Locale tag of the number and money formats the business reads. */
const BUSINESS_LOCALE = "vi-VN"

/** The dong sign and the d-with-stroke letter, spelled by code point: a typed amount may end with either. */
const CURRENCY_MARKS = String.fromCodePoint(0x20ab, 0x111)

/** The tail of a typed number that is a currency mark: the dong sign, the letter d with or without a stroke. */
const CURRENCY_TAIL = new RegExp(`[${CURRENCY_MARKS}dD]$`, "u")

/** A dot-grouped thousands number such as 1.200.000. */
const DOT_THOUSANDS = /^\d{1,3}(\.\d{3})+$/u

/** A comma-grouped thousands number such as 1,200,000. */
const COMMA_THOUSANDS = /^\d{1,3}(,\d{3})+$/u

/** The letter d with a stroke, which accent stripping leaves alone. */
const D_WITH_STROKE = new RegExp(String.fromCodePoint(0x111), "giu")

/**
 * Reads a typed number: both "1,5" and "1.5" are 1.5, "1.200" and "1,200,000" are thousands groups, a trailing currency
 * mark is ignored; anything else answers the fallback.
 */
export const parseNumber = (value: unknown, fallback = 0): number => {
    if (typeof value === "number") return Number.isFinite(value) ? value : fallback
    if (typeof value !== "string") return fallback
    const compact = value.trim().replace(/\s/gu, "").replace(CURRENCY_TAIL, "")
    if (compact === "") return fallback
    const grouped = DOT_THOUSANDS.test(compact) || COMMA_THOUSANDS.test(compact)
    const parsed = Number(grouped ? compact.replace(/[.,]/gu, "") : compact.replace(",", "."))
    return Number.isFinite(parsed) ? parsed : fallback
}

/** Reads a number a database column answered: numeric columns arrive as exact decimal text such as "5.000", never as a typed amount. */
export const columnNumber = (value: unknown): number => Number(value) || 0

/** A quantity as the business reads it: grouped, at most three decimals. */
export const formatQty = (quantity: number): string =>
    new Intl.NumberFormat(BUSINESS_LOCALE, { maximumFractionDigits: 3 }).format(quantity)

/** An amount of money in dong, no decimals. */
export const formatMoney = (amount: number): string =>
    new Intl.NumberFormat(BUSINESS_LOCALE, { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(
        Math.round(amount),
    )

/** A calendar day as day/month/year, from an ISO date or date-time. */
export const formatDay = (iso: string): string => iso.slice(0, 10).split("-").reverse().join("/")

/** Lower case, no accents, letters and digits only: how names are compared, so an accented spelling equals the plain one. */
export const foldText = (text: string): string =>
    text
        .normalize("NFD")
        .replace(/\p{M}/gu, "")
        .replace(D_WITH_STROKE, "d")
        .toLowerCase()
        .replace(/[^a-z0-9]+/gu, " ")
        .trim()
