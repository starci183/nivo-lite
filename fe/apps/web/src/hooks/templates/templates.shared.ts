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
