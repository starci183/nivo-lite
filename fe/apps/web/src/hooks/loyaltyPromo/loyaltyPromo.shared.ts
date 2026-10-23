import type { useTranslations, useFormatter } from "next-intl"
import type { useLoyaltyPromo } from "./useLoyaltyPromo"
import type { BadgeTone } from "@starci/grammar/common"
import { digitsOnly, parseDigits } from "@/hooks/loyalty"

/** Longest offer name the form accepts. */
export const CAMPAIGN_NAME_MAX = 80
/** Longest offer text the form accepts. */
export const CAMPAIGN_BRIEF_MAX = 500

/** Milliseconds the segment must stay still before the live count asks the back end. */
export const PREVIEW_DELAY_MS = 400
/** Milliseconds between two reads of a campaign whose message is being drafted. */
export const DRAFT_POLL_MS = 2000

/** A promotion segment as the back end takes it; an empty condition is 0 / false / no tiers (everyone). */
export interface PromoSegment {
    tiers: Array<string>
    inactiveDays: number
    minSpendVnd: number
    birthdayThisMonth: boolean
}

/** The segment fields as the form holds them (typed text). */
export interface SegmentFields {
    readonly tiers: ReadonlyArray<string>
    readonly inactive: string
    readonly spend: string
    readonly birthday: boolean
}

/** The segment the typed fields stand for. */
export const segmentOf = (fields: SegmentFields): PromoSegment => ({
    tiers: [...fields.tiers],
    inactiveDays: parseDigits(fields.inactive) ?? 0,
    minSpendVnd: parseDigits(fields.spend) ?? 0,
    birthdayThisMonth: fields.birthday,
})

/** The days field: digits only, at most 4. */
export const inactiveText = (value: string): string => digitsOnly(value, 4)

/** The spend field: digits only, at most 10. */
export const spendText = (value: string): string => digitsOnly(value, 10)

/** True while the back end is still writing the message (the campaign has not left `waiting`). */
export const isDrafting = (status: string): boolean => status === "waiting"

/** The catalog key of a campaign status badge. */
export const campaignStatusKey = (status: string): string => {
    if (status === "sending" || status === "done" || status === "failed" || status === "rejected")
        return `campaignStatus_${status}`
    return "campaignStatus_waiting"
}

/** The badge tone of a campaign status. */
export const campaignStatusTone = (status: string): BadgeTone => {
    if (status === "done") return "success"
    if (status === "failed") return "danger"
    if (status === "sending") return "accent"
    if (status === "rejected") return "neutral"
    return "warning"
}

const KNOWN_REASONS = ["quota", "engine_offline", "timeout", "error", "not_configured", "unusable"]

/** The catalog key of the reason a draft failed; an unknown code reads as the generic one. */
export const reasonKey = (errorCode: string | null | undefined): string => {
    const code = (errorCode ?? "").toLowerCase()
    const known = KNOWN_REASONS.find((reason) => code.endsWith(reason))
    return `reason_${known ?? "error"}`
}

/** Resolves count, audience and sample lines for the current segment preview. */
export const promotionPreviewOf = (
    preview: ReturnType<typeof useLoyaltyPromo>["preview"],
    segmentLabel: string,
    t: ReturnType<typeof useTranslations<"loyalty">>,
    format: ReturnType<typeof useFormatter>,
): Array<{ readonly id: string; readonly text: string; readonly emphasis: boolean }> => {
    const previewLines: Array<{ readonly id: string; readonly text: string; readonly emphasis: boolean }> = []
    if (preview.kind === "failed") previewLines.push({ id: "failed", text: t("previewFailed"), emphasis: false })
    if (preview.kind === "loading") previewLines.push({ id: "loading", text: t("previewLoading"), emphasis: false })
    if (preview.kind === "ready") {
        const shown = preview.preview
        previewLines.push(
            {
                id: "count",
                text: t("previewCount", {
                    total: format.number(shown.total),
                    reachable: format.number(shown.reachable),
                }),
                emphasis: true,
            },
            { id: "who", text: t("previewWho", { who: segmentLabel }), emphasis: false },
        )
        if (shown.names.length > 0)
            previewLines.push({
                id: "sample",
                text: t("previewSample", { names: format.list([...shown.names], { type: "unit" }) }),
                emphasis: false,
            })
    }

    return previewLines
}

/** Resolves the generated campaign result or its localized failure. */
export const promotionResultOf = (
    created: ReturnType<typeof useLoyaltyPromo>["created"],
    isWriting: boolean,
    t: ReturnType<typeof useTranslations<"loyalty">>,
    format: ReturnType<typeof useFormatter>,
) => {
    let result:
        | { readonly title: string; readonly recipients: string; readonly time: string; readonly draft: string }
        | undefined
    let failure: string | undefined
    if (created !== null && !isWriting) {
        if (created.status === "failed") failure = t(reasonKey(created.errorCode))
        else {
            const seconds = created.draftMs === null ? null : created.draftMs / 1000
            result = {
                title:
                    seconds === null
                        ? t("createdWaitingTemplate")
                        : t("createdWaiting", { s: Math.max(1, Math.round(seconds)) }),
                recipients: t("createdRecipients", { n: created.recipients }),
                time:
                    seconds === null ? "" : t("draftTime", { s: format.number(seconds, { maximumFractionDigits: 1 }) }),
                draft: created.draft,
            }
        }
    }

    return { result, failure }
}
