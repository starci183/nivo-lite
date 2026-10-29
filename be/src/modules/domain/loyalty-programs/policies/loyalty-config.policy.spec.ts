import { Test } from "@nestjs/testing"

import { DEFAULT_CONFIG, nextTier, resolveConfig, tierFor, tierByKey, tierRank } from "./loyalty-config.policy"

const SUBJECT = Symbol("loyalty-config.policy")

type PolicySubject = {
    resolveConfig: typeof resolveConfig
    tierFor: typeof tierFor
    tierByKey: typeof tierByKey
    tierRank: typeof tierRank
    nextTier: typeof nextTier
}

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    resolveConfig,
                    tierFor,
                    tierByKey,
                    tierRank,
                    nextTier,
                },
            },
        ],
    }).compile()
    const subject = moduleRef.get<PolicySubject>(SUBJECT)

    return { subject }
}

describe("loyalty-config.policy", () => {
    describe("resolveConfig", () => {
        it("answers the defaults for anything that is not an object", async () => {
            const { subject } = await buildSubject()

            expect(subject.resolveConfig(undefined)).toEqual(DEFAULT_CONFIG)
            expect(subject.resolveConfig(null)).toEqual(DEFAULT_CONFIG)
            expect(subject.resolveConfig("text")).toEqual(DEFAULT_CONFIG)
            expect(subject.resolveConfig([1, 2])).toEqual(DEFAULT_CONFIG)
        })

        it("reads the earn rules and clamps every number", async () => {
            const { subject } = await buildSubject()

            const config = subject.resolveConfig({
                earn: {
                    perThousandVnd: "2,5",
                    perVisit: 9_999_999,
                    minOrderVnd: -5,
                    trigger: "order",
                    categories: [
                        { match: " coffee ", perThousandVnd: 3.456, label: "Drinks" },
                        { match: "", perThousandVnd: 5 },
                        { match: "tea", perThousandVnd: "x" },
                        "not a rule",
                    ],
                },
            })

            expect(config.earn).toEqual({
                perThousandVnd: 25,
                perVisit: 100_000,
                trigger: "order",
                minOrderVnd: 0,
                categories: [
                    { match: "coffee", perThousandVnd: 3.46, label: "Drinks" },
                    { match: "tea", perThousandVnd: 0, label: "" },
                ],
            })
        })

        it("keeps the payment trigger for any value but order and limits the categories to twelve", async () => {
            const { subject } = await buildSubject()

            const rules = Array.from({ length: 20 }, (_, index) => ({ match: `item${index}`, perThousandVnd: 2 }))

            const config = subject.resolveConfig({ earn: { trigger: "other", categories: rules } })

            expect(config.earn.trigger).toBe("payment")
            expect(config.earn.categories).toHaveLength(12)
        })

        it("falls back to the default categories when the stored value is not a list", async () => {
            const { subject } = await buildSubject()

            expect(subject.resolveConfig({ earn: { categories: "none" } }).earn.categories).toEqual([])
        })
    })
})

describe("loyalty-config.policy", () => {
    describe("resolveConfig", () => {
        it("sorts the tiers by threshold, starts the first at zero and keeps the keys unique", async () => {
            const { subject } = await buildSubject()

            const config = subject.resolveConfig({
                tiers: [
                    {
                        key: "gold",
                        name: "Gold",
                        minSpendVnd: 5000,
                        multiplier: 99,
                        winbackDays: 1,
                        benefit: " b ",
                    },
                    { key: "base", name: "Base", minSpendVnd: 100, multiplier: 0.5, winbackDays: 999 },
                    { key: "gold", name: "Gold again", minSpendVnd: 9000 },
                ],
            })

            expect(config.tiers).toEqual([
                { key: "base", name: "Base", minSpendVnd: 0, multiplier: 1, winbackDays: 365, benefit: "" },
                { key: "gold", name: "Gold", minSpendVnd: 5000, multiplier: 10, winbackDays: 7, benefit: "b" },
                {
                    key: "gold-2",
                    name: "Gold again",
                    minSpendVnd: 9000,
                    multiplier: 1,
                    winbackDays: 45,
                    benefit: "",
                },
            ])
        })
        it("names a tier and builds its key from the name when the owner left them out", async () => {
            const { subject } = await buildSubject()

            const config = subject.resolveConfig({ tiers: [{ name: "Año Gold" }, {}, 5] })

            expect(config.tiers.map((tier) => tier.name)).toEqual(["Año Gold", "Tier 2", "Tier 3"])
            expect(config.tiers.map((tier) => tier.key)).toEqual(["ano-gold", "tier-2", "tier-3"])
        })
        it("uses the default ladder for an empty list and at most eight tiers", async () => {
            const { subject } = await buildSubject()

            expect(subject.resolveConfig({ tiers: [] }).tiers).toEqual(DEFAULT_CONFIG.tiers)
            const many = Array.from({ length: 12 }, (_, index) => ({
                key: `t${index}`,
                name: `T${index}`,
                minSpendVnd: index,
            }))

            expect(subject.resolveConfig({ tiers: many }).tiers).toHaveLength(8)
        })
        it("falls back to a neutral key for a name with no letters", async () => {
            const { subject } = await buildSubject()

            expect(subject.resolveConfig({ tiers: [{ name: "!!!" }] }).tiers[0]?.key).toBe("tier")
        })
    })
})

describe("loyalty-config.policy", () => {
    describe("resolveConfig", () => {
        it("reads expiry, birthday and promotion limits", async () => {
            const { subject } = await buildSubject()

            const config = subject.resolveConfig({
                expiry: { months: 500, warnDays: 0 },
                birthday: { enabled: "true", points: 50.4, rewardKey: " gift ", note: " hi " },
                promo: { maxPerMonth: 0, hourFrom: "7:00", hourTo: "22:30", batch: 1000 },
            })

            expect(config.expiry).toEqual({ months: 120, warnDays: 1 })
            expect(config.birthday).toEqual({ enabled: true, points: 50, rewardKey: "gift", note: "hi" })
            expect(config.promo).toEqual({ maxPerMonth: 1, hourFrom: "08:00", hourTo: "22:30", batch: 200 })
        })
        it("keeps the birthday switch the owner turned off and the default when it was never set", async () => {
            const { subject } = await buildSubject()

            expect(subject.resolveConfig({ birthday: { enabled: false } }).birthday.enabled).toBe(false)
            expect(subject.resolveConfig({ birthday: { enabled: true } }).birthday.enabled).toBe(true)
            expect(subject.resolveConfig({ birthday: {} }).birthday.enabled).toBe(true)
        })
    })
})

describe("loyalty-config.policy", () => {
    describe("resolveConfig", () => {
        it("ignores a promotion hour that is not a time", async () => {
            const { subject } = await buildSubject()

            expect(subject.resolveConfig({ promo: { hourFrom: 8, hourTo: "25:00" } }).promo).toMatchObject({
                hourFrom: "08:00",
                hourTo: "21:00",
            })
        })
    })

    describe("tier helpers", () => {
        const config = DEFAULT_CONFIG

        it("finds the tier a spend reaches", async () => {
            const { subject } = await buildSubject()

            expect(subject.tierFor(config, 0)?.key).toBe("dong")
            expect(subject.tierFor(config, 3_000_000)?.key).toBe("bac")
            expect(subject.tierFor(config, 99_000_000)?.key).toBe("vang")
        })

        it("finds none in a programme without tiers", async () => {
            const { subject } = await buildSubject()

            expect(subject.tierFor({ ...config, tiers: [] }, 100)).toBeNull()
        })

        it("finds a tier by key and its rank on the ladder", async () => {
            const { subject } = await buildSubject()

            expect(subject.tierByKey(config, "bac")?.name).toBe("Silver")
            expect(subject.tierByKey(config, "nope")).toBeNull()
            expect(subject.tierByKey(config, null)).toBeNull()
            expect(subject.tierRank(config, "vang")).toBe(2)
            expect(subject.tierRank(config, null)).toBe(-1)
        })

        it("tells the next tier and the spend still missing", async () => {
            const { subject } = await buildSubject()

            expect(subject.nextTier(config, 1_000_000)).toEqual({ tier: config.tiers[1], missingVnd: 2_000_000 })
            expect(subject.nextTier(config, 50_000_000)).toBeNull()
        })
    })
})

describe("loyalty tier key normalization boundaries", () => {
    it("collapses long punctuation runs before trimming the key", async () => {
        const { subject } = await buildSubject()
        const config = subject.resolveConfig({ tiers: [{ name: "!".repeat(20000) }] })
        expect(config.tiers[0]?.key).toBe("tier")
    })
})
