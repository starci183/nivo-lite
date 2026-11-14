import {
    CURRENCY_SIGN,
    CURRENCY_WORDS,
    DURATION_UNIT_WORDS,
    DURATION_WORDS,
    FREE_WORDS,
    NO_TEXT,
    NO_WORDS,
    PERCENT_WORDS,
    PER_UNIT_OPENERS,
    SCALE_WORDS,
    TIME_FROM_WORDS,
    TIME_TO_WORDS,
    YES_TEXT,
    YES_WORDS,
} from "./messages/policy-value.messages"

/**
 * The parameter a policy's value reads as, inferred from the value and unit of the fact alone (owner 2026-11-11: inferred from the truth
 * graph and editable as a parameter): no type table keyed by fact key. Pure parsing: a value that is not exactly one of the forms below is
 * `text`, never guessed.
 */
export type PolicyValueType = "money" | "percent" | "duration" | "time_range" | "boolean" | "text"

/** A policy value as a parameter. */
export type PolicyValue =
    | { readonly type: "money"; readonly amountVnd: number; readonly per: string | null }
    | { readonly type: "percent"; readonly percent: number }
    | { readonly type: "duration"; readonly minutes: number }
    | { readonly type: "time_range"; readonly from: string; readonly to: string }
    | { readonly type: "boolean"; readonly yes: boolean }
    | { readonly type: "text"; readonly text: string }

/** Why an edit was refused. */
export type PolicyValueProblem = "empty" | "not_money" | "not_percent" | "not_duration" | "not_time_range" | "not_boolean" | "too_long"

/** The longest value a policy may hold (the fact store's own limit is higher; a parameter is short). */
export const POLICY_VALUE_MAX = 500

const SCALES: ReadonlyArray<readonly [RegExp, number]> = [
    [new RegExp(`^(${SCALE_WORDS.billion})$`, "u"), 1e9],
    [new RegExp(`^(${SCALE_WORDS.million})$`, "u"), 1e6],
    [new RegExp(`^(${SCALE_WORDS.thousand})$`, "u"), 1e3],
]

/** Minutes per duration word. */
const DURATION_UNITS: ReadonlyArray<readonly [RegExp, number]> = [
    [new RegExp(`^(${DURATION_WORDS.minute})$`, "u"), 1],
    [new RegExp(`^(${DURATION_WORDS.hour})$`, "u"), 60],
    [new RegExp(`^(${DURATION_WORDS.day})$`, "u"), 1440],
    [new RegExp(`^(${DURATION_WORDS.week})$`, "u"), 10080],
]

const SCALE_ALTERNATION = [SCALE_WORDS.billion, SCALE_WORDS.million, SCALE_WORDS.thousand].join("|")
const DURATION_ALTERNATION = [DURATION_WORDS.minute, DURATION_WORDS.hour, DURATION_WORDS.day, DURATION_WORDS.week].join("|")
const NUMBER = String.raw`(\d+(?:[.,]\d+)*)`
const MONEY = new RegExp(
    String.raw`^${NUMBER}\s*(${SCALE_ALTERNATION})?\s*(${CURRENCY_WORDS})?(?:\s*((?:${PER_UNIT_OPENERS})\s*\p{L}+(?:\s\p{L}+)?))?$`,
    "u",
)
const PERCENT = new RegExp(String.raw`^${NUMBER}\s*(${PERCENT_WORDS})$`, "u")
const DURATION = new RegExp(String.raw`^${NUMBER}\s*(${DURATION_ALTERNATION})$`, "u")
const CLOCK = String.raw`(\d{1,2})(?:\s*[:h]\s*(\d{2})?)?`
const TIME_RANGE = new RegExp(String.raw`^(?:${TIME_FROM_WORDS})?${CLOCK}\s*(?:${TIME_TO_WORDS})\s*${CLOCK}$`, "u")
const YES: ReadonlySet<string> = new Set(YES_WORDS)
const NO: ReadonlySet<string> = new Set(NO_WORDS)
const FREE: ReadonlySet<string> = new Set(FREE_WORDS)

/** Lower case, single spaces, trimmed; accents kept (the regular expressions accept both forms). */
const plain = (text: string): string => text.normalize("NFC").toLowerCase().replaceAll(/\s+/g, " ").trim()

/**
 * A written number: "30.000" and "30,000" group thousands; "1,5" and "1.5" are decimals; "1.200.000" groups. With a scale word a single
 * separator is a decimal ("1,2" before a scale word). Null when it is neither.
 */
const numberOf = (digits: string, scaled: boolean): number | null => {
    const groups = digits.split(/[.,]/)
    if (groups.length === 1) return Number(digits)
    const grouped = groups.slice(1).every((group) => group.length === 3)
    if (grouped && !(scaled && groups.length === 2)) return Number(groups.join(""))
    if (groups.length === 2) return Number(`${groups[0] ?? ""}.${groups[1] ?? ""}`)
    return null
}

const scaleOf = (word: string | undefined): number =>
    word === undefined ? 1 : (SCALES.find(([pattern]) => pattern.test(word))?.[1] ?? 1)

const moneyOf = (text: string): PolicyValue | null => {
    if (FREE.has(text)) return { type: "money", amountVnd: 0, per: null }
    const match = MONEY.exec(text)
    // A bare number is not money: the currency or a scale word must be written.
    if (match === null || (match[2] === undefined && match[3] === undefined)) return null
    const amount = numberOf(match[1] ?? "", match[2] !== undefined)
    if (amount === null) return null
    const vnd = amount * scaleOf(match[2])
    if (!Number.isInteger(Math.round(vnd * 1000) / 1000) || !Number.isSafeInteger(Math.round(vnd))) return null
    return { type: "money", amountVnd: Math.round(vnd), per: match[4] ?? null }
}

const percentOf = (text: string): PolicyValue | null => {
    const match = PERCENT.exec(text)
    const amount = match === null ? null : numberOf(match[1] ?? "", true)
    return amount === null || amount > 100 ? null : { type: "percent", percent: amount }
}

const durationOf = (text: string): PolicyValue | null => {
    const match = DURATION.exec(text)
    if (match === null) return null
    const amount = numberOf(match[1] ?? "", true)
    const per = DURATION_UNITS.find(([pattern]) => pattern.test(match[2] ?? ""))?.[1]
    if (amount === null || per === undefined) return null
    const minutes = amount * per
    return Number.isInteger(minutes) ? { type: "duration", minutes } : null
}

const clockOf = (hours: string | undefined, minutes: string | undefined): string | null => {
    const h = Number(hours)
    const m = minutes === undefined ? 0 : Number(minutes)
    if (!Number.isInteger(h) || h > 24 || m > 59 || (h === 24 && m > 0)) return null
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

const timeRangeOf = (text: string): PolicyValue | null => {
    const match = TIME_RANGE.exec(text)
    if (match === null) return null
    const from = clockOf(match[1], match[2])
    const to = clockOf(match[3], match[4])
    return from === null || to === null || from === to ? null : { type: "time_range", from, to }
}

const booleanOf = (text: string): PolicyValue | null => {
    if (YES.has(text)) return { type: "boolean", yes: true }
    return NO.has(text) ? { type: "boolean", yes: false } : null
}

/** The parameter a written value reads as; `text` when it is none of the forms. */
export const parsePolicyValue = (written: string): PolicyValue => {
    const text = plain(written)
    return (
        moneyOf(text) ??
        percentOf(text) ??
        durationOf(text) ??
        timeRangeOf(text) ??
        booleanOf(text) ?? { type: "text", text: written.trim() }
    )
}

/** The parameter a fact's value reads as: its value, followed by its unit when the unit is written apart. */
export const policyValueOf = (value: string, unit: string | null): PolicyValue => {
    const withUnit = unit === null || unit.trim() === "" ? value : `${value} ${unit.trim()}`
    const parsed = parsePolicyValue(withUnit)
    return parsed.type === "text" ? { type: "text", text: value.trim() } : parsed
}

/** A whole or decimal number the Vietnamese way: thousands grouped with a dot, a comma for the decimals. */
const vnNumber = (amount: number): string => new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(amount)

/** The per-unit words after an amount, as written: a space and the words, or the words alone when they open with a slash. */
const moneyTail = (per: string | null): string => {
    if (per === null) return ""
    return per.startsWith("/") ? per : ` ${per}`
}

/** A duration in the largest unit it is a whole number of. */
const durationWords = (minutes: number): string => {
    if (minutes > 0 && minutes % 1440 === 0) return `${vnNumber(minutes / 1440)} ${DURATION_UNIT_WORDS.day}`
    if (minutes > 0 && minutes % 60 === 0) return `${vnNumber(minutes / 60)} ${DURATION_UNIT_WORDS.hour}`
    return `${vnNumber(minutes)} ${DURATION_UNIT_WORDS.minute}`
}

/** How a parameter is stored in the truth graph (what the agents read): an amount with its currency sign, a percentage, a duration in words, a time range, or yes or no. */
export const writtenPolicyValue = (value: PolicyValue): string => {
    switch (value.type) {
        case "money":
            return `${vnNumber(value.amountVnd)} ${CURRENCY_SIGN}${moneyTail(value.per)}`
        case "percent":
            return `${vnNumber(value.percent)}%`
        case "duration":
            return durationWords(value.minutes)
        case "time_range":
            return `${value.from}–${value.to}`
        case "boolean":
            return value.yes ? YES_TEXT : NO_TEXT
        case "text":
            return value.text
    }
}

/** The problem of an edit that does not read as the row's parameter type. */
const PROBLEM_OF: Readonly<Record<Exclude<PolicyValueType, "text">, PolicyValueProblem>> = {
    money: "not_money",
    percent: "not_percent",
    duration: "not_duration",
    time_range: "not_time_range",
    boolean: "not_boolean",
}

/**
 * An edit of a policy row: the owner's words must read as the row's type (a money row takes an amount with a currency sign, a scale word
 * or both); a money value keeps the per-unit words of the value in force unless the edit names its own. A text row takes any words.
 */
export const editedPolicyValue = (
    current: PolicyValue,
    written: string,
): { readonly value: PolicyValue } | { readonly problem: PolicyValueProblem } => {
    const trimmed = written.trim()
    if (trimmed === "") return { problem: "empty" }
    if (trimmed.length > POLICY_VALUE_MAX) return { problem: "too_long" }
    if (current.type === "text") return { value: { type: "text", text: trimmed } }
    // A bare number in a money row means VND, in a percent row percent, in a duration row minutes: the control sends digits only.
    const bare = /^\d+(?:[.,]\d+)?$/.test(trimmed)
    const suffix = bare
        ? { money: ` ${CURRENCY_SIGN}`, percent: "%", duration: ` ${DURATION_UNIT_WORDS.minute}`, time_range: "", boolean: "" }[current.type]
        : ""
    const parsed = parsePolicyValue(`${trimmed}${suffix}`)
    if (parsed.type !== current.type) return { problem: PROBLEM_OF[current.type] }
    if (parsed.type === "money" && current.type === "money" && parsed.per === null) return { value: { ...parsed, per: current.per } }
    return { value: parsed }
}

/** Two values say the same as parameters. */
export const samePolicyValue = (a: PolicyValue, b: PolicyValue): boolean =>
    writtenPolicyValue(a).toLowerCase() === writtenPolicyValue(b).toLowerCase()
