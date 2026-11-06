import { DEFAULT_CONFIG } from "./config"
import { redeemBlock, redeemCode, redeemKeyOf, redeemKeyParts } from "./redeem"
import type { LoyaltyReward, RedeemCandidate } from "./reward.types"

const BASE_REWARD: LoyaltyReward = {
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
}
const BASE_CUSTOMER: RedeemCandidate = { points: 600, tierKey: "dong", redeemedBefore: 0 }
const rewardOf = (patch: Partial<LoyaltyReward> = {}): LoyaltyReward => ({ ...BASE_REWARD, ...patch })
const customerOf = (patch: Partial<RedeemCandidate> = {}): RedeemCandidate => ({ ...BASE_CUSTOMER, ...patch })

describe("redeem", () => {
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
            params: { tier: "B\u1ea1c" },
        })
        expect(redeemBlock(DEFAULT_CONFIG, rewardOf({ minTierKey: "gone" }), customerOf({ tierKey: null }))).toBeNull()
        expect(redeemBlock(DEFAULT_CONFIG, rewardOf({ minTierKey: "bac" }), customerOf({ tierKey: "vang" }))).toBeNull()
    })
})

describe("redeemCode", () => {
    it("makes a six character code from the end of the key, padded when the key is short", () => {
        expect(redeemCode("redeem:abc-def-123456")).toBe("QT-123456")
        expect(redeemCode("a1")).toBe("QT-0000A1")
    })
})

describe("the redemption id", () => {
    it("joins the customer and the reward and reads them back", () => {
        expect(redeemKeyOf("m1", "r1")).toBe("m1/r1")
        expect(redeemKeyParts("m1/r1")).toEqual({ memberId: "m1", rewardId: "r1" })
    })

    it("refuses an id that names not both", () => {
        expect(redeemKeyParts("m1")).toBeNull()
        expect(redeemKeyParts("/r1")).toBeNull()
        expect(redeemKeyParts("m1/")).toBeNull()
    })
})
