import { evaluatedValues } from "@tests/fixtures/builders/evaluated-calls.builder"
import { Test } from "@nestjs/testing"
import { IsNull, Not } from "typeorm"
import { builder, fakeTransaction, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { LoyaltyRewardsService } from "./loyalty-rewards.service"
import type { RewardEdit } from "./loyalty-rewards.contracts"
import { LoyaltyRewardEntity } from "./persistence/entities"
import type { RewardRaw } from "./policies/reward.mapper"

/** The SQL a retried key is written with, read by calling the expression the insert was handed. */
const SUFFIXED_KEY_SQL = "CAST(:wantedKey AS text) || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 4)"

const entityOf = builder<LoyaltyRewardEntity>({
    id: "r1",
    workspaceId: "ws-1",
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
    sortOrder: 100,
    createdAt: new Date("2026-10-01T00:00:00.000Z"),
})
const rawOf = builder<RewardRaw>({
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
})
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
const FIELDS = {
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

describe("LoyaltyRewardsService list", () => {
    it("reads the whole catalogue or only the rewards that can be redeemed", async () => {
        const entityManager = mockEntityManager({
            find: [
                [LoyaltyRewardEntity, [entityOf(), entityOf()]],
                [LoyaltyRewardEntity, [entityOf()]],
            ],
        })
        const rewards = await build(entityManager)

        await expect(rewards.list("ws-1", false)).resolves.toEqual([REWARD, REWARD])
        await expect(rewards.list("ws-1", true)).resolves.toEqual([REWARD])
        expect(entityManager.find.mock.calls.map(([, options]) => options)).toEqual([
            { where: { workspaceId: "ws-1" }, order: { sortOrder: "ASC", pointsCost: "ASC" }, take: 200 },
            {
                where: { workspaceId: "ws-1", active: true },
                order: { sortOrder: "ASC", pointsCost: "ASC" },
                take: 200,
            },
        ])
    })
})

describe("LoyaltyRewardsService byId, byKey and lock", () => {
    it("answer the reward a row holds", async () => {
        const entityManager = mockEntityManager({ findOne: [LoyaltyRewardEntity, entityOf()] })
        const rewards = await build(entityManager)
        const manager = mockEntityManager({ findOne: [LoyaltyRewardEntity, entityOf()] })

        await expect(rewards.byId("ws-1", "r1")).resolves.toEqual(REWARD)
        await expect(rewards.byKey("ws-1", "voucher")).resolves.toEqual(REWARD)
        await expect(rewards.lock(manager, "ws-1", "r1")).resolves.toEqual(REWARD)
        expect(entityManager.findOne.mock.calls.map(([, options]) => options)).toEqual([
            { where: { workspaceId: "ws-1", id: "r1" } },
            { where: { workspaceId: "ws-1", key: "voucher", active: true } },
        ])
        expect(manager.findOne.mock.calls.map(([, options]) => options)).toEqual([
            { where: { workspaceId: "ws-1", id: "r1" }, lock: { mode: "pessimistic_write" } },
        ])
    })

    it("answer null when there is no such reward", async () => {
        const rewards = await build(mockEntityManager({ findOne: [LoyaltyRewardEntity, null] }))
        const manager = mockEntityManager({ findOne: [LoyaltyRewardEntity, null] })

        await expect(rewards.byId("ws-1", "zzz")).resolves.toBeNull()
        await expect(rewards.byKey("ws-1", "zzz")).resolves.toBeNull()
        await expect(rewards.lock(manager, "ws-1", "zzz")).resolves.toBeNull()
    })
})

describe("LoyaltyRewardsService takeOne", () => {
    it("takes one unit out of the stock inside the transaction", async () => {
        const manager = mockEntityManager({ decrement: [LoyaltyRewardEntity, {}] })
        const rewards = await build(mockEntityManager())

        await rewards.takeOne(manager, "ws-1", "r1")

        expect(manager.decrement).toHaveBeenCalledWith(
            LoyaltyRewardEntity,
            { workspaceId: "ws-1", id: "r1", stock: Not(IsNull()) },
            "stock",
            1,
        )
    })
})

describe("LoyaltyRewardsService save", () => {
    it("updates the existing reward with bounded and trimmed fields", async () => {
        const entityManager = mockEntityManager()
        const [update] = queueQueryBuilders(entityManager, [{ execute: { raw: [rawOf()] } }])
        const rewards = await build(entityManager)

        await expect(rewards.save("ws-1", { ...EDIT, id: "r1" })).resolves.toEqual(REWARD)

        expect(update?.callsOf("update")).toEqual([[]])
        expect(update?.callsOf("set")).toEqual([[FIELDS]])
        expect(update?.callsOf("where")).toEqual([
            ["workspace_id = :workspaceId AND id = :id", { workspaceId: "ws-1", id: "r1" }],
        ])
        expect(update?.callsOf("returning")[0]?.[0]).toContain("value_vnd::float8 AS value_vnd")
    })

    it("reports a reward that disappeared before the update", async () => {
        const entityManager = mockEntityManager()
        queueQueryBuilders(entityManager, [{ execute: { raw: [] } }])
        const rewards = await build(entityManager)

        await expect(rewards.save("ws-1", { ...EDIT, id: "r1" })).resolves.toBeNull()
    })

    it.each([
        { key: undefined, expectedKey: "voucher" },
        { key: "   ", expectedKey: "voucher" },
        { key: " \u0110\u1ed5i qu\u00e0 ", expectedKey: "doi-qua" },
    ])("allocates a new reward key from $key", async ({ key, expectedKey }) => {
        const entityManager = mockEntityManager()
        const [insert] = queueQueryBuilders(entityManager, [{ execute: { raw: [rawOf()] } }])
        const rewards = await build(entityManager)

        await expect(rewards.save("ws-1", { ...EDIT, key })).resolves.toEqual(REWARD)

        expect(insert?.callsOf("values")).toEqual([
            [{ ...FIELDS, workspaceId: "ws-1", key: expectedKey, sortOrder: 100 }],
        ])
        expect(insert?.callsOf("orIgnore")).toHaveLength(1)
        expect(insert?.callsOf("setParameter")).toEqual([["wantedKey", expectedKey]])
    })
})

describe("LoyaltyRewardsService save retries", () => {
    it("retries a colliding key with a suffix and advancing display order", async () => {
        const entityManager = mockEntityManager()
        const attempts = queueQueryBuilders(entityManager, [
            { execute: { raw: [] } },
            { execute: { raw: [] } },
            { execute: { raw: [rawOf()] } },
        ])
        const rewards = await build(entityManager)

        await expect(rewards.save("ws-1", EDIT)).resolves.toEqual(REWARD)

        const written = attempts.map((attempt) => attempt.callsOf("values")[0]?.[0]).map(evaluatedValues)
        expect(written).toEqual([
            { ...FIELDS, workspaceId: "ws-1", key: "voucher", sortOrder: 100 },
            { ...FIELDS, workspaceId: "ws-1", key: SUFFIXED_KEY_SQL, sortOrder: 101 },
            { ...FIELDS, workspaceId: "ws-1", key: SUFFIXED_KEY_SQL, sortOrder: 102 },
        ])
    })

    it("returns null after four unsuccessful key allocations", async () => {
        const entityManager = mockEntityManager()
        const attempts = queueQueryBuilders(entityManager, [
            { execute: { raw: [] } },
            { execute: { raw: [] } },
            { execute: { raw: [] } },
            { execute: { raw: [] } },
        ])
        const rewards = await build(entityManager)

        await expect(rewards.save("ws-1", EDIT)).resolves.toBeNull()

        expect(attempts.map((attempt) => attempt.callsOf("values")[0]?.[0])).toMatchObject([
            { sortOrder: 100 },
            { sortOrder: 101 },
            { sortOrder: 102 },
            { sortOrder: 103 },
        ])
        expect(entityManager.createQueryBuilder).toHaveBeenCalledTimes(4)
    })
})

describe("LoyaltyRewardsService remove", () => {
    /** A transactional manager holding a locked reward, with a ledger lookup answering `used`. */
    const removing = (used: unknown, outcome: object) => {
        const entityManager = mockEntityManager({
            findOne: [LoyaltyRewardEntity, entityOf()],
            delete: [LoyaltyRewardEntity, outcome],
            update: [LoyaltyRewardEntity, outcome],
        })
        const transaction = fakeTransaction(entityManager)
        queueQueryBuilders(entityManager, [{ getRawOne: used }])
        return { entityManager, transaction }
    }

    it("commits without removing anything when the reward is missing", async () => {
        const entityManager = mockEntityManager({ findOne: [LoyaltyRewardEntity, null] })
        const transaction = fakeTransaction(entityManager)
        const rewards = await build(entityManager)

        await expect(rewards.remove("ws-1", "gone")).resolves.toBe("missing")

        expect(entityManager.createQueryBuilder).not.toHaveBeenCalled()
        expect(transaction.outcomes).toEqual(["commit"])
    })

    it("deletes an unused reward", async () => {
        const { entityManager, transaction } = removing(undefined, { affected: 1 })
        const rewards = await build(entityManager)

        await expect(rewards.remove("ws-1", "r1")).resolves.toBe("deleted")

        expect(entityManager.delete).toHaveBeenCalledWith(LoyaltyRewardEntity, { workspaceId: "ws-1", id: "r1" })
        expect(entityManager.update).not.toHaveBeenCalled()
        expect(transaction.outcomes).toEqual(["commit"])
    })

    it("pauses a reward the ledger refers to", async () => {
        const { entityManager, transaction } = removing({ used: 1 }, { affected: 1 })
        const rewards = await build(entityManager)

        await expect(rewards.remove("ws-1", "r1")).resolves.toBe("retired")

        expect(entityManager.update).toHaveBeenCalledWith(
            LoyaltyRewardEntity,
            { workspaceId: "ws-1", id: "r1" },
            { active: false },
        )
        expect(entityManager.delete).not.toHaveBeenCalled()
        expect(transaction.outcomes).toEqual(["commit"])
    })

    it("reports missing when the removal changes no row", async () => {
        const { entityManager, transaction } = removing(undefined, { affected: 0 })
        const rewards = await build(entityManager)

        await expect(rewards.remove("ws-1", "r1")).resolves.toBe("missing")
        expect(transaction.outcomes).toEqual(["commit"])
    })

    it("reports missing when the database does not count the changed rows", async () => {
        const { entityManager } = removing(undefined, {})
        const rewards = await build(entityManager)

        await expect(rewards.remove("ws-1", "r1")).resolves.toBe("missing")
    })
})

describe("LoyaltyRewardsService addPresets", () => {
    it("inserts nothing and counts zero when there are no presets", async () => {
        const entityManager = mockEntityManager()
        const rewards = await build(entityManager)

        await expect(rewards.addPresets("ws-1", [])).resolves.toBe(0)
        expect(entityManager.createQueryBuilder).not.toHaveBeenCalled()
    })

    it("writes an empty key for a preset that names none", async () => {
        const entityManager = mockEntityManager()
        const [insert] = queueQueryBuilders(entityManager, [{ execute: { raw: [] } }])
        const rewards = await build(entityManager)
        const keyless: RewardEdit = { ...EDIT, name: "Voucher", minTierKey: "bac", note: "n", key: undefined }

        await expect(rewards.addPresets("ws-1", [keyless])).resolves.toBe(0)
        expect(insert?.callsOf("values")).toEqual([[[{ ...FIELDS, workspaceId: "ws-1", key: "", sortOrder: 100 }]]])
    })

    it("writes every preset field in display order and counts the inserted rows", async () => {
        const entityManager = mockEntityManager()
        const [insert] = queueQueryBuilders(entityManager, [{ execute: { raw: [{ id: "r1" }, { id: "r2" }] } }])
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

        expect(insert?.callsOf("values")).toEqual([
            [
                [
                    { ...FIELDS, workspaceId: "ws-1", key: "voucher", sortOrder: 100 },
                    {
                        ...FIELDS,
                        workspaceId: "ws-1",
                        key: "discount",
                        kind: "percent",
                        percent: 10,
                        stock: null,
                        perCustomerLimit: null,
                        minTierKey: null,
                        sortOrder: 101,
                    },
                ].map((row) => ({ ...row, active: true })),
            ],
        ])
        expect(insert?.callsOf("orIgnore")).toHaveLength(1)
    })

    it("returns zero when no presets were given and writes nothing", async () => {
        const entityManager = mockEntityManager()
        const rewards = await build(entityManager)

        await expect(rewards.addPresets("ws-1", [])).resolves.toBe(0)

        expect(entityManager.createQueryBuilder).not.toHaveBeenCalled()
    })
})
