import type { LineMatch, MatchItem, MatchRecipe, OrderLine } from "../inventory.contracts"
import { foldText, parseNumber } from "./number-format.policy"

/** The "and" word of a Vietnamese order line (a with grave accent), spelled by code point. */
const AND_WORD = `v${String.fromCodePoint(0xe0)}`

/** The multiplication sign an order line may use instead of an x. */
const TIMES_SIGN = String.fromCodePoint(0xd7)

/** The bullet a pasted list may start its lines with. */
const BULLET = String.fromCodePoint(0x2022)

/** Order lines end at a line break, a semicolon, a comma not followed by a digit, a plus or the word "and". */
const SPLIT = new RegExp(String.raw`\r?\n|;|,(?!\d)| \+ | ${AND_WORD} `, "iu")

/** "2 coffee", "2x coffee", "2 x coffee": the x is a multiplier only when it stands alone. */
const LEAD_QTY = new RegExp(String.raw`^(\d+(?:[.,]\d+)?)\s*(?:[x${TIMES_SIGN}](?=[\s\d]|$)\s*)?(.+)$`, "iu")

/** "coffee x3", "coffee * 3", "coffee: 3". */
const TRAIL_QTY = new RegExp(String.raw`^(.+?)(?:\s+x\s*|\s*[${TIMES_SIGN}*]\s*|\s*:\s*)(\d+(?:[.,]\d+)?)$`, "iu")

/** Bullets and dashes a pasted list starts its lines with. */
const BULLETS = new RegExp(String.raw`^[\s\-${BULLET}*]+`, "u")

/** Folded unit words an order line may start with ("2 box beer") before the item name. */
const GENERIC_UNIT_WORDS: ReadonlySet<string> = new Set([
    "ly",
    "coc",
    "cai",
    "chai",
    "lon",
    "phan",
    "suat",
    "bao",
    "thung",
    "kg",
    "g",
    "hop",
    "goi",
    "tui",
    "cuon",
    "tam",
    "m",
    "m2",
    "m3",
    "lit",
    "l",
    "ml",
    "dia",
    "to",
    "chiec",
    "bo",
])

interface Candidate {
    readonly score: number
    readonly match: LineMatch
}

/** Reads an order text into lines with a quantity and the name part. A line without a number counts as one. */
export const parseOrderLines = (text: string): Array<OrderLine> =>
    text
        .split(SPLIT)
        .map((part) => part.replace(BULLETS, "").trim())
        .filter((raw) => raw !== "")
        .map((raw): OrderLine => {
            const lead = LEAD_QTY.exec(raw)
            if (lead !== null) {
                const [qty, name] = lead.slice(1)
                return { raw, qty: parseNumber(qty, 1) || 1, name: String(name).trim() }
            }
            const trail = TRAIL_QTY.exec(raw)
            if (trail !== null) {
                const [name, qty] = trail.slice(1)
                return { raw, qty: parseNumber(qty, 1) || 1, name: String(name).trim() }
            }
            return { raw, qty: 1, name: raw }
        })

const scoreName = (needle: string, candidate: string): number => {
    if (candidate === "") return 0
    if (needle === candidate) return 1000 + candidate.length
    if (candidate.length >= 3 && ` ${needle} `.includes(` ${candidate} `)) return 500 + candidate.length
    if (needle.length >= 4 && ` ${candidate} `.includes(` ${needle} `)) return 100 + needle.length
    return 0
}

const better = (best: Candidate | null, next: Candidate): Candidate =>
    best === null || next.score > best.score ? next : best

const bestMatch = (
    variant: string,
    scaleBy: string,
    line: OrderLine,
    recipes: ReadonlyArray<MatchRecipe>,
    items: ReadonlyArray<MatchItem>,
): Candidate | null => {
    let best: Candidate | null = null
    for (const recipe of recipes) {
        for (const name of [recipe.name, ...recipe.aliases]) {
            const score = scoreName(variant, foldText(name))
            // A recipe beats an item of the same name.
            if (score > 0)
                best = better(best, { score: score + 1, match: { kind: "recipe", id: recipe.id, qty: line.qty } })
        }
    }
    for (const item of items) {
        const factor = item.units.find((unit) => foldText(unit.unit) === scaleBy)?.factor ?? 1
        for (const name of [item.name, item.sku, ...item.aliases]) {
            const score = scoreName(variant, foldText(name))
            if (score > 0) best = better(best, { score, match: { kind: "item", id: item.id, qty: line.qty * factor } })
        }
    }
    return best
}

/**
 * Matches one order line against the recipes (a product made of ingredients) and the items. A leading unit word
 * ("2 box beer") scales the quantity by the item's conversion; the line is tried without it first, then whole.
 */
export const matchOrderLine = (
    line: OrderLine,
    recipes: ReadonlyArray<MatchRecipe>,
    items: ReadonlyArray<MatchItem>,
): LineMatch | null => {
    const full = foldText(line.name)
    const words = full.split(" ")
    const first = full.split(" ", 1).join("")
    const secondaryUnits = new Set(items.flatMap((item) => item.units.map((unit) => foldText(unit.unit))))
    const unitWord = GENERIC_UNIT_WORDS.has(first) || secondaryUnits.has(first) ? first : ""
    const attempts =
        unitWord === ""
            ? [{ variant: full, scaleBy: "" }]
            : [
                  { variant: words.slice(1).join(" "), scaleBy: unitWord },
                  { variant: full, scaleBy: "" },
              ]
    for (const { variant, scaleBy } of attempts) {
        if (variant === "") continue
        const best = bestMatch(variant, scaleBy, line, recipes, items)
        if (best !== null) return best.match
    }
    return null
}
