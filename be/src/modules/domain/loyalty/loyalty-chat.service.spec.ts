import { Test } from "@nestjs/testing"
import { FakeClock, builder, mock } from "@starci/jest-preset"
import { LoyaltyCustomerLinksService } from "@modules/domain/loyalty-customer-links"
import type { ChatCustomerRef } from "@modules/domain/loyalty-customer-links"
import { LoyaltyLedgerService } from "@modules/domain/loyalty-ledger"
import type { LoyaltyMember } from "@modules/domain/loyalty-ledger"
import { LoyaltyProgramsService } from "@modules/domain/loyalty-programs"
import type { LoyaltyProgram } from "@modules/domain/loyalty-programs"
import { LoyaltyRewardsService } from "@modules/domain/loyalty-rewards"
import type { LoyaltyReward } from "@modules/domain/loyalty-rewards"
import { CLOCK } from "@modules/platform/clock"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { LoyaltyChatService } from "./loyalty-chat.service"

const NOW = Date.UTC(2026, 9, 12)
const ref: ChatCustomerRef = {
    workspaceId: "ws-1",
    conversationId: "v1",
    leadId: "lead-1",
    channel: "telegram",
    externalId: "123:456",
}
const programOf = builder<LoyaltyProgram>({
    workspaceId: "ws-1",
    slug: "spa",
    name: "Spa Anna",
    enabled: true,
    createdAt: "2026-10-01T00:00:00.000Z",
    config: {
        earn: { perThousandVnd: 1, perVisit: 0, categories: [], trigger: "payment", minOrderVnd: 0 },
        tiers: [
            { key: "dong", name: "Bronze", minSpendVnd: 0, multiplier: 1, winbackDays: 60, benefit: "" },
            { key: "bac", name: "Silver", minSpendVnd: 3_000_000, multiplier: 1.2, winbackDays: 45, benefit: "" },
        ],
        expiry: { months: 12, warnDays: 30 },
        birthday: { enabled: true, points: 100, rewardKey: "", note: "" },
        promo: { maxPerMonth: 4, hourFrom: "08:00", hourTo: "21:00", batch: 20 },
    },
})
const memberOf = builder<LoyaltyMember>({
    id: "c1",
    name: "Mai",
    phone: "84912345678",
    email: null,
    birthday: null,
    tierKey: "dong",
    points: 600,
    lifetimeSpendVnd: 1_000_000,
    visits: 2,
    lastVisitAt: null,
    joinedAt: "2026-10-01T00:00:00.000Z",
    note: "",
})
const rewardOf = builder<LoyaltyReward>({
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
})
const PROGRAM_LINES = ["loyalty.chat.header", "loyalty.chat.earn|1", "loyalty.chat.tiers|Bronze (0); Silver (3000000)"]
const REWARD_LINES = ["loyalty.chat.rewards", "loyalty.chat.reward|voucher|Voucher|500|50000|-|-|-|-"]
const MEMBER_LINE = "loyalty.chat.member|Mai|Bronze|600|1000000|2"

describe("LoyaltyChatService", () => {
    const build = async () => {
        const clock = new FakeClock(NOW)
        const catalog = mock<MessageCatalog>()
        catalog.get.mockImplementation((key, params) => [key, ...Object.values(params).map(String)].join("|"))
        const programs = mock<LoyaltyProgramsService>()
        programs.findActive.mockResolvedValue(programOf())
        const rewards = mock<LoyaltyRewardsService>()
        rewards.list.mockResolvedValue([rewardOf()])
        const ledger = mock<LoyaltyLedgerService>()
        ledger.member.mockResolvedValue(memberOf())
        ledger.redeemedCounts.mockResolvedValue(new Map())
        ledger.expiryEntries.mockResolvedValue([])
        const links = mock<LoyaltyCustomerLinksService>()
        links.customerOfChat.mockResolvedValue("c1")
        const moduleRef = await Test.createTestingModule({
            providers: [
                LoyaltyChatService,
                { provide: CLOCK, useValue: clock },
                { provide: MESSAGE_CATALOG, useValue: catalog },
                { provide: LoyaltyProgramsService, useValue: programs },
                { provide: LoyaltyRewardsService, useValue: rewards },
                { provide: LoyaltyLedgerService, useValue: ledger },
                { provide: LoyaltyCustomerLinksService, useValue: links },
            ],
        }).compile()
        return { service: moduleRef.get(LoyaltyChatService), catalog, programs, rewards, ledger, links }
    }

    describe("brief", () => {
        it("returns no brief and reads no customer facts without an active programme", async () => {
            const { service, programs, rewards, ledger, links, catalog } = await build()
            programs.findActive.mockResolvedValue(null)

            await expect(service.brief(ref)).resolves.toBe("")
            expect(programs.findActive).toHaveBeenCalledWith("ws-1")
            expect(rewards.list).not.toHaveBeenCalled()
            expect(links.customerOfChat).not.toHaveBeenCalled()
            expect(ledger.member).not.toHaveBeenCalled()
            expect(catalog.get).not.toHaveBeenCalled()
        })

        it("shows the catalogue and ledger facts with the rewards the member can redeem", async () => {
            const { service, rewards, ledger, links, catalog } = await build()
            rewards.list.mockResolvedValue([rewardOf(), rewardOf({ id: "r2", key: "large", pointsCost: 5000 })])

            await expect(service.brief(ref)).resolves.toBe(
                [
                    ...PROGRAM_LINES,
                    ...REWARD_LINES,
                    "loyalty.chat.reward|large|Voucher|5000|50000|-|-|-|-",
                    MEMBER_LINE,
                    "loyalty.chat.noExpiring",
                    'loyalty.chat.canRedeem|"voucher"',
                ].join("\n"),
            )
            expect(rewards.list).toHaveBeenCalledWith("ws-1", true)
            expect(links.customerOfChat).toHaveBeenCalledWith(ref)
            expect(ledger.member).toHaveBeenCalledWith("ws-1", "c1")
            expect(ledger.redeemedCounts).toHaveBeenCalledWith("c1")
            expect(ledger.expiryEntries).toHaveBeenCalledWith("c1")
            expect(catalog.get).toHaveBeenCalledWith(
                "loyalty.chat.member",
                { name: "Mai", tier: "Bronze", points: 600, spend: 1_000_000, visits: 2 },
                "vi",
            )
        })

        it("shows the programme and asks an unlinked customer to identify themselves to the shop", async () => {
            const { service, links, ledger } = await build()
            links.customerOfChat.mockResolvedValue(null)

            await expect(service.brief(ref)).resolves.toBe(
                [...PROGRAM_LINES, ...REWARD_LINES, "loyalty.chat.unknown"].join("\n"),
            )
            expect(ledger.member).not.toHaveBeenCalled()
            expect(ledger.redeemedCounts).not.toHaveBeenCalled()
            expect(ledger.expiryEntries).not.toHaveBeenCalled()
        })

        it("shows unknown member wording when the linked customer has no ledger member", async () => {
            const { service, ledger } = await build()
            ledger.member.mockResolvedValue(null)

            await expect(service.brief(ref)).resolves.toBe(
                [...PROGRAM_LINES, ...REWARD_LINES, "loyalty.chat.unknown"].join("\n"),
            )
            expect(ledger.member).toHaveBeenCalledWith("ws-1", "c1")
            expect(ledger.redeemedCounts).not.toHaveBeenCalled()
        })

        it("says the catalogue is empty and that there is nothing to redeem", async () => {
            const { service, rewards } = await build()
            rewards.list.mockResolvedValue([])

            await expect(service.brief(ref)).resolves.toBe(
                [
                    ...PROGRAM_LINES,
                    "loyalty.chat.noRewards",
                    MEMBER_LINE,
                    "loyalty.chat.noExpiring",
                    "loyalty.chat.cannotRedeem",
                ].join("\n"),
            )
        })

        it("lists the catalogue limits and notes even when no member is known", async () => {
            const { service, rewards, links, catalog } = await build()
            links.customerOfChat.mockResolvedValue(null)
            rewards.list.mockResolvedValue([
                rewardOf({ perCustomerLimit: 2, stock: 3, minTierKey: "bac", note: "Show code" }),
            ])

            await expect(service.brief(ref)).resolves.toBe(
                [
                    ...PROGRAM_LINES,
                    "loyalty.chat.rewards",
                    "loyalty.chat.reward|voucher|Voucher|500|50000|2|3|bac|Show code",
                    "loyalty.chat.unknown",
                ].join("\n"),
            )
            expect(catalog.get).toHaveBeenCalledWith(
                "loyalty.chat.reward",
                {
                    key: "voucher",
                    name: "Voucher",
                    cost: 500,
                    value: 50000,
                    limit: 2,
                    stock: 3,
                    tier: "bac",
                    note: "Show code",
                },
                "vi",
            )
        })

        it("warns only about still unspent points within the configured expiry window", async () => {
            const { service, ledger, catalog } = await build()
            ledger.expiryEntries.mockResolvedValue([
                { kind: "earn", points: 100, expiresAt: "2026-10-20T06:00:00.000Z" },
                { kind: "redeem", points: -20, expiresAt: null },
                { kind: "earn", points: 520, expiresAt: "2026-11-30T00:00:00.000Z" },
            ])

            await expect(service.brief(ref)).resolves.toBe(
                [
                    ...PROGRAM_LINES,
                    ...REWARD_LINES,
                    MEMBER_LINE,
                    "loyalty.chat.expiring|80|2026-10-20",
                    'loyalty.chat.canRedeem|"voucher"',
                ].join("\n"),
            )
            expect(catalog.get).toHaveBeenCalledWith("loyalty.chat.expiring", { points: 80, at: "2026-10-20" }, "vi")
        })

        it("shows no expiry warning after the points due soon have already been spent", async () => {
            const { service, ledger, catalog } = await build()
            ledger.expiryEntries.mockResolvedValue([
                { kind: "earn", points: 100, expiresAt: "2026-10-20T00:00:00.000Z" },
                { kind: "redeem", points: -100, expiresAt: null },
            ])

            await expect(service.brief(ref)).resolves.toBe(
                [
                    ...PROGRAM_LINES,
                    ...REWARD_LINES,
                    MEMBER_LINE,
                    "loyalty.chat.noExpiring",
                    'loyalty.chat.canRedeem|"voucher"',
                ].join("\n"),
            )
            expect(catalog.get).not.toHaveBeenCalledWith("loyalty.chat.expiring", expect.anything(), "vi")
        })

        it("avoids expiry reads when the programme points never expire", async () => {
            const { service, programs, ledger } = await build()
            const program = programOf()
            programs.findActive.mockResolvedValue(
                programOf({ config: { ...program.config, expiry: { months: 0, warnDays: 30 } } }),
            )

            await expect(service.brief(ref)).resolves.toBe(
                [
                    ...PROGRAM_LINES,
                    ...REWARD_LINES,
                    MEMBER_LINE,
                    "loyalty.chat.noExpiring",
                    'loyalty.chat.canRedeem|"voucher"',
                ].join("\n"),
            )
            expect(ledger.expiryEntries).not.toHaveBeenCalled()
        })

        it("uses a dash for a member tier the programme does not know", async () => {
            const { service, ledger, catalog } = await build()
            ledger.member.mockResolvedValue(memberOf({ tierKey: "gone" }))

            await expect(service.brief(ref)).resolves.toBe(
                [
                    ...PROGRAM_LINES,
                    ...REWARD_LINES,
                    "loyalty.chat.member|Mai|-|600|1000000|2",
                    "loyalty.chat.noExpiring",
                    'loyalty.chat.canRedeem|"voucher"',
                ].join("\n"),
            )
            expect(catalog.get).toHaveBeenCalledWith(
                "loyalty.chat.member",
                { name: "Mai", tier: "-", points: 600, spend: 1_000_000, visits: 2 },
                "vi",
            )
        })

        it("excludes rewards whose customer redemption limit has been reached", async () => {
            const { service, rewards, ledger } = await build()
            rewards.list.mockResolvedValue([rewardOf({ perCustomerLimit: 1 })])
            ledger.redeemedCounts.mockResolvedValue(new Map([["r1", 1]]))

            await expect(service.brief(ref)).resolves.toBe(
                [
                    ...PROGRAM_LINES,
                    "loyalty.chat.rewards",
                    "loyalty.chat.reward|voucher|Voucher|500|50000|1|-|-|-",
                    MEMBER_LINE,
                    "loyalty.chat.noExpiring",
                    "loyalty.chat.cannotRedeem",
                ].join("\n"),
            )
            expect(ledger.redeemedCounts).toHaveBeenCalledWith("c1")
        })

        it("limits the brief catalogue and redeemable keys to twelve rewards", async () => {
            const { service, rewards, catalog } = await build()
            rewards.list.mockResolvedValue(
                Array.from({ length: 13 }, (_, index) => rewardOf({ id: `r${index + 1}`, key: `key${index + 1}` })),
            )

            const brief = await service.brief(ref)

            expect(brief).toContain("loyalty.chat.reward|key1|Voucher|500|50000|-|-|-|-")
            expect(brief).toContain("loyalty.chat.reward|key12|Voucher|500|50000|-|-|-|-")
            expect(brief).not.toContain("key13")
            expect(catalog.get.mock.calls.filter(([key]) => key === "loyalty.chat.reward")).toHaveLength(12)
            expect(catalog.get).toHaveBeenCalledWith(
                "loyalty.chat.canRedeem",
                {
                    rewards:
                        '"key1", "key2", "key3", "key4", "key5", "key6", "key7", "key8", "key9", "key10", "key11", "key12"',
                },
                "vi",
            )
        })
    })

    describe("redeemIntent", () => {
        it("returns no intent without an active programme", async () => {
            const { service, programs, rewards, ledger, links } = await build()
            programs.findActive.mockResolvedValue(null)

            await expect(service.redeemIntent(ref, "voucher")).resolves.toEqual({ kind: "none" })
            expect(rewards.list).not.toHaveBeenCalled()
            expect(links.customerOfChat).not.toHaveBeenCalled()
            expect(ledger.redeemedCounts).not.toHaveBeenCalled()
        })

        it("returns no intent for a stranger in an unlinked chat", async () => {
            const { service, links, ledger } = await build()
            links.customerOfChat.mockResolvedValue(null)

            await expect(service.redeemIntent(ref, "voucher")).resolves.toEqual({ kind: "none" })
            expect(ledger.member).not.toHaveBeenCalled()
            expect(ledger.redeemedCounts).not.toHaveBeenCalled()
        })

        it("returns no intent when the linked ledger member no longer exists", async () => {
            const { service, ledger } = await build()
            ledger.member.mockResolvedValue(null)

            await expect(service.redeemIntent(ref, "voucher")).resolves.toEqual({ kind: "none" })
            expect(ledger.member).toHaveBeenCalledWith("ws-1", "c1")
            expect(ledger.redeemedCounts).not.toHaveBeenCalled()
        })

        it("returns no intent for a key outside the active catalogue", async () => {
            const { service, ledger } = await build()

            await expect(service.redeemIntent(ref, "unknown")).resolves.toEqual({ kind: "none" })
            expect(ledger.redeemedCounts).not.toHaveBeenCalled()
        })

        it("returns no intent for a reward beyond the twelve shown to the chat", async () => {
            const { service, rewards, ledger } = await build()
            rewards.list.mockResolvedValue(
                Array.from({ length: 13 }, (_, index) => rewardOf({ id: `r${index + 1}`, key: `key${index + 1}` })),
            )

            await expect(service.redeemIntent(ref, "key13")).resolves.toEqual({ kind: "none" })
            expect(ledger.redeemedCounts).not.toHaveBeenCalled()
        })

        it("opens an eligible request with the exact member and catalogue reward", async () => {
            const { service, programs, rewards, links, ledger } = await build()

            await expect(service.redeemIntent(ref, "voucher")).resolves.toEqual({
                kind: "open",
                customerId: "c1",
                customerName: "Mai",
                reward: rewardOf(),
            })
            expect(programs.findActive).toHaveBeenCalledWith("ws-1")
            expect(rewards.list).toHaveBeenCalledWith("ws-1", true)
            expect(links.customerOfChat).toHaveBeenCalledWith(ref)
            expect(ledger.member).toHaveBeenCalledWith("ws-1", "c1")
            expect(ledger.redeemedCounts).toHaveBeenCalledWith("c1")
            expect(ledger.expiryEntries).not.toHaveBeenCalled()
        })

        it("blocks a request when the catalogue cost exceeds the ledger balance", async () => {
            const { service, ledger } = await build()
            ledger.member.mockResolvedValue(memberOf({ points: 499 }))

            await expect(service.redeemIntent(ref, "voucher")).resolves.toEqual({
                kind: "blocked",
                customerId: "c1",
                customerName: "Mai",
                reward: rewardOf(),
                reason: "not_enough_points",
            })
            expect(ledger.redeemedCounts).toHaveBeenCalledWith("c1")
        })

        it("blocks a request once the existing redemption count reaches the reward limit", async () => {
            const { service, rewards, ledger } = await build()
            const reward = rewardOf({ perCustomerLimit: 1 })
            rewards.list.mockResolvedValue([reward])
            ledger.redeemedCounts.mockResolvedValue(new Map([["r1", 1]]))

            await expect(service.redeemIntent(ref, "voucher")).resolves.toEqual({
                kind: "blocked",
                customerId: "c1",
                customerName: "Mai",
                reward,
                reason: "limit_reached",
            })
        })

        it("blocks a reward reserved for a tier above the member tier", async () => {
            const { service, rewards } = await build()
            const reward = rewardOf({ minTierKey: "bac" })
            rewards.list.mockResolvedValue([reward])

            await expect(service.redeemIntent(ref, "voucher")).resolves.toEqual({
                kind: "blocked",
                customerId: "c1",
                customerName: "Mai",
                reward,
                reason: "tier_required",
            })
        })

        it("blocks a reward whose last unit has been redeemed", async () => {
            const { service, rewards } = await build()
            const reward = rewardOf({ stock: 0 })
            rewards.list.mockResolvedValue([reward])

            await expect(service.redeemIntent(ref, "voucher")).resolves.toEqual({
                kind: "blocked",
                customerId: "c1",
                customerName: "Mai",
                reward,
                reason: "out_of_stock",
            })
        })
    })
})
