import { Test } from "@nestjs/testing"
import { fakeTransaction, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LoyaltyRewardsService } from "./loyalty-rewards.service"
import type { RewardEdit } from "./loyalty-rewards.contracts"
import {
    LOCK_REWARD,
    SELECT_ACTIVE_REWARDS,
    SELECT_REWARDS,
    SELECT_REWARD_BY_ID,
    SELECT_REWARD_BY_KEY,
    TAKE_STOCK,
    UPDATE_REWARD,
    INSERT_REWARD,
    DELETE_REWARD,
    INSERT_REWARD_PRESETS,
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

const EDIT: RewardEdit = {
    name: " Voucher ",
    kind: "voucher",
    valueVnd: 50000,
    percent: null,
    pointsCost: 500,
    stock: 3,
    perCustomerLimit: 2,
    minTierKey: " bac ",
    note: " n ",
    active: true,
}
const FIELDS = ["Voucher", "voucher", 50000, null, 500, 3, 2, "bac", "n", true]

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

    describe("save", () => {
        it("updates the existing reward with bounded and trimmed fields", async () => {
            const entityManager = mockEntityManager({ query: [UPDATE_REWARD, [ROW]] })
            const rewards = await build(entityManager)

            await expect(rewards.save("ws-1", { ...EDIT, id: "r1" })).resolves.toEqual(REWARD)

            expect(entityManager.query).toHaveBeenCalledWith(UPDATE_REWARD, ["ws-1", "r1", ...FIELDS])
        })

        it("reports a reward that disappeared before the update", async () => {
            const entityManager = mockEntityManager({ query: [UPDATE_REWARD, []] })
            const rewards = await build(entityManager)

            await expect(rewards.save("ws-1", { ...EDIT, id: "r1" })).resolves.toBeNull()

            expect(entityManager.query).toHaveBeenCalledWith(UPDATE_REWARD, ["ws-1", "r1", ...FIELDS])
        })

        it.each([
            { key: undefined, expectedKey: "voucher" },
            { key: "   ", expectedKey: "voucher" },
            { key: " \u0110\u1ed5i qu\u00e0 ", expectedKey: "doi-qua" },
        ])("allocates a new reward key from $key", async ({ key, expectedKey }) => {
            const entityManager = mockEntityManager({ query: [INSERT_REWARD, [ROW]] })
            const rewards = await build(entityManager)

            await expect(rewards.save("ws-1", { ...EDIT, key })).resolves.toEqual(REWARD)

            expect(entityManager.query).toHaveBeenCalledWith(INSERT_REWARD, [
                "ws-1",
                expectedKey,
                ...FIELDS,
                100,
                false,
            ])
        })

        it("retries a colliding key with a suffix and advancing display order", async () => {
            const entityManager = mockEntityManager()
            entityManager.query.mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([ROW])
            const rewards = await build(entityManager)

            await expect(rewards.save("ws-1", EDIT)).resolves.toEqual(REWARD)

            expect(entityManager.query.mock.calls).toEqual([
                [INSERT_REWARD, ["ws-1", "voucher", ...FIELDS, 100, false]],
                [INSERT_REWARD, ["ws-1", "voucher", ...FIELDS, 101, true]],
                [INSERT_REWARD, ["ws-1", "voucher", ...FIELDS, 102, true]],
            ])
        })

        it("returns null after four unsuccessful key allocations", async () => {
            const entityManager = mockEntityManager({ query: [INSERT_REWARD, []] })
            const rewards = await build(entityManager)

            await expect(rewards.save("ws-1", EDIT)).resolves.toBeNull()

            expect(entityManager.query.mock.calls).toEqual([
                [INSERT_REWARD, ["ws-1", "voucher", ...FIELDS, 100, false]],
                [INSERT_REWARD, ["ws-1", "voucher", ...FIELDS, 101, true]],
                [INSERT_REWARD, ["ws-1", "voucher", ...FIELDS, 102, true]],
                [INSERT_REWARD, ["ws-1", "voucher", ...FIELDS, 103, true]],
            ])
        })
    })

    describe("remove", () => {
        it("commits without removing anything when the reward is missing", async () => {
            const entityManager = mockEntityManager({ query: [LOCK_REWARD, []] })
            const transaction = fakeTransaction(entityManager)
            const rewards = await build(entityManager)

            await expect(rewards.remove("ws-1", "gone")).resolves.toBe("missing")

            expect(entityManager.query.mock.calls).toEqual([[LOCK_REWARD, ["ws-1", "gone"]]])
            expect(transaction.outcomes).toEqual(["commit"])
        })

        it.each(["deleted", "retired"] as const)("returns the committed %s outcome", async (outcome) => {
            const entityManager = mockEntityManager({
                query: [
                    [LOCK_REWARD, [ROW]],
                    [DELETE_REWARD, [{ outcome }]],
                ],
            })
            const transaction = fakeTransaction(entityManager)
            const rewards = await build(entityManager)

            await expect(rewards.remove("ws-1", "r1")).resolves.toBe(outcome)

            expect(entityManager.query.mock.calls).toEqual([
                [LOCK_REWARD, ["ws-1", "r1"]],
                [DELETE_REWARD, ["ws-1", "r1"]],
            ])
            expect(transaction.outcomes).toEqual(["commit"])
        })

        it("reports missing when the removal statement returns no outcome", async () => {
            const entityManager = mockEntityManager({
                query: [
                    [LOCK_REWARD, [ROW]],
                    [DELETE_REWARD, []],
                ],
            })
            const transaction = fakeTransaction(entityManager)
            const rewards = await build(entityManager)

            await expect(rewards.remove("ws-1", "r1")).resolves.toBe("missing")

            expect(entityManager.query).toHaveBeenCalledWith(DELETE_REWARD, ["ws-1", "r1"])
            expect(transaction.outcomes).toEqual(["commit"])
        })
    })

    describe("addPresets", () => {
        it("serializes every preset field in display order and counts the inserted rows", async () => {
            const entityManager = mockEntityManager({ query: [INSERT_REWARD_PRESETS, [{ id: "r1" }, { id: "r2" }]] })
            const rewards = await build(entityManager)
            const first: RewardEdit = { ...EDIT, key: "voucher", name: "Voucher", minTierKey: "bac", note: "n" }
            const second: RewardEdit = {
                ...first,
                key: "discount",
                kind: "percent",
                percent: 10,
                stock: null,
                perCustomerLimit: null,
                minTierKey: null,
            }

            await expect(rewards.addPresets("ws-1", [first, second])).resolves.toBe(2)

            expect(entityManager.query).toHaveBeenCalledWith(INSERT_REWARD_PRESETS, [
                "ws-1",
                JSON.stringify([
                    {
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
                        sort_order: 100,
                    },
                    {
                        key: "discount",
                        name: "Voucher",
                        kind: "percent",
                        value_vnd: 50000,
                        percent: 10,
                        points_cost: 500,
                        stock: null,
                        per_customer_limit: null,
                        min_tier_key: null,
                        note: "n",
                        sort_order: 101,
                    },
                ]),
            ])
        })

        it("returns zero when no presets were inserted", async () => {
            const entityManager = mockEntityManager({ query: [INSERT_REWARD_PRESETS, []] })
            const rewards = await build(entityManager)

            await expect(rewards.addPresets("ws-1", [])).resolves.toBe(0)

            expect(entityManager.query).toHaveBeenCalledWith(INSERT_REWARD_PRESETS, ["ws-1", "[]"])
        })
    })
})
