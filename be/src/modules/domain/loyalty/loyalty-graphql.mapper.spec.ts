import { Test } from "@nestjs/testing"
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

const SUBJECT = Symbol("loyalty-graphql.mapper")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    toSaveLoyaltyProgramRequest,
                    toSaveLoyaltyRewardRequest,
                    toUpdateLoyaltyMemberRequest,
                    toLoyaltyMemberType,
                },
            },
        ],
    }).compile()
    return moduleRef.get<{
        toSaveLoyaltyProgramRequest: typeof toSaveLoyaltyProgramRequest
        toSaveLoyaltyRewardRequest: typeof toSaveLoyaltyRewardRequest
        toUpdateLoyaltyMemberRequest: typeof toUpdateLoyaltyMemberRequest
        toLoyaltyMemberType: typeof toLoyaltyMemberType
    }>(SUBJECT)
}

describe("loyalty GraphQL request mapping", () => {
    describe("toSaveLoyaltyProgramRequest", () => {
        it("preserves saved fields for omitted and null programme edits", async () => {
            const subject = await buildSubject()

            expect(subject.toSaveLoyaltyProgramRequest({}, "ws-1")).toEqual({ workspaceId: "ws-1" })
            expect(subject.toSaveLoyaltyProgramRequest({ name: null, enabled: null, config: null }, "ws-1")).toEqual({
                workspaceId: "ws-1",
            })
        })

        it.each([
            ["order", "order"],
            ["payment", "payment"],
            ["unsupported", "payment"],
        ])("normalizes the %s earning trigger to %s without changing the other rules", async (trigger, expected) => {
            const subject = await buildSubject()

            const config = { ...CONFIG, earn: { ...CONFIG.earn, trigger } }

            expect(subject.toSaveLoyaltyProgramRequest({ name: "", enabled: false, config }, "ws-1")).toEqual({
                workspaceId: "ws-1",
                name: "",
                enabled: false,
                config: { ...CONFIG, earn: { ...CONFIG.earn, trigger: expected } },
            })
            expect(config.earn.trigger).toBe(trigger)
        })
    })
})

describe("loyalty GraphQL request mapping", () => {
    describe("toSaveLoyaltyRewardRequest", () => {
        it("leaves omitted identifiers absent and expresses omitted limits as unlimited", async () => {
            const subject = await buildSubject()

            expect(subject.toSaveLoyaltyRewardRequest(SUBMISSION, "ws-1")).toEqual({
                workspaceId: "ws-1",
                ...SUBMISSION,
                percent: null,
                stock: null,
                perCustomerLimit: null,
                minTierKey: null,
            })
        })

        it("omits null identifiers while preserving explicit unlimited limits", async () => {
            const subject = await buildSubject()

            expect(
                subject.toSaveLoyaltyRewardRequest(
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
        ])("selects %s as the supported %s kind and retains supplied zero limits", async (kind, expected) => {
            const subject = await buildSubject()

            expect(
                subject.toSaveLoyaltyRewardRequest(
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
})

describe("loyalty GraphQL request mapping", () => {
    describe("toUpdateLoyaltyMemberRequest", () => {
        it("preserves omitted profile fields and null names or notes", async () => {
            const subject = await buildSubject()

            expect(subject.toUpdateLoyaltyMemberRequest({ customerId: "customer-1" }, "ws-1")).toEqual({
                workspaceId: "ws-1",
                customerId: "customer-1",
            })
            expect(
                subject.toUpdateLoyaltyMemberRequest({ customerId: "customer-1", name: null, note: null }, "ws-1"),
            ).toEqual({
                workspaceId: "ws-1",
                customerId: "customer-1",
            })
        })

        it.each([null, "1990-05-20"])(
            "retains a birthday edit of %s and explicit empty profile values",
            async (birthday) => {
                const subject = await buildSubject()

                expect(
                    subject.toUpdateLoyaltyMemberRequest(
                        { customerId: "customer-1", name: "", birthday, note: "" },
                        "ws-1",
                    ),
                ).toEqual({ workspaceId: "ws-1", customerId: "customer-1", name: "", birthday, note: "" })
            },
        )
    })
})

describe("loyalty GraphQL request mapping", () => {
    describe("toLoyaltyMemberType", () => {
        it("retains member details and represents every refusal parameter as named text", async () => {
            const subject = await buildSubject()

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

            expect(subject.toLoyaltyMemberType(detail)).toEqual({
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
