import { builder } from "@starci/jest-preset"
import type { LoyaltyConfig } from "@modules/domain/loyalty-programs"
import type { LoyaltyReward, RedeemCandidate } from "../loyalty-rewards.contracts"
import { redeemBlock } from "./redeem.policy"

const DEFAULT_CONFIG: LoyaltyConfig = {
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
const rewardOf = builder<LoyaltyReward>({
    id: "r1",
    key: "voucher",
    name: "Voucher",
    kind: "voucher",
    valueVnd: 50000,
    percent: null,
    pointsCost: 500,
    stock: null,
    perCustomerLimit: null,
    minTierKey: null,
    note: "",
    active: true,
})
const customerOf = builder<RedeemCandidate>({ points: 600, tierKey: "dong", redeemedBefore: 0 })

describe("redeem.policy", () => {
    it("lets a customer with enough points redeem an open reward", () => {
        expect(redeemBlock(DEFAULT_CONFIG, rewardOf(), customerOf())).toBeNull()
        expect(
            redeemBlock(DEFAULT_CONFIG, rewardOf({ stock: 3, perCustomerLimit: 2 }), customerOf({ redeemedBefore: 1 })),
        ).toBeNull()
    })

    it("refuses a paused reward", () => {
        expect(redeemBlock(DEFAULT_CONFIG, rewardOf({ active: false }), customerOf())).toEqual({
            code: "inactive",
            params: {},
        })
    })

    it("refuses a reward that is out of stock", () => {
        expect(redeemBlock(DEFAULT_CONFIG, rewardOf({ stock: 0 }), customerOf())).toEqual({
            code: "out_of_stock",
            params: {},
        })
    })

    it("refuses a customer with too few points and says how many", () => {
        expect(redeemBlock(DEFAULT_CONFIG, rewardOf(), customerOf({ points: 100 }))).toEqual({
            code: "not_enough_points",
            params: { cost: 500, points: 100 },
        })
    })

    it("refuses a customer who reached the limit of the reward", () => {
        expect(
            redeemBlock(DEFAULT_CONFIG, rewardOf({ perCustomerLimit: 2 }), customerOf({ redeemedBefore: 2 })),
        ).toEqual({
            code: "limit_reached",
            params: { limit: 2 },
        })
    })

    it("refuses a customer below the tier the reward needs and names the tier", () => {
        expect(redeemBlock(DEFAULT_CONFIG, rewardOf({ minTierKey: "bac" }), customerOf())).toEqual({
            code: "tier_required",
            params: { tier: "Silver" },
        })
        expect(redeemBlock(DEFAULT_CONFIG, rewardOf({ minTierKey: "gone" }), customerOf({ tierKey: null }))).toBeNull()
        expect(redeemBlock(DEFAULT_CONFIG, rewardOf({ minTierKey: "bac" }), customerOf({ tierKey: "vang" }))).toBeNull()
    })
})
