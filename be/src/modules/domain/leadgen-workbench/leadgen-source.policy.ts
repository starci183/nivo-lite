import type { LeadGenOrigin, LeadGenPlatform, LeadGenScore, LeadGenSourceKind } from "./leadgen-workbench.contracts"

/** Source fields a capture or scoring proposal stored. */
type LeadGenFields = Readonly<Record<string, unknown>>
const SCORE_KEYS = ["score", "lead_score", "temperature", "rating", "grade"] as const
const SCORE_WORDS: Readonly<Record<string, LeadGenScore>> = {
    hot: "hot",
    nong: "hot",
    warm: "warm",
    am: "warm",
    cold: "cold",
    lanh: "cold",
}

/** Reads a defensively stored source field as text. */
export const sourceText = (value: unknown): string => {
    if (typeof value === "string") return value.trim()
    return typeof value === "number" ? String(value) : ""
}

const plain = (value: string): string => value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()

/** The first populated field among known historical names. */
export const firstSourceText = (fields: LeadGenFields, keys: ReadonlyArray<string>): string => {
    for (const key of keys) {
        const value = sourceText(fields[key])
        if (value) return value
    }
    return ""
}

/** Clips a stored message to one readable summary line. */
export const clipLeadText = (value: string, length = 140): string => {
    const flat = value.replace(/\s+/gu, " ").trim()
    return flat.length > length ? `${flat.slice(0, length - 1).trimEnd()}…` : flat
}

/** The platform named by any stored source hints. */
export const leadPlatformOf = (...hints: ReadonlyArray<string>): LeadGenPlatform => {
    const joined = hints.join(" ").toLowerCase()
    if (joined.includes("instagram") || /\big\b/u.test(joined)) return "instagram"
    if (joined.includes("facebook") || joined.includes("messenger") || joined.includes("meta")) return "facebook"
    return "other"
}

const sourceKindOf = (raw: string, channelLabel: string): LeadGenSourceKind => {
    const joined = plain(`${raw} ${channelLabel}`)
    if (/lead[\s_-]?ad|leadgen|form/u.test(joined)) return "lead_ad"
    if (/comment|binh luan/u.test(joined)) return "comment"
    if (/mention|nhac/u.test(joined)) return "mention"
    if (/\bdm\b|message|messenger|inbox|postback|tin nhan/u.test(joined)) return "dm"
    return "other"
}

/** The score stored under one of the historical scoring keys. */
export const leadScoreOf = (fields: LeadGenFields): LeadGenScore | null => {
    for (const key of SCORE_KEYS) {
        const score = SCORE_WORDS[plain(sourceText(fields[key]))]
        if (score) return score
    }
    return null
}

const refKindOf = (ad: string, form: string, post: string): LeadGenOrigin["refKind"] => {
    if (ad) return "ad"
    if (form) return "form"
    return post ? "post" : null
}

/** The platform, capture kind and reference of a lead's source. */
export const leadOriginOf = (fields: LeadGenFields, channelLabel: string, fallbackChannel: string): LeadGenOrigin => {
    const label = channelLabel || fallbackChannel
    const platform = leadPlatformOf(firstSourceText(fields, ["platform", "network"]), label, fallbackChannel)
    const kind = sourceKindOf(
        firstSourceText(fields, ["source_kind", "source_type", "capture_kind", "kind", "reason", "source"]),
        label,
    )
    const post = firstSourceText(fields, ["post_id", "media_id", "post"])
    const ad = firstSourceText(fields, ["ad_id", "ad"])
    const form = firstSourceText(fields, ["form_id", "leadgen_form_id", "form"])
    const refKind = refKindOf(ad, form, post)
    const refId = ad || form || post || null
    const refLabel =
        firstSourceText(fields, ["source_label", "post_title", "post_name", "ad_name", "form_name", "campaign_name"]) ||
        null
    return { platform, kind, refKind, refId, refLabel }
}
