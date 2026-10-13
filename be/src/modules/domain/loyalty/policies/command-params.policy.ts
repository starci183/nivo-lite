import type { Segment } from "@modules/domain/loyalty-campaigns"

/** A command with the parameters it needs, read from the row. */
export type LoyaltyCommand =
    | { readonly kind: "adjust"; readonly customerId: string; readonly points: number; readonly reason: string }
    | { readonly kind: "redeem"; readonly customerId: string; readonly rewardId: string }
    | { readonly kind: "sync" }
    | { readonly kind: "preview"; readonly segment: Segment }
    | { readonly kind: "draft"; readonly name: string; readonly brief: string; readonly segment: Segment }
    | { readonly kind: "request_code"; readonly slug: string; readonly phone: string }
    | { readonly kind: "verify_code"; readonly slug: string; readonly phone: string; readonly typed: string }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu

type Params = Readonly<Record<string, unknown>>

const text = (params: Params, key: string, max: number): string => {
    const value = params[key]
    return typeof value === "string" ? value.slice(0, max) : ""
}

const whole = (value: unknown, min: number, max: number): number =>
    typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : 0

const idOf = (params: Params, key: string): string | null => {
    const value = text(params, key, 40)
    return UUID.test(value) ? value : null
}

/** The segment of a preview or a draft: unknown fields are dropped, numbers clamped, tiers capped at eight. */
export const segmentOf = (raw: unknown): Segment => {
    const source: Params = typeof raw === "object" && raw !== null && !Array.isArray(raw) ? Object.fromEntries(Object.entries(raw)) : {}
    const tiers = Array.isArray(source["tiers"])
        ? source["tiers"].filter((tier): tier is string => typeof tier === "string").slice(0, 8)
        : []
    return {
        tiers,
        inactiveDays: whole(source["inactiveDays"], 0, 3650),
        birthdayThisMonth: source["birthdayThisMonth"] === true,
        minSpendVnd: whole(source["minSpendVnd"], 0, 1_000_000_000_000),
    }
}

/** Reads the kind and parameters of a command row; null when a parameter the kind needs is missing or malformed. */
export const commandOf = (kind: string, params: Params): LoyaltyCommand | null => {
    if (kind === "sync") return { kind }
    if (kind === "preview") return { kind, segment: segmentOf(params["segment"]) }
    if (kind === "draft") {
        return { kind, name: text(params, "name", 80), brief: text(params, "brief", 600), segment: segmentOf(params["segment"]) }
    }
    if (kind === "adjust") {
        const customerId = idOf(params, "customerId")
        const points = whole(params["points"], -1_000_000, 1_000_000)
        return customerId === null ? null : { kind, customerId, points, reason: text(params, "reason", 300) }
    }
    if (kind === "redeem") {
        const customerId = idOf(params, "customerId")
        const rewardId = idOf(params, "rewardId")
        return customerId === null || rewardId === null ? null : { kind, customerId, rewardId }
    }
    if (kind === "request_code") return { kind, slug: text(params, "slug", 40), phone: text(params, "phone", 40) }
    if (kind === "verify_code") {
        return { kind, slug: text(params, "slug", 40), phone: text(params, "phone", 40), typed: text(params, "code", 12) }
    }
    return null
}
