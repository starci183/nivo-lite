import type {
    LoyaltyCategoryRule,
    LoyaltyConfig,
    LoyaltyTier,
    NextTierMatch,
    TierKey,
    TierMatch,
} from "../loyalty-programs.contracts"

const TIERS_MAX = 8
const CATEGORIES_MAX = 12
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/u

/** The rules of a programme that never saved any: the numbers of the shop-owner starter, with neutral tier names. */
export const DEFAULT_CONFIG: LoyaltyConfig = {
    earn: { perThousandVnd: 1, perVisit: 0, categories: [], trigger: "payment", minOrderVnd: 0 },
    tiers: [
        { key: "dong", name: "Bronze", minSpendVnd: 0, multiplier: 1, winbackDays: 60, benefit: "" },
        { key: "bac", name: "Silver", minSpendVnd: 3_000_000, multiplier: 1.2, winbackDays: 45, benefit: "" },
        { key: "vang", name: "Gold", minSpendVnd: 10_000_000, multiplier: 1.5, winbackDays: 30, benefit: "" },
    ],
    expiry: { months: 12, warnDays: 30 },
    birthday: { enabled: true, points: 100, rewardKey: "", note: "" },
    promo: { maxPerMonth: 4, hourFrom: "08:00", hourTo: "21:00", batch: 20 },
}

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

const recordOf = (value: unknown): Readonly<Record<string, unknown>> => (isRecord(value) ? value : {})

const listOf = (value: unknown): ReadonlyArray<unknown> => (Array.isArray(value) ? value : [])

const toNumber = (value: unknown): number => {
    if (typeof value === "number") return value
    return typeof value === "string" ? Number(value.replace(/[^\d.-]/gu, "")) : Number.NaN
}

const numberOf = (value: unknown, fallback: number, min: number, max: number): number => {
    const parsed = toNumber(value)
    return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback
}

const textOf = (value: unknown, fallback: string, max: number): string =>
    typeof value === "string" ? value.trim().slice(0, max) : fallback

const clockOf = (value: unknown, fallback: string): string =>
    typeof value === "string" && HHMM.test(value) ? value : fallback

const slugOf = (name: string): string =>
    name
        .normalize("NFD")
        .replace(/\p{M}/gu, "")
        .replace(/\u0111/giu, "d")
        .toLowerCase()
        .replace(/[^a-z0-9]+/gu, "-")
        .replace(/^-+|-+$/gu, "")
        .slice(0, 24) || "tier"

const round2 = (value: number): number => Math.round(value * 100) / 100

const tiersOf = (saved: unknown): ReadonlyArray<LoyaltyTier> => {
    const given = listOf(saved)
    const raw = given.length > 0 ? given : DEFAULT_CONFIG.tiers
    const seen = new Set<string>()
    const tiers = raw.slice(0, TIERS_MAX).map((item, index): LoyaltyTier => {
        const tier = recordOf(item)
        const name = textOf(tier.name, "", 30) || `Tier ${index + 1}`
        let key = textOf(tier.key, "", 24) || slugOf(name)
        while (seen.has(key)) key = `${key}-${index}`
        seen.add(key)
        return {
            key,
            name,
            minSpendVnd: Math.round(numberOf(tier.minSpendVnd, 0, 0, 1e12)),
            multiplier: round2(numberOf(tier.multiplier, 1, 1, 10)),
            winbackDays: Math.round(numberOf(tier.winbackDays, 45, 7, 365)),
            benefit: textOf(tier.benefit, "", 200),
        }
    })
    const sorted = tiers.slice().sort((a, b) => a.minSpendVnd - b.minSpendVnd)
    return sorted.map((tier, index) => (index === 0 ? { ...tier, minSpendVnd: 0 } : tier))
}

const categoriesOf = (saved: unknown): ReadonlyArray<LoyaltyCategoryRule> =>
    (Array.isArray(saved) ? saved : DEFAULT_CONFIG.earn.categories)
        .slice(0, CATEGORIES_MAX)
        .map((item): LoyaltyCategoryRule => {
            const rule = recordOf(item)
            return {
                match: textOf(rule.match, "", 40),
                perThousandVnd: round2(numberOf(rule.perThousandVnd, 1, 0, 1000)),
                label: textOf(rule.label, "", 40),
            }
        })
        .filter((rule) => rule.match !== "")

/** A stored or submitted config laid over the defaults: every number clamped, tiers sorted by threshold with the first starting at zero. Never throws. */
export const resolveConfig = (saved: unknown): LoyaltyConfig => {
    const root = recordOf(saved)
    const earn = recordOf(root.earn)
    const expiry = recordOf(root.expiry)
    const birthday = recordOf(root.birthday)
    const promo = recordOf(root.promo)
    const d = DEFAULT_CONFIG
    return {
        earn: {
            perThousandVnd: round2(numberOf(earn.perThousandVnd, d.earn.perThousandVnd, 0, 1000)),
            perVisit: Math.round(numberOf(earn.perVisit, d.earn.perVisit, 0, 100_000)),
            categories: categoriesOf(earn.categories),
            trigger: earn.trigger === "order" ? "order" : "payment",
            minOrderVnd: Math.round(numberOf(earn.minOrderVnd, d.earn.minOrderVnd, 0, 1e12)),
        },
        tiers: tiersOf(root.tiers),
        expiry: {
            months: Math.round(numberOf(expiry.months, d.expiry.months, 0, 120)),
            warnDays: Math.round(numberOf(expiry.warnDays, d.expiry.warnDays, 1, 180)),
        },
        birthday: {
            enabled:
                birthday.enabled === undefined
                    ? d.birthday.enabled
                    : birthday.enabled === true || birthday.enabled === "true",
            points: Math.round(numberOf(birthday.points, d.birthday.points, 0, 1e6)),
            rewardKey: textOf(birthday.rewardKey, d.birthday.rewardKey, 40),
            note: textOf(birthday.note, d.birthday.note, 200),
        },
        promo: {
            maxPerMonth: Math.round(numberOf(promo.maxPerMonth, d.promo.maxPerMonth, 1, 60)),
            hourFrom: clockOf(promo.hourFrom, d.promo.hourFrom),
            hourTo: clockOf(promo.hourTo, d.promo.hourTo),
            batch: Math.round(numberOf(promo.batch, d.promo.batch, 1, 200)),
        },
    }
}

/** The highest tier whose threshold the lifetime spend reaches, or null when the programme has no tiers. */
export const tierFor = (config: LoyaltyConfig, lifetimeSpendVnd: number): TierMatch =>
    config.tiers.filter((tier) => lifetimeSpendVnd >= tier.minSpendVnd).at(-1) ?? null

/** The tier with a key, or null. */
export const tierOf = (config: LoyaltyConfig, key: TierKey): TierMatch =>
    config.tiers.find((tier) => tier.key === key) ?? null

/** The position of a tier on the ladder, -1 when the key is unknown or empty. */
export const tierRank = (config: LoyaltyConfig, key: TierKey): number =>
    config.tiers.findIndex((tier) => tier.key === key)

/** The next tier above the spend, with the spend still missing, or null at the top. */
export const nextTier = (config: LoyaltyConfig, lifetimeSpendVnd: number): NextTierMatch => {
    const next = config.tiers.find((tier) => tier.minSpendVnd > lifetimeSpendVnd)
    return next === undefined ? null : { tier: next, missingVnd: next.minSpendVnd - lifetimeSpendVnd }
}
