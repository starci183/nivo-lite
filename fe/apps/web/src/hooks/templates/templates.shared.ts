import type {
    useQueryAgentTemplatePreviewSwr,
    useQueryMarketplaceListingsSwr,
    useQueryMyAgentTemplatesSwr,
    useQueryTemplateUpdateOffersSwr,
} from "@/hooks/swr"

/** The templates of the caller as the read answers them. */
export type MyAgentTemplatesData = NonNullable<ReturnType<typeof useQueryMyAgentTemplatesSwr>["data"]>

/** The newer versions offered as the read answers them. */
export type TemplateUpdateOffersData = NonNullable<ReturnType<typeof useQueryTemplateUpdateOffersSwr>["data"]>

/** The approved listings as the read answers them. */
export type MarketplaceListingsData = NonNullable<ReturnType<typeof useQueryMarketplaceListingsSwr>["data"]>

/** The preview a creator reads before packaging: what the package keeps, what it leaves out and why it is refused. */
export type PackagePreviewData = NonNullable<ReturnType<typeof useQueryAgentTemplatePreviewSwr>["data"]>

/** The preview request, as the read takes it. */
export type PackagePreviewRequest = NonNullable<Parameters<typeof useQueryAgentTemplatePreviewSwr>[0]>

/** The input of the accept command. */
export interface AcceptInput {
    readonly installationId: string
    readonly unitIds: Array<string>
}

/** The words a buyer writes as the values of a template: a JSON object of numbers, texts and yes or no, or nothing. */
export const valuesOfText = (text: string): Record<string, number | string | boolean> | null => {
    if (text.trim() === "") return {}
    try {
        const parsed: unknown = JSON.parse(text)
        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null
        return Object.fromEntries(
            Object.entries(parsed).flatMap(([key, member]): Array<[string, number | string | boolean]> =>
                typeof member === "number" || typeof member === "string" || typeof member === "boolean"
                    ? [[key, member]]
                    : [],
            ),
        )
    } catch {
        return null
    }
}

/** The ids of the units of an offer that are safe to take at once: the ones the buyer never touched, and what the creator added. */
export const safeUnitIds = (units: ReadonlyArray<{ readonly id: string; readonly change: string }>): Array<string> =>
    units.filter((unit) => unit.change === "upgrade" || unit.change === "added").map((unit) => unit.id)

/** The input of the accept mutation. */
export const acceptInputOf = (installationId: string, unitIds: Array<string>): AcceptInput => ({
    installationId,
    unitIds,
})

/** The text fields of the card of a template, in reading order. */
export const TEXT_FIELDS: readonly ["key", "nameVi", "nameEn", "summaryVi", "summaryEn", "category"] = [
    "key",
    "nameVi",
    "nameEn",
    "summaryVi",
    "summaryEn",
    "category",
]

/** The name of one text field of the card. */
export type TextFieldName = (typeof TEXT_FIELDS)[number]

const TEXT_FIELD_NAMES: ReadonlySet<string> = new Set(TEXT_FIELDS)

/** True when the name is one of the text fields of the card. */
export const isTextField = (name: string): name is TextFieldName => TEXT_FIELD_NAMES.has(name)
/** The kinds a typed field can have; any other kind the back end sends is drawn as one line of text. */
const KINDS = ["number", "text", "toggle", "textarea", "time", "choice"] as const

/** The kind of one template parameter. */
type ParameterKind = (typeof KINDS)[number]

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
