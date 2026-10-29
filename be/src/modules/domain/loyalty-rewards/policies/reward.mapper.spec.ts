import { Test } from "@nestjs/testing"
import { REWARD_RETURNING, isRewardRaw, toReward, toRewardFromRaw } from "./reward.mapper"
import type { RewardFieldsOfEntity, RewardRaw } from "./reward.mapper"

const SUBJECT = Symbol("reward.mapper")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { REWARD_RETURNING, isRewardRaw, toReward, toRewardFromRaw } }],
    }).compile()
    return moduleRef.get<typeof import("./reward.mapper")>(SUBJECT)
}

const entityRow = (overrides: Partial<RewardFieldsOfEntity> = {}): RewardFieldsOfEntity => ({
    id: "r-1",
    key: "coffee",
    name: "Free coffee",
    kind: "voucher",
    valueVnd: 50_000,
    percent: null,
    pointsCost: 100,
    stock: 10,
    perCustomerLimit: 2,
    minTierKey: "silver",
    note: "morning only",
    active: true,
    ...overrides,
})

const rawRow = (overrides: Partial<RewardRaw> = {}): RewardRaw => ({
    id: "r-1",
    key: "coffee",
    name: "Free coffee",
    kind: "percent",
    value_vnd: 0,
    percent: 15,
    points_cost: 100,
    stock: null,
    per_customer_limit: null,
    min_tier_key: null,
    note: "",
    active: false,
    ...overrides,
})

describe("REWARD_RETURNING", () => {
    it("names the reward columns in column naming", async () => {
        const subject = await build()

        expect(subject.REWARD_RETURNING).toBe(
            "id, key, name, kind, value_vnd::float8 AS value_vnd, percent, points_cost, stock, per_customer_limit, min_tier_key, note, active",
        )
    })
})

describe("toReward", () => {
    it("maps an entity row", async () => {
        const subject = await build()

        expect(subject.toReward(entityRow())).toEqual({
            id: "r-1",
            key: "coffee",
            name: "Free coffee",
            kind: "voucher",
            valueVnd: 50_000,
            percent: null,
            pointsCost: 100,
            stock: 10,
            perCustomerLimit: 2,
            minTierKey: "silver",
            note: "morning only",
            active: true,
        })
    })
})

describe("toRewardFromRaw", () => {
    it("maps a returning row, keeping absent optional columns as null", async () => {
        const subject = await build()

        expect(subject.toRewardFromRaw(rawRow())).toEqual({
            id: "r-1",
            key: "coffee",
            name: "Free coffee",
            kind: "percent",
            valueVnd: 0,
            percent: 15,
            pointsCost: 100,
            stock: null,
            perCustomerLimit: null,
            minTierKey: null,
            note: "",
            active: false,
        })
    })
})

describe("isRewardRaw", () => {
    it("accepts a full reward row and refuses a missing column or an unknown kind", async () => {
        const subject = await build()
        const withoutNote = Object.fromEntries(Object.entries(rawRow()).filter(([column]) => column !== "note"))

        expect(subject.isRewardRaw(rawRow())).toBe(true)
        expect(subject.isRewardRaw(withoutNote)).toBe(false)
        expect(subject.isRewardRaw({ ...rawRow(), kind: "gift" })).toBe(false)
        expect(subject.isRewardRaw(null)).toBe(false)
    })
})
