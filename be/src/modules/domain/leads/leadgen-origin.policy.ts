import type { LeadOrigin, LeadPlatform, LeadScore, LeadSourceKind } from "./leadgen-workbench.contracts"

type Fields = Record<string, unknown>

const SCORE_KEYS = ["score", "lead_score", "temperature", "rating", "grade"] as const

/** Reads a trimmed text value defensively from a proposal field. */
export const text = (value: unknown): string => {
    if (typeof value === "string") return value.trim()
    return typeof value === "number" ? String(value) : ""
}

/** Lower case without the marks above letters, so a word matches however it was typed. */
const plain = (value: string): string => value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()

/** The first nonempty value under a known capture-field name. */
export const firstText = (fields: Fields, keys: ReadonlyArray<string>): string => {
    for (const key of keys) {
        const value = text(fields[key])
        if (value) return value
    }
    return ""
}

/** Collapses whitespace and clips workbench preview text. */
export const clip = (value: string, n = 140): string => {
    const flat = value.replace(/\s+/g, " ").trim()
    return flat.length > n ? `${flat.slice(0, n - 1).trimEnd()}…` : flat
}

/** Infers the source network from stored labels. */
export const platformOf = (...hints: ReadonlyArray<string>): LeadPlatform => {
    const joined = hints.join(" ").toLowerCase()
    if (joined.includes("instagram") || /\big\b/.test(joined)) return "instagram"
    if (joined.includes("facebook") || joined.includes("messenger") || joined.includes("meta")) return "facebook"
    return "other"
}

const kindOf = (raw: string, channelLabel: string): LeadSourceKind => {
    const joined = plain(`${raw} ${channelLabel}`)
    if (/lead[\s_-]?ad|leadgen|form/.test(joined)) return "lead_ad"
    if (/comment|binh luan/.test(joined)) return "comment"
    if (/mention|nhac/.test(joined)) return "mention"
    if (/\bdm\b|message|messenger|inbox|postback|tin nhan/.test(joined)) return "dm"
    return "other"
}

const SCORE_WORDS: Readonly<Record<string, LeadScore>> = {
    hot: "hot",
    nong: "hot",
    warm: "warm",
    am: "warm",
    cold: "cold",
    lanh: "cold",
}

const scoreOf = (value: unknown): LeadScore | null => SCORE_WORDS[plain(text(value))] ?? null

/** Reads the latest stored temperature of a prospect. */
export const scoreFromFields = (fields: Fields): LeadScore | null => {
    for (const key of SCORE_KEYS) {
        const score = scoreOf(fields[key])
        if (score) return score
    }
    return null
}

const refKindOf = (ad: string, form: string, post: string): LeadOrigin["refKind"] => {
    if (ad) return "ad"
    if (form) return "form"
    return post ? "post" : null
}

/** Derives source attribution from the existing capture proposal. */
export const originOf = (fields: Fields, channelLabel: string, fallbackChannel: string): LeadOrigin => {
    const label = channelLabel || fallbackChannel
    const platform = platformOf(firstText(fields, ["platform", "network"]), label, fallbackChannel)
    const kind = kindOf(
        firstText(fields, ["source_kind", "source_type", "capture_kind", "kind", "reason", "source"]),
        label,
    )
    const post = firstText(fields, ["post_id", "media_id", "post"])
    const ad = firstText(fields, ["ad_id", "ad"])
    const form = firstText(fields, ["form_id", "leadgen_form_id", "form"])
    const refKind = refKindOf(ad, form, post)
    const refId = ad || form || post || null
    const refLabel =
        firstText(fields, ["source_label", "post_title", "post_name", "ad_name", "form_name", "campaign_name"]) || null
    return { platform, kind, refKind, refId, refLabel }
}
