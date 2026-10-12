import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LoyaltyRewardsService } from "./loyalty-rewards.service"
import {
    LOCK_REWARD,
    SELECT_ACTIVE_REWARDS,
    SELECT_REWARDS,
    SELECT_REWARD_BY_ID,
    SELECT_REWARD_BY_KEY,
    TAKE_STOCK,
} from "./persistence/loyalty-rewards.sql"

const ROW = {
    id: "r1",
    key: "voucher",
    name: "Voucher",
    kind: "voucher",
    value_vnd: 50000,
    percent: null,
    points_cost: 500,
    stock: 3,
    per_customer_limit: 2,
    min_tier_key: "bac",
    note: "n",
    active: true,
}
const REWARD = {
    id: "r1",
    key: "voucher",
    name: "Voucher",
    kind: "voucher",
    valueVnd: 50000,
    percent: null,
    pointsCost: 500,
    stock: 3,
    perCustomerLimit: 2,
    minTierKey: "bac",
    note: "n",
    active: true,
}

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [LoyaltyRewardsService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(LoyaltyRewardsService)
}

describe("LoyaltyRewardsService", () => {
    describe("list", () => {
        it("reads the whole catalogue or only the rewards that can be redeemed", async () => {
            const entityManager = mockEntityManager({
                query: [
                    [SELECT_REWARDS, [ROW, ROW]],
                    [SELECT_ACTIVE_REWARDS, [ROW]],
                ],
            })
            const rewards = await build(entityManager)

            await expect(rewards.list("ws-1", false)).resolves.toEqual([REWARD, REWARD])
            await expect(rewards.list("ws-1", true)).resolves.toEqual([REWARD])
        })
    })

    describe("byId, byKey and lock", () => {
        it("answer the reward a row holds", async () => {
            const rewards = await build(
                mockEntityManager({
                    query: [
                        [SELECT_REWARD_BY_ID, [ROW]],
                        [SELECT_REWARD_BY_KEY, [ROW]],
                    ],
                }),
            )
            const manager = mockEntityManager({ query: [LOCK_REWARD, [ROW]] })

            await expect(rewards.byId("ws-1", "r1")).resolves.toEqual(REWARD)
            await expect(rewards.byKey("ws-1", "voucher")).resolves.toEqual(REWARD)
            await expect(rewards.lock(manager, "ws-1", "r1")).resolves.toEqual(REWARD)
        })

        it("answer null when there is no such reward", async () => {
            const rewards = await build(
                mockEntityManager({
                    query: [
                        [SELECT_REWARD_BY_ID, []],
                        [SELECT_REWARD_BY_KEY, []],
                    ],
                }),
            )
            const manager = mockEntityManager({ query: [LOCK_REWARD, []] })

            await expect(rewards.byId("ws-1", "zzz")).resolves.toBeNull()
            await expect(rewards.byKey("ws-1", "zzz")).resolves.toBeNull()
            await expect(rewards.lock(manager, "ws-1", "zzz")).resolves.toBeNull()
        })
    })

    describe("takeOne", () => {
        it("takes one unit out of the stock inside the transaction", async () => {
            const manager = mockEntityManager({ query: [TAKE_STOCK, []] })
            const rewards = await build(mockEntityManager())

            await rewards.takeOne(manager, "ws-1", "r1")

            expect(manager.query).toHaveBeenCalledWith(TAKE_STOCK, ["ws-1", "r1"])
        })
    })
})
