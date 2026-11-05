/** The kinds a typed field can have; any other kind the back end sends is drawn as one line of text. */
const KINDS = ["number", "text", "toggle", "textarea"] as const

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
}

/** The words a failed rule is told in. */
export interface ParameterWords {
    readonly required: string
    readonly notNumber: string
    readonly tooSmall: (min: number) => string
    readonly tooLarge: (max: number) => string
}

/** What is wrong with one value, in words: a number out of its bounds or no number at all, and (once the install was asked for) a missing required value. */
export const parameterErrorOf = (
    words: ParameterWords,
    isAsked: boolean,
    rule: ParameterRule,
    value: string,
): string => {
    if (rule.kind === "toggle") return ""
    if (value === "") return isAsked && rule.required ? words.required : ""
    if (rule.kind !== "number") return ""
    const amount = Number(value)
    if (Number.isNaN(amount)) return words.notNumber
    if (rule.min !== null && amount < rule.min) return words.tooSmall(rule.min)
    if (rule.max !== null && amount > rule.max) return words.tooLarge(rule.max)
    return ""
}
