import type { useTranslations } from "next-intl"
import type { DocumentUsage, LimitCardView, LimitLevel, QuotaRefusal, UsageLimitsView } from "@/modules/types"

type LimitsTranslate = ReturnType<typeof useTranslations<"brainTruths">>

/** Bytes in a megabyte, as the allowances count them. */
const BYTES_PER_MB = 1024 * 1024

/** From this share of the documents allowance the line under the meter asks for room. */
const NEARLY_FULL = 0.9

/** The app formatter, narrowed to the one call a size makes. */
interface SizeFormatter {
    readonly number: (
        value: number,
        options: { maximumFractionDigits: number; style: "unit"; unit: "kilobyte" | "megabyte" },
    ) => string
}

/** A size in the viewer's language: megabytes with one decimal, kilobytes below a tenth of a megabyte so a small share never reads 0. */
export const sizeOfBytes = (formatter: SizeFormatter, bytes: number): string =>
    bytes > 0 && bytes < BYTES_PER_MB / 10
        ? formatter.number(Math.max(1, Math.round(bytes / 1024)), {
              maximumFractionDigits: 0,
              style: "unit",
              unit: "kilobyte",
          })
        : formatter.number(bytes / BYTES_PER_MB, { maximumFractionDigits: 1, style: "unit", unit: "megabyte" })

/** How full the documents allowance is. */
export const limitLevelOf = (usedBytes: number, limitBytes: number): LimitLevel => {
    if (limitBytes <= 0 || usedBytes >= limitBytes) return "full"
    return usedBytes / limitBytes >= NEARLY_FULL ? "nearly" : "normal"
}

/** The caption under the documents meter: room left, a request for room from 90 %, or none left. */
const documentsCaptionOf = (
    t: LimitsTranslate,
    formatter: SizeFormatter,
    usage: DocumentUsage["documents"],
): string => {
    const level = limitLevelOf(usage.usedBytes, usage.limitBytes)
    const left = sizeOfBytes(formatter, Math.max(0, usage.limitBytes - usage.usedBytes))
    if (level === "full") return t("limitDocsNone", { count: usage.count })
    return level === "nearly" ? t("limitDocsNearly", { left }) : t("limitDocsLeft", { left, count: usage.count })
}

/** The usage block: the documents against the 50 MB and the truths against their ceiling, and the notice of a used-up allowance. */
export const usageLimitsOf = (t: LimitsTranslate, formatter: SizeFormatter, usage: DocumentUsage): UsageLimitsView => {
    const { documents, truths } = usage
    const level = limitLevelOf(documents.usedBytes, documents.limitBytes)
    const limit = sizeOfBytes(formatter, documents.limitBytes)
    return {
        level,
        full: level === "full" ? { title: t("limitFullTitle", { limit }), body: t("limitFullBody") } : null,
        cards: [
            {
                id: "documents",
                label: t("limitDocsLabel"),
                valueLabel: t("limitDocsValue", { used: sizeOfBytes(formatter, documents.usedBytes), limit }),
                value: Math.min(documents.usedBytes, Math.max(documents.limitBytes, 1)),
                max: Math.max(documents.limitBytes, 1),
                caption: documentsCaptionOf(t, formatter, documents),
            },
            {
                id: "truths",
                label: t("limitTruthsLabel"),
                valueLabel: t("limitTruthsValue", { count: truths.count, limit: truths.limitCount }),
                value: Math.min(truths.count, Math.max(truths.limitCount, 1)),
                max: Math.max(truths.limitCount, 1),
                caption: t("limitTruthsBytes", {
                    used: sizeOfBytes(formatter, truths.usedBytes),
                    limit: sizeOfBytes(formatter, truths.limitBytes),
                }),
            },
        ] satisfies readonly [LimitCardView, LimitCardView],
    }
}

/** The refusal the browser already knows about: the file is larger than what is left of the allowance. Null when it fits or the usage is not known yet. */
export const refusalBeforeUpload = (
    fileBytes: number,
    usage: DocumentUsage["documents"] | undefined,
): QuotaRefusal | null => {
    if (usage === undefined) return null
    const leftBytes = Math.max(0, usage.limitBytes - usage.usedBytes)
    return fileBytes > leftBytes ? { fileBytes, leftBytes, limitBytes: usage.limitBytes } : null
}

/** What the server's `KNOWLEDGE_SOURCES_QUOTA_EXCEEDED` carries (`extensions.params`), read as a refusal; null when a number is missing. */
export const refusalOfParams = (params: Record<string, unknown> | undefined): QuotaRefusal | null => {
    const fileBytes = params?.fileBytes
    const leftBytes = params?.leftBytes
    const limitBytes = params?.limitBytes
    return typeof fileBytes === "number" && typeof leftBytes === "number" && typeof limitBytes === "number"
        ? { fileBytes, leftBytes, limitBytes }
        : null
}

/** The code of the brain's own refusal of an upload over its 50 MB. */
const BRAIN_QUOTA_CODE = "KNOWLEDGE_SOURCES_QUOTA_EXCEEDED"

/** The code of the plan's storage refusal; it arrives first when the plan's room is gone. */
const PLAN_QUOTA_CODE = "BILLING_STORAGE_QUOTA_EXCEEDED"

/** What a failed upload request says about the allowances. */
export type QuotaFailure = { readonly kind: "brain"; readonly refusal: QuotaRefusal | null } | { readonly kind: "plan" }

/** The extension params of the first error of a combined GraphQL failure. */
const paramsOf = (error: unknown): Record<string, unknown> | undefined => {
    if (typeof error !== "object" || error === null || !("errors" in error) || !Array.isArray(error.errors))
        return undefined
    const first: unknown = error.errors[0]
    if (typeof first !== "object" || first === null || !("extensions" in first)) return undefined
    const extensions: unknown = first.extensions
    if (typeof extensions !== "object" || extensions === null || !("params" in extensions)) return undefined
    const params: unknown = extensions.params
    return typeof params === "object" && params !== null ? Object.fromEntries(Object.entries(params)) : undefined
}

/** Reads a failed upload request as a refusal over the allowance, or null when it was something else. */
export const quotaFailureOf = (code: string | undefined, error: unknown): QuotaFailure | null => {
    if (code === BRAIN_QUOTA_CODE) return { kind: "brain", refusal: refusalOfParams(paramsOf(error)) }
    return code === PLAN_QUOTA_CODE ? { kind: "plan" } : null
}

/** The notice of a refused upload: the file's name, and what was missing. */
export interface RefusalNoticeView {
    readonly title: string
    readonly body: string
    readonly actionLabel: string
}

/** What the notice of a refused file is made from. */
interface RefusalNoticeInput {
    readonly name: string
    readonly failure: QuotaFailure
}

/** The notice the drawer shows for a file refused for room: neutral words, one way to the documents. */
export const refusalNoticeOf = (
    t: LimitsTranslate,
    formatter: SizeFormatter,
    input: RefusalNoticeInput,
): RefusalNoticeView => {
    const { failure } = input
    const body = (() => {
        if (failure.kind === "plan") return t("refusedPlanBody")
        if (failure.refusal === null) return t("refusedBodyUnknown")
        return t("refusedBody", {
            file: sizeOfBytes(formatter, failure.refusal.fileBytes),
            left: sizeOfBytes(formatter, failure.refusal.leftBytes),
            limit: sizeOfBytes(formatter, failure.refusal.limitBytes),
        })
    })()
    return { title: t("refusedTitle", { name: input.name }), body, actionLabel: t("refusedAction") }
}
