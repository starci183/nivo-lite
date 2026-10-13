import type { FactSource } from "@/modules/types"

/** Lower case, accents removed, anything else turned into single dashes: the key facts are matched on. */
export const keyOf = (text: string): string =>
    text
        .toLowerCase()
        .replace(/\u0111/g, "d")
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 120)

/** How far a source is believed, 0 to 100. */
export const TRUST: Readonly<Record<FactSource, number>> = {
    owner: 95,
    manager: 85,
    document: 75,
    system: 70,
    staff: 60,
    customer: 30,
    ai: 20,
}

const NUMBER_WITH_SCALE = /(-?\d[\d.,]*)\s*(t\u1ef7|ty|tri\u1ec7u|trieu|tr|ngh\u00ecn|nghin|ng\u00e0n|ngan|k)?/

const scaleOf = (word: string): number => {
    if (/^(t\u1ef7|ty)$/.test(word)) return 1e9
    if (/^(tri\u1ec7u|trieu|tr)$/.test(word)) return 1e6
    return /^(ngh\u00ecn|nghin|ng\u00e0n|ngan|k)$/.test(word) ? 1e3 : 1
}

/** A number written the Vietnamese way ("650.000", "1,2 tr", "8tr", "1.5k") or null. */
const numberOf = (raw: string): number | null => {
    const match = raw.toLowerCase().replace(/\s+/g, " ").trim().match(NUMBER_WITH_SCALE)
    if (match === null) return null
    const digits = match[1] ?? ""
    const scale = scaleOf(match[2] ?? "")
    const amount =
        scale > 1
            ? Number(digits.replace(",", "."))
            : Number(digits.replace(/[.,](?=\d{3}(\D|$))/g, "").replace(",", "."))
    return Number.isFinite(amount) ? Math.round(amount * scale * 100) / 100 : null
}

/** Two values say the same thing: equal numbers with the same wording around them, or equal once normalised. */
export const sameValue = (first: string, second: string): boolean => {
    const a = numberOf(first)
    const b = numberOf(second)
    const wording = (text: string): string => keyOf(text.replace(/[\d.,\s]/g, ""))
    if (a !== null && b !== null && wording(first) === wording(second)) return a === b
    return keyOf(first) === keyOf(second)
}
