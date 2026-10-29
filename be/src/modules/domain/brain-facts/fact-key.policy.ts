import type { FactSource } from "./brain-facts.contracts"

/**
 * How far a source is believed, 0 to 100. What the owner states outranks a document, which outranks the system, staff, a customer's
 * message and, last, the model's own inference.
 */
export const TRUST: Readonly<Record<FactSource, number>> = {
    owner: 95,
    manager: 85,
    document: 75,
    system: 70,
    staff: 60,
    customer: 30,
    ai: 20,
}

/** Only an owner or manager statement may become active without a review. */
export const AUTO_APPLY_TRUST = 85

/** Lower case, accents removed (d with stroke becomes d), anything else turned into single dashes: "Combo Thu gian!" becomes "combo-thu-gian". */
export const factSlugOf = (text: string): string =>
    text
        .toLowerCase()
        .replaceAll("\u0111", "d")
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 120)

/** Vietnamese scale words as written with accents and without (billion, million, thousand), and the short forms tr and k. */
const BILLION = /^(t\u1ef7|ty)$/
const MILLION = /^(tri\u1ec7u|trieu|tr)$/
const THOUSAND = /^(ngh\u00ecn|nghin|ng\u00e0n|ngan|k)$/
const NUMBER_WITH_SCALE = /(-?\d[\d.,]*)\s*(t\u1ef7|ty|tri\u1ec7u|trieu|tr|ngh\u00ecn|nghin|ng\u00e0n|ngan|k)?/

/** The multiplier a written scale word stands for. */
const scaleOf = (word: string): number => {
    if (BILLION.test(word)) return 1e9
    if (MILLION.test(word)) return 1e6
    return THOUSAND.test(word) ? 1e3 : 1
}

/** A number written the Vietnamese way ("650.000", "1,2 tr", "8tr", "2 trieu", "1.5k") or null. */
export const numberOf = (raw: string): number | null => {
    const text = raw.toLowerCase().replace(/\s+/g, " ").trim()
    const match = NUMBER_WITH_SCALE.exec(text)
    if (match === null) return null
    const digits = match[1] ?? ""
    const scale = scaleOf(match[2] ?? "")
    // With a scale word "1,2" and "1.5" are decimals; without one "650.000" and "650,000" group thousands.
    const amount =
        scale > 1
            ? Number(digits.replace(",", "."))
            : Number(digits.replace(/[.,](?=\d{3}(\D|$))/g, "").replace(",", "."))
    return Number.isFinite(amount) ? Math.round(amount * scale * 100) / 100 : null
}

/** The wording of a value without its digits, to compare "8h" with "8 minutes". */
const wording = (text: string): string => factSlugOf(text.replace(/[\d.,\s]/g, ""))

/** Two values say the same thing: equal numbers with the same wording around them, or equal once normalised. */
export const sameValue = (first: string, second: string): boolean => {
    const a = numberOf(first)
    const b = numberOf(second)
    if (a !== null && b !== null && wording(first) === wording(second)) return a === b
    return factSlugOf(first) === factSlugOf(second)
}
