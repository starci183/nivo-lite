import type { LoyaltyReward } from "@modules/domain/loyalty-rewards"
import type { MemberDetail } from "./loyalty.contracts"
import type { ProgramConfigSubmission, RewardSubmission } from "./loyalty-graphql.contracts"
import {
    toLoyaltyMemberType,
    toSaveLoyaltyProgramRequest,
    toSaveLoyaltyRewardRequest,
    toUpdateLoyaltyMemberRequest,
} from "./loyalty-graphql.mapper"

const CONFIG: ProgramConfigSubmission = {
    earn: { perThousandVnd: 2, perVisit: 5, categories: [], trigger: "order", minOrderVnd: 10000 },
    tiers: [],
    expiry: { months: 12, warnDays: 30 },
    birthday: { enabled: true, points: 100, rewardKey: "gift", note: "Birthday gift" },
    promo: { maxPerMonth: 4, hourFrom: "08:00", hourTo: "21:00", batch: 20 },
}
const SUBMISSION: RewardSubmission = {
    name: "Voucher",
    kind: "voucher",
    valueVnd: 50000,
    pointsCost: 500,
    note: "At the counter",
    active: false,
}
const REWARD: LoyaltyReward = {
    ...SUBMISSION,
    id: "reward-1",
    key: "voucher",
    kind: "voucher",
    percent: null,
    stock: null,
    perCustomerLimit: null,
    minTierKey: null,
}

describe("loyalty GraphQL request mapping", () => {
    describe("toSaveLoyaltyProgramRequest", () => {
        it("preserves saved fields for omitted and null programme edits", () => {
            expect(toSaveLoyaltyProgramRequest({}, "ws-1")).toEqual({ workspaceId: "ws-1" })
            expect(toSaveLoyaltyProgramRequest({ name: null, enabled: null, config: null }, "ws-1")).toEqual({
                workspaceId: "ws-1",
            })
        })

        it.each([
            ["order", "order"],
            ["payment", "payment"],
            ["unsupported", "payment"],
        ])("normalizes the %s earning trigger to %s without changing the other rules", (trigger, expected) => {
            const config = { ...CONFIG, earn: { ...CONFIG.earn, trigger } }

            expect(toSaveLoyaltyProgramRequest({ name: "", enabled: false, config }, "ws-1")).toEqual({
                workspaceId: "ws-1",
                name: "",
                enabled: false,
                config: { ...CONFIG, earn: { ...CONFIG.earn, trigger: expected } },
            })
            expect(config.earn.trigger).toBe(trigger)
        })
    })

    describe("toSaveLoyaltyRewardRequest", () => {
        it("leaves omitted identifiers absent and expresses omitted limits as unlimited", () => {
            expect(toSaveLoyaltyRewardRequest(SUBMISSION, "ws-1")).toEqual({
                workspaceId: "ws-1",
                ...SUBMISSION,
                percent: null,
                stock: null,
                perCustomerLimit: null,
                minTierKey: null,
            })
        })

        it("omits null identifiers while preserving explicit unlimited limits", () => {
            expect(
                toSaveLoyaltyRewardRequest(
                    {
                        ...SUBMISSION,
                        id: null,
                        key: null,
                        percent: null,
                        stock: null,
                        perCustomerLimit: null,
                        minTierKey: null,
                    },
                    "ws-1",
                ),
            ).toEqual({
                workspaceId: "ws-1",
                ...SUBMISSION,
                percent: null,
                stock: null,
                perCustomerLimit: null,
                minTierKey: null,
            })
        })

        it.each([
            ["percent", "percent"],
            ["item", "item"],
            ["voucher", "voucher"],
            ["unsupported", "voucher"],
        ])("selects %s as the supported %s kind and retains supplied zero limits", (kind, expected) => {
            expect(
                toSaveLoyaltyRewardRequest(
                    {
                        ...SUBMISSION,
                        kind,
                        id: "reward-1",
                        key: "voucher",
                        percent: 0,
                        stock: 0,
                        perCustomerLimit: 0,
                        minTierKey: "",
                    },
                    "ws-1",
                ),
            ).toEqual({
                workspaceId: "ws-1",
                ...SUBMISSION,
                kind: expected,
                id: "reward-1",
                key: "voucher",
                percent: 0,
                stock: 0,
                perCustomerLimit: 0,
                minTierKey: "",
            })
        })
    })

    describe("toUpdateLoyaltyMemberRequest", () => {
        it("preserves omitted profile fields and null names or notes", () => {
            expect(toUpdateLoyaltyMemberRequest({ customerId: "customer-1" }, "ws-1")).toEqual({
                workspaceId: "ws-1",
                customerId: "customer-1",
            })
            expect(toUpdateLoyaltyMemberRequest({ customerId: "customer-1", name: null, note: null }, "ws-1")).toEqual({
                workspaceId: "ws-1",
                customerId: "customer-1",
            })
        })

        it.each([null, "1990-05-20"])("retains a birthday edit of %s and explicit empty profile values", (birthday) => {
            expect(
                toUpdateLoyaltyMemberRequest({ customerId: "customer-1", name: "", birthday, note: "" }, "ws-1"),
            ).toEqual({ workspaceId: "ws-1", customerId: "customer-1", name: "", birthday, note: "" })
        })
    })

    describe("toLoyaltyMemberType", () => {
        it("retains member details and represents every refusal parameter as named text", () => {
            const detail: MemberDetail = {
                member: {
                    id: "customer-1",
                    name: "Mai",
                    phone: null,
                    email: null,
                    birthday: null,
                    tierKey: null,
                    points: 100,
                    lifetimeSpendVnd: 0,
                    visits: 0,
                    lastVisitAt: null,
                    joinedAt: "2026-01-01T00:00:00.000Z",
                    note: "Regular customer",
                },
                ledger: [],
                tierName: "",
                nextTier: null,
                expiring: { points: 5, firstAt: "2026-02-01T00:00:00.000Z" },
                rewards: [
                    { reward: REWARD, block: null },
                    { reward: REWARD, block: { code: "tier_required", params: { tier: "Silver", missing: 400 } } },
                ],
            }

            expect(toLoyaltyMemberType(detail)).toEqual({
                ...detail,
                rewards: [
                    { reward: REWARD, block: null },
                    {
                        reward: REWARD,
                        block: {
                            code: "tier_required",
                            params: [
                                { key: "tier", value: "Silver" },
                                { key: "missing", value: "400" },
                            ],
                        },
                    },
                ],
            })
            expect(detail.rewards[1]?.block).toEqual({
                code: "tier_required",
                params: { tier: "Silver", missing: 400 },
            })
        })
    })
})
