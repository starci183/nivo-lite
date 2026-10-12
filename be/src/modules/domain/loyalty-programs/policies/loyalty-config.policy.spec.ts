import { DEFAULT_CONFIG, nextTier, resolveConfig, tierFor, tierOf, tierRank } from "./loyalty-config.policy"

describe("loyalty-config.policy", () => {
    describe("resolveConfig", () => {
        it("answers the defaults for anything that is not an object", () => {
            expect(resolveConfig(undefined)).toEqual(DEFAULT_CONFIG)
            expect(resolveConfig(null)).toEqual(DEFAULT_CONFIG)
            expect(resolveConfig("text")).toEqual(DEFAULT_CONFIG)
            expect(resolveConfig([1, 2])).toEqual(DEFAULT_CONFIG)
        })

        it("reads the earn rules and clamps every number", () => {
            const config = resolveConfig({
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

        it("keeps the payment trigger for any value but order and limits the categories to twelve", () => {
            const rules = Array.from({ length: 20 }, (_, index) => ({ match: `item${index}`, perThousandVnd: 2 }))

            const config = resolveConfig({ earn: { trigger: "other", categories: rules } })

            expect(config.earn.trigger).toBe("payment")
            expect(config.earn.categories).toHaveLength(12)
        })

        it("falls back to the default categories when the stored value is not a list", () => {
            expect(resolveConfig({ earn: { categories: "none" } }).earn.categories).toEqual([])
        })

        it("sorts the tiers by threshold, starts the first at zero and keeps the keys unique", () => {
            const config = resolveConfig({
                tiers: [
                    { key: "gold", name: "Gold", minSpendVnd: 5000, multiplier: 99, winbackDays: 1, benefit: " b " },
                    { key: "base", name: "Base", minSpendVnd: 100, multiplier: 0.5, winbackDays: 999 },
                    { key: "gold", name: "Gold again", minSpendVnd: 9000 },
                ],
            })

            expect(config.tiers).toEqual([
                { key: "base", name: "Base", minSpendVnd: 0, multiplier: 1, winbackDays: 365, benefit: "" },
                { key: "gold", name: "Gold", minSpendVnd: 5000, multiplier: 10, winbackDays: 7, benefit: "b" },
                { key: "gold-2", name: "Gold again", minSpendVnd: 9000, multiplier: 1, winbackDays: 45, benefit: "" },
            ])
        })

        it("names a tier and builds its key from the name when the owner left them out", () => {
            const config = resolveConfig({ tiers: [{ name: "Đồng Vàng" }, {}, 5] })

            expect(config.tiers.map((tier) => tier.name)).toEqual(["Đồng Vàng", "Tier 2", "Tier 3"])
            expect(config.tiers.map((tier) => tier.key)).toEqual(["dong-vang", "tier-2", "tier-3"])
        })

        it("uses the default ladder for an empty list and at most eight tiers", () => {
            expect(resolveConfig({ tiers: [] }).tiers).toEqual(DEFAULT_CONFIG.tiers)
            const many = Array.from({ length: 12 }, (_, index) => ({
                key: `t${index}`,
                name: `T${index}`,
                minSpendVnd: index,
            }))

            expect(resolveConfig({ tiers: many }).tiers).toHaveLength(8)
        })

        it("falls back to a neutral key for a name with no letters", () => {
            expect(resolveConfig({ tiers: [{ name: "!!!" }] }).tiers[0]?.key).toBe("tier")
        })

        it("reads expiry, birthday and promotion limits", () => {
            const config = resolveConfig({
                expiry: { months: 500, warnDays: 0 },
                birthday: { enabled: "true", points: 50.4, rewardKey: " gift ", note: " hi " },
                promo: { maxPerMonth: 0, hourFrom: "7:00", hourTo: "22:30", batch: 1000 },
            })

            expect(config.expiry).toEqual({ months: 120, warnDays: 1 })
            expect(config.birthday).toEqual({ enabled: true, points: 50, rewardKey: "gift", note: "hi" })
            expect(config.promo).toEqual({ maxPerMonth: 1, hourFrom: "08:00", hourTo: "22:30", batch: 200 })
        })

        it("keeps the birthday switch the owner turned off and the default when it was never set", () => {
            expect(resolveConfig({ birthday: { enabled: false } }).birthday.enabled).toBe(false)
            expect(resolveConfig({ birthday: { enabled: true } }).birthday.enabled).toBe(true)
            expect(resolveConfig({ birthday: {} }).birthday.enabled).toBe(true)
        })

        it("ignores a promotion hour that is not a time", () => {
            expect(resolveConfig({ promo: { hourFrom: 8, hourTo: "25:00" } }).promo).toMatchObject({
                hourFrom: "08:00",
                hourTo: "21:00",
            })
        })
    })

    describe("tier helpers", () => {
        const config = DEFAULT_CONFIG

        it("finds the tier a spend reaches", () => {
            expect(tierFor(config, 0)?.key).toBe("dong")
            expect(tierFor(config, 3_000_000)?.key).toBe("bac")
            expect(tierFor(config, 99_000_000)?.key).toBe("vang")
        })

        it("finds none in a programme without tiers", () => {
            expect(tierFor({ ...config, tiers: [] }, 100)).toBeNull()
        })

        it("finds a tier by key and its rank on the ladder", () => {
            expect(tierOf(config, "bac")?.name).toBe("Silver")
            expect(tierOf(config, "nope")).toBeNull()
            expect(tierOf(config, null)).toBeNull()
            expect(tierRank(config, "vang")).toBe(2)
            expect(tierRank(config, null)).toBe(-1)
        })

        it("tells the next tier and the spend still missing", () => {
            expect(nextTier(config, 1_000_000)).toEqual({ tier: config.tiers[1], missingVnd: 2_000_000 })
            expect(nextTier(config, 50_000_000)).toBeNull()
        })
    })
})
