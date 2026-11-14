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

/** Text folded for comparison: lower case, no accents (d with stroke becomes d), single spaces, letters and digits only. */
export const foldedText = (text: string): string =>
    text
        .toLowerCase()
        .replaceAll("\u0111", "d")
        .normalize("NFD")
        .replaceAll(/\p{Diacritic}/gu, "")
        .replaceAll(/[^a-z0-9]+/g, " ")
        .trim()

/** Lower case, accents removed (d with stroke becomes d), anything else turned into single dashes: "Combo Thu gian!" becomes "combo-thu-gian". */
export const factSlugOf = (text: string): string =>
    text
        .toLowerCase()
        .replaceAll("\u0111", "d")
        .normalize("NFD")
        .replaceAll(/\p{Diacritic}/gu, "")
        .replaceAll(/[^a-z0-9]+/g, "-")
        .replaceAll(/^-|-$/g, "")
        .slice(0, 120)

/** Vietnamese scale words as written with accents and without (billion, million, thousand), and the short forms tr and k. */
const BILLION = /^(t\u1ef7|ty)$/
const MILLION = /^(tri\u1ec7u|trieu|tr)$/
const THOUSAND = /^(ngh\u00ecn|nghin|ng\u00e0n|ngan|k)$/
const NUMBER_WITH_SCALE =
    /(-?\d[\d.,]*)(?:\s*(t\u1ef7|ty|tri\u1ec7u|trieu|tr|ngh\u00ecn|nghin|ng\u00e0n|ngan|k)(?!\p{L}))?/u

/** The multiplier a written scale word stands for. */
const scaleOf = (word: string): number => {
    if (BILLION.test(word)) return 1e9
    if (MILLION.test(word)) return 1e6
    return THOUSAND.test(word) ? 1e3 : 1
}

/** The amount of one written number and its scale word, or null. */
const amountOf = (digits: string, word: string): number | null => {
    const scale = scaleOf(word)
    // With a scale word "1,2" and "1.5" are decimals; without one "650.000" and "650,000" group thousands.
    const amount =
        scale > 1
            ? Number(digits.replace(",", "."))
            : Number(digits.replaceAll(/[.,](?=\d{3}(\D|$))/g, "").replace(",", "."))
    return Number.isFinite(amount) ? Math.round(amount * scale * 100) / 100 : null
}

/** A number written the Vietnamese way ("650.000", "1,2 tr", "8tr", "2 trieu", "1.5k") or null. */
export const numberOf = (raw: string): number | null => {
    const text = raw.toLowerCase().replaceAll(/\s+/g, " ").trim()
    const match = NUMBER_WITH_SCALE.exec(text)
    return match === null ? null : amountOf(match[1] ?? "", match[2] ?? "")
}

/**
 * Every number a text writes, in order, each read the way `numberOf` reads one ("350.000 d" and "350k" are 350000, "8:00-20:00" is 8,
 * 0, 20, 0, "16/02/2026" is 16, 2, 2026). A dash is a separator here, never a minus sign.
 */
export const numbersOf = (raw: string): ReadonlyArray<number> => {
    const text = raw.toLowerCase().replaceAll(/\s+/g, " ")
    return [...text.matchAll(new RegExp(NUMBER_WITH_SCALE.source, "gu"))].flatMap((match) => {
        const amount = amountOf((match[1] ?? "").replace(/^-/, ""), match[2] ?? "")
        return amount === null ? [] : [amount]
    })
}

/** Currency marks (folded): the amount carries the currency, so the mark adds nothing to the comparison. */
const CURRENCY_WORDS: ReadonlySet<string> = new Set(["d", "vnd", "vn", "dong"])

/**
 * The wording of a value without its number, scale word and currency mark (notation of an amount), to compare "8h" with "8 minutes".
 * EVERY other word counts: "5.000 d a pot" and "5.000 d" are NOT the same value for code (what a price is for is part of what the
 * line says; the truth's `unit` field, written by whoever states it, is where a per-unit phrase belongs, and two wordings of one
 * value are the same-fact judge's reading, never a word list's: owner 2026-11-12).
 */
const wording = (text: string): string =>
    foldedText(text.toLowerCase().replaceAll(new RegExp(NUMBER_WITH_SCALE.source, "gu"), " "))
        .split(" ")
        .filter((word) => word !== "" && !CURRENCY_WORDS.has(word))
        .join("-")

/**
 * The kinds of value the truth graph reads as a typed parameter (the same kinds the policy tab infers): a share, a span of the clock, a
 * length of time, a yes or no, an amount of money, a bare number; anything else is text.
 */
export type ValueType = "percent" | "time_range" | "duration" | "boolean" | "money" | "number" | "text"

/** A value read in its ONE normal form for comparing (D-BR-10): its type and a key that is equal exactly when the values are. */
export interface ValueForm {
    /** What the value reads as. */
    readonly type: ValueType
    /** The comparable key of the value in its type ("30000", "08:00-20:00", "480", "yes"); for text, its slug. */
    readonly key: string
    /**
     * True for an amount followed by other words ("30k per order"): code compares it exactly (the amount AND the words); whether two
     * such wordings say one value is a reading, the same-fact judge's (`valuesAgree`).
     */
    readonly worded?: boolean
}

/** A written number with a decimal comma or point ("1,5", "2.5"), or a whole one. */
const DECIMAL = String.raw`(\d+(?:[.,]\d+)?)`
/** A clock time: "8", "08", "8h", "8h00", "8:00", "8 gio", "8 gio 30". */
const CLOCK = String.raw`(\d{1,2})\s*(?:(?:[:h]|gi\u1edd|gio)\s*(\d{2})?)?`
const PERCENT_FORM = new RegExp(String.raw`^${DECIMAL}\s*(?:%|ph\u1ea7n tr\u0103m|phan tram)$`, "u")
const TIME_RANGE_FORM = new RegExp(
    String.raw`^(?:t\u1eeb\s+|tu\s+)?${CLOCK}\s*(?:-|\u2013|\u2014|\u0111\u1ebfn|den|t\u1edbi|toi)\s*${CLOCK}$`,
    "u",
)
const DURATION_FORM = new RegExp(
    String.raw`^${DECIMAL}\s*(ph\u00fat|phut|p|gi\u1edd|gio|ti\u1ebfng|tieng|h|ng\u00e0y|ngay|tu\u1ea7n|tuan)$`,
    "u",
)
/** Minutes per written unit of a length of time. */
const MINUTES_PER: ReadonlyArray<readonly [RegExp, number]> = [
    [/^(ph\u00fat|phut|p)$/u, 1],
    [/^(gi\u1edd|gio|ti\u1ebfng|tieng|h)$/u, 60],
    [/^(ng\u00e0y|ngay)$/u, 1440],
    [/^(tu\u1ea7n|tuan)$/u, 10080],
]
/** Yes and no as people write them (folded). */
const YES_WORDS: ReadonlySet<string> = new Set(["co", "yes", "true", "dung"])
const NO_WORDS: ReadonlySet<string> = new Set(["khong", "no", "false", "sai"])
/** "Free" is an amount of money: nothing. */
const FREE_WORDS: ReadonlySet<string> = new Set(["mien phi", "free"])

/** Lower case, single spaces, accents kept (the forms accept both). */
const plainOf = (text: string): string => text.normalize("NFC").toLowerCase().replaceAll(/\s+/g, " ").trim()

/** A clock time as "HH:MM", or null when it is no time of the day. */
const clockKeyOf = (hours: string | undefined, minutes: string | undefined): string | null => {
    const h = Number(hours)
    const m = minutes === undefined ? 0 : Number(minutes)
    if (!Number.isInteger(h) || h > 24 || m > 59 || (h === 24 && m > 0)) return null
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

/** A decimal written either way as a number. */
const decimalOf = (digits: string): number => Number(digits.replace(",", "."))

/** The typed form of a value that is NOT money or text, or null. */
const shapedFormOf = (text: string): ValueForm | null => {
    const percent = PERCENT_FORM.exec(text)
    if (percent !== null) return { type: "percent", key: String(decimalOf(percent[1] ?? "")) }
    // A span of the clock says so ("8:00", "8h", "8 gio"): "10-20" alone is a range of counts, not of hours.
    const range = /[:h]|gi\u1edd|gio/u.test(text) ? TIME_RANGE_FORM.exec(text) : null
    if (range !== null) {
        const from = clockKeyOf(range[1], range[2])
        const to = clockKeyOf(range[3], range[4])
        if (from !== null && to !== null && from !== to) return { type: "time_range", key: `${from}-${to}` }
    }
    const duration = DURATION_FORM.exec(text)
    if (duration !== null) {
        const per = MINUTES_PER.find(([pattern]) => pattern.test(duration[2] ?? ""))?.[1] ?? 1
        return { type: "duration", key: String(decimalOf(duration[1] ?? "") * per) }
    }
    return null
}

/** Yes or no, as the folded first word says it, or null. */
const yesNoOf = (folded: string): "yes" | "no" | null => {
    if (YES_WORDS.has(folded)) return "yes"
    return NO_WORDS.has(folded) ? "no" : null
}

/**
 * The ONE normal form a value is compared in (D-BR-10): "5 %", "5%" and "5 phan tram" are one share; "8:00-20:00", "8h den 20h" and
 * "tu 8 gio den 20 gio" one span of the clock; "24 gio" and "1 ngay" one length of time; "Co" and "co" one yes; "mien phi" is money 0;
 * an amount with its currency or scale word ("30.000 d", "30k", "30 nghin", "30,000 VND") is money; an amount that OPENS the value and
 * is followed by other words ("30k mot don") is still money, and those words are part of its key (two such values are equal only when
 * the words are); a bare number is a number. Anything else is text, keyed by its slug. The store keeps the wording the founder or the
 * document used; only the comparison reads this form. Notation of numbers, clocks, units of time, currency, and the whole-value
 * tokens yes / no / free are read here; nothing here reads what a sentence means.
 */
export const valueFormOf = (value: string): ValueForm => {
    const text = plainOf(value)
    const shaped = shapedFormOf(text)
    if (shaped !== null) return shaped
    const folded = foldedText(text)
    const yesNo = yesNoOf(folded)
    if (yesNo !== null) return { type: "boolean", key: yesNo }
    if (FREE_WORDS.has(folded)) return { type: "money", key: "0" }
    const amount = numberOf(text)
    const rest = wording(text)
    if (amount !== null && (rest === "" || NUMBER_WITH_SCALE.exec(text)?.index === 0)) {
        const marked =
            /(\d\s*(t\u1ef7|ty|tri\u1ec7u|trieu|tr|ngh\u00ecn|nghin|ng\u00e0n|ngan|k)(?!\p{L}))|\u0111|\u20ab|\bd\b|vnd|\u0111\u1ed3ng|dong/u.test(
                text,
            )
        if (rest === "") return { type: marked ? "money" : "number", key: String(amount) }
        if (marked) return { type: "money", key: `${String(amount)}:${rest}`, worded: true }
    }
    return { type: "text", key: factSlugOf(text) }
}

/**
 * The type a truth's value holds: its normal form (`valueFormOf`), nothing more. A yes or no is a yes/no rule only when it is the WHOLE
 * value; "no delivery" is text (code no longer reads the words after a yes / no against the truth's labels: owner 2026-11-12).
 */
const truthValueTypeOf = (value: string): ValueType => valueFormOf(value).type

/** A value with the labels of the truth it belongs to (the labels are carried for the caller's messages; the type reads the value alone). */
export interface LabelledValue {
    /** The value as written, with its unit. */
    readonly value: string
    /** The subject and attribute labels. */
    readonly labels: string
}

/** The problem codes of a value that does not read as the type of the truth it would replace (the policy tab's own codes). */
export type ValueTypeProblem = "not_money" | "not_percent" | "not_duration" | "not_time_range" | "not_boolean"

/** A value that fits the type of the truth it replaces (null), or why not. */
export type ValueTypeVerdict = ValueTypeProblem | null

const PROBLEM_OF_TYPE: Readonly<Partial<Record<ValueType, ValueTypeProblem>>> = {
    money: "not_money",
    percent: "not_percent",
    duration: "not_duration",
    time_range: "not_time_range",
    boolean: "not_boolean",
}

/**
 * Whether a new value fits the type of the value in force it replaces (D-BR-12): a typed truth (money, percent, duration, span of the
 * clock, yes/no) takes only a value of its type ("maybe" is refused on a yes/no rule, `not_boolean`); a bare number is taken by a money
 * truth (the amount); a text truth takes anything. Null when it fits.
 */
export const valueTypeProblemOf = (current: LabelledValue, next: LabelledValue): ValueTypeVerdict => {
    const want = truthValueTypeOf(current.value)
    const problem = PROBLEM_OF_TYPE[want]
    if (problem === undefined) return null
    const got = truthValueTypeOf(next.value)
    if (got === want || (want === "money" && got === "number")) return null
    return problem
}

/** True when a value is free text or an amount with other words: what code cannot compare beyond exact equality. */
export const readByJudge = (value: string): boolean => {
    const form = valueFormOf(value)
    return form.type === "text" || form.worded === true
}

/**
 * Two values say the same thing. Both typed (a share, a span of the clock, a length of time, a yes/no): the same type and the same
 * normal form. Otherwise equal numbers with the same wording around them (currency marks aside; every other word counts), or equal
 * once normalised.
 */
export const sameValue = (first: string, second: string): boolean => {
    const one = valueFormOf(first)
    const other = valueFormOf(second)
    const shaped: ReadonlySet<ValueType> = new Set(["percent", "time_range", "duration", "boolean"])
    if (shaped.has(one.type) && shaped.has(other.type)) return one.type === other.type && one.key === other.key
    const a = numberOf(first)
    const b = numberOf(second)
    if (a !== null && b !== null && wording(first) === wording(second)) return a === b
    return factSlugOf(first) === factSlugOf(second)
}
