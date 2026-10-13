import type { LoyaltyReward } from "@modules/domain/loyalty-rewards"
import { rewardLineParams } from "./chat-brief.policy"

const reward: LoyaltyReward = {
    id: "r-1",
    key: "coffee",
    name: "Coffee",
    kind: "item",
    valueVnd: 30000,
    percent: null,
    pointsCost: 100,
    stock: null,
    perCustomerLimit: 2,
    minTierKey: null,
    note: "",
    active: true,
}

describe("rewardLineParams", () => {
    it("lists the key, the cost and the limits, with a dash for none", () => {
        expect(rewardLineParams(reward)).toEqual({
            key: "coffee",
            name: "Coffee",
            cost: 100,
            value: 30000,
            limit: 2,
            stock: "-",
            tier: "-",
            note: "-",
        })
    })
})
