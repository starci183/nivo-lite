/** The kinds a typed field can have; any other kind the back end sends is drawn as one line of text. */
const KINDS = ["number", "text", "toggle", "textarea", "time", "choice"] as const

/** The kind of one template parameter. */
export type ParameterKind = (typeof KINDS)[number]

/** The kind a field is drawn as. */
export const kindOf = (kind: string): ParameterKind => KINDS.find((entry) => entry === kind) ?? "text"

/** What the rules of one parameter say about its value. */
export interface ParameterRule {
    readonly kind: string
    readonly required: boolean
    readonly min: number | null
    readonly max: number | null
    /** The values a `choice` accepts. */
    readonly choices?: ReadonlyArray<string>
}

/** A time of day written HH:MM. */
const TIME_OF_DAY = /^([01]\d|2[0-3]):[0-5]\d$/

/** The words a failed rule is told in. */
export interface ParameterWords {
    readonly required: string
    readonly notNumber: string
    readonly notTime: string
    readonly notChoice: string
    readonly tooSmall: (min: number) => string
    readonly tooLarge: (max: number) => string
}

/** What is wrong with a number: no number at all, or one out of its bounds. */
const numberErrorOf = (words: ParameterWords, rule: ParameterRule, value: string): string => {
    const amount = Number(value)
    if (Number.isNaN(amount)) return words.notNumber
    if (rule.min !== null && amount < rule.min) return words.tooSmall(rule.min)
    return rule.max !== null && amount > rule.max ? words.tooLarge(rule.max) : ""
}

/** What is wrong with one filled value, by its kind; text, textarea and toggle accept anything. */
const filledErrorOf = (words: ParameterWords, rule: ParameterRule, value: string): string => {
    if (rule.kind === "time") return TIME_OF_DAY.test(value) ? "" : words.notTime
    if (rule.kind === "choice") return (rule.choices ?? []).includes(value) ? "" : words.notChoice
    return rule.kind === "number" ? numberErrorOf(words, rule, value) : ""
}

/** What is wrong with one value, in words: a bad time, choice or number, and (once the install was asked for) a missing required value. */
export const parameterErrorOf = (
    words: ParameterWords,
    isAsked: boolean,
    rule: ParameterRule,
    value: string,
): string => {
    if (rule.kind === "toggle") return ""
    if (value === "") return isAsked && rule.required ? words.required : ""
    return filledErrorOf(words, rule, value)
}
