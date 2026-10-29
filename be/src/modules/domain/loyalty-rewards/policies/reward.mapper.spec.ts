import { REWARD_RETURNING, toReward, toRewardFromRaw } from "./reward.mapper"
import type { RewardFieldsOfEntity, RewardRaw } from "./reward.mapper"

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
    it("names the reward columns in column naming", () => {
        expect(REWARD_RETURNING).toBe(
            "id, key, name, kind, value_vnd::float8 AS value_vnd, percent, points_cost, stock, per_customer_limit, min_tier_key, note, active",
        )
    })
})

describe("toReward", () => {
    it("maps an entity row", () => {
        expect(toReward(entityRow())).toEqual({
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
    it("maps a returning row, keeping absent optional columns as null", () => {
        expect(toRewardFromRaw(rawRow())).toEqual({
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
