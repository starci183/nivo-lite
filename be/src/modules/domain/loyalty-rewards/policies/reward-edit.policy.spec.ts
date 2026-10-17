import { Test } from "@nestjs/testing"
import type { RewardEdit } from "../loyalty-rewards.contracts"
import { rewardKey, sanitizeReward } from "./reward-edit.policy"

const SUBJECT = Symbol("reward-edit.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { rewardKey, sanitizeReward } }],
    }).compile()
    return moduleRef.get<typeof import("./reward-edit.policy")>(SUBJECT)
}

const EDIT: RewardEdit = {
    id: "r1",
    key: "saved-key",
    name: "Voucher",
    kind: "voucher",
    valueVnd: 50000,
    percent: null,
    pointsCost: 500,
    stock: null,
    perCustomerLimit: null,
    minTierKey: null,
    note: "Note",
    active: true,
}

describe("rewardKey", () => {
    it.each([
        ["__\u0110\u1ed5i qu\u00e0: C\u00e0 ph\u00ea!__", "doi-qua-ca-phe"],
        ["---___!!!", "reward"],
        ["ABCDEFGHIJKLMNOPQRSTUVWXYZ123456789", "abcdefghijklmnopqrstuvwxyz1234"],
        ["voucher_50k", "voucher_50k"],
    ])("normalizes %s to the safe key %s", async (name, expected) => {
        const subject = await build()

        expect(subject.rewardKey(name)).toBe(expected)
    })
})

describe("sanitizeReward", () => {
    it("trims text, rounds numbers and preserves the identity and unlimited fields", async () => {
        const subject = await build()

        expect(
            subject.sanitizeReward({
                ...EDIT,
                name: "  Voucher  ",
                valueVnd: 123.6,
                pointsCost: 9.4,
                note: "  Note  ",
            }),
        ).toEqual({ ...EDIT, valueVnd: 124, pointsCost: 9 })
    })

    it("bounds text lengths and finite numeric values for storage", async () => {
        const subject = await build()

        expect(
            subject.sanitizeReward({
                ...EDIT,
                name: ` ${"N".repeat(90)} `,
                kind: "percent",
                valueVnd: 2e12,
                percent: 101,
                pointsCost: 3e9,
                stock: -5,
                perCustomerLimit: 0,
                minTierKey: ` ${"t".repeat(50)} `,
                note: ` ${"n".repeat(220)} `,
                active: false,
            }),
        ).toEqual({
            ...EDIT,
            name: "N".repeat(80),
            kind: "percent",
            valueVnd: 1e12,
            percent: 100,
            pointsCost: 2147483647,
            stock: 0,
            perCustomerLimit: 1,
            minTierKey: "t".repeat(40),
            note: "n".repeat(200),
            active: false,
        })
    })

    it("uses minimums for nonfinite values and clears blank tier keys", async () => {
        const subject = await build()

        expect(
            subject.sanitizeReward({
                ...EDIT,
                kind: "percent",
                valueVnd: Number.POSITIVE_INFINITY,
                percent: Number.NaN,
                pointsCost: Number.NEGATIVE_INFINITY,
                stock: Number.NaN,
                perCustomerLimit: Number.POSITIVE_INFINITY,
                minTierKey: "   ",
            }),
        ).toEqual({
            ...EDIT,
            kind: "percent",
            valueVnd: 0,
            percent: 1,
            pointsCost: 1,
            stock: 0,
            perCustomerLimit: 1,
        })
    })
})

describe("sanitizeReward", () => {
    it("defaults an absent percent to ten and rounds stock and customer limits", async () => {
        const subject = await build()

        expect(
            subject.sanitizeReward({
                ...EDIT,
                kind: "percent",
                stock: 4.8,
                perCustomerLimit: 2.3,
                minTierKey: " bac ",
            }),
        ).toEqual({ ...EDIT, kind: "percent", percent: 10, stock: 5, perCustomerLimit: 2, minTierKey: "bac" })
    })

    it("discards percentages on rewards that give items or vouchers", async () => {
        const subject = await build()

        expect(subject.sanitizeReward({ ...EDIT, kind: "item", percent: 25 })).toEqual({ ...EDIT, kind: "item" })
    })
})
