import { Test } from "@nestjs/testing"
import { FakeClock, builder, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { LoyaltyCustomersService } from "@modules/domain/loyalty-customers"
import { LoyaltyLedgerService } from "@modules/domain/loyalty-ledger"
import type { LoyaltyMember } from "@modules/domain/loyalty-ledger"
import { LoyaltyProgramsService } from "@modules/domain/loyalty-programs"
import type { LoyaltyConfig } from "@modules/domain/loyalty-programs"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { LoyaltyErrorCode } from "./errors/loyalty.error"
import { LoyaltyEarningService } from "./loyalty-earning.service"
import type { EarningParams } from "./loyalty-earning.service"

const NOW = Date.UTC(2026, 9, 12)
const CONFIG: LoyaltyConfig = {
    earn: { perThousandVnd: 1, perVisit: 0, categories: [], trigger: "payment", minOrderVnd: 10000 },
    tiers: [
        { key: "dong", name: "Bronze", minSpendVnd: 0, multiplier: 1, winbackDays: 60, benefit: "" },
        { key: "bac", name: "Silver", minSpendVnd: 3_000_000, multiplier: 1.2, winbackDays: 45, benefit: "" },
    ],
    expiry: { months: 12, warnDays: 30 },
    birthday: { enabled: true, points: 100, rewardKey: "", note: "" },
    promo: { maxPerMonth: 4, hourFrom: "08:00", hourTo: "21:00", batch: 20 },
}
const memberOf = builder<LoyaltyMember>({
    id: "c1",
    name: "Mai",
    phone: "84912345678",
    email: null,
    birthday: null,
    tierKey: "dong",
    points: 0,
    lifetimeSpendVnd: 0,
    visits: 0,
    lastVisitAt: null,
    joinedAt: new Date(NOW).toISOString(),
    note: "",
})
const paramsOf = builder<EarningParams>({
    workspaceId: "ws-1",
    phone: "84912345678",
    name: " Mai ",
    amountVnd: 100000,
    items: "",
    ref: "pos:k1:r1",
    by: "api:Till",
    occurredAt: "",
})
const catalog = mock<MessageCatalog>({ get: (key, params) => `${key}|${Object.values(params).join("/")}` })

interface Options {
    customerId?: string | null
    members?: Array<LoyaltyMember | null>
    posted?: string | null
    config?: LoyaltyConfig
}

const build = async (options: Options) => {
    const tx = fakeTransaction(mockEntityManager())
    const customers = mock<LoyaltyCustomersService>()
    customers.ensureByPhone.mockResolvedValue(options.customerId === undefined ? "c1" : options.customerId)
    customers.moveTier.mockResolvedValue(true)
    const ledger = mock<LoyaltyLedgerService>()
    const seq = options.members ?? [null, null]
    seq.forEach((member) => ledger.member.mockResolvedValueOnce(member))
    ledger.post.mockResolvedValue(options.posted === undefined ? "e1" : options.posted)
    const programs = mock<LoyaltyProgramsService>()
    programs.configOf.mockResolvedValue(options.config ?? CONFIG)
    const moduleRef = await Test.createTestingModule({
        providers: [
            LoyaltyEarningService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: LoyaltyCustomersService, useValue: customers },
            { provide: LoyaltyLedgerService, useValue: ledger },
            { provide: LoyaltyProgramsService, useValue: programs },
        ],
    }).compile()
    return { service: moduleRef.get(LoyaltyEarningService), customers, ledger }
}

describe("LoyaltyEarningService", () => {
    it("creates the customer of a new phone, writes the points with their note and expiry", async () => {
        const { service, customers, ledger } = await build({ members: [null, null] })

        await expect(service.earn(paramsOf())).resolves.toEqual({ customerId: "c1", status: "done" })

        expect(customers.ensureByPhone).toHaveBeenCalledWith(expect.anything(), {
            workspaceId: "ws-1",
            name: "Mai",
            phone: "84912345678",
            email: null,
            birthday: null,
        })
        expect(ledger.post).toHaveBeenCalledWith({
            manager: expect.anything(),
            workspaceId: "ws-1",
            customerId: "c1",
            kind: "earn",
            points: 100,
            ref: "pos:k1:r1",
            by: "api:Till",
            amountVnd: 100000,
            orderId: null,
            invoiceId: null,
            rewardId: null,
            evidence: "loyalty.earn.rate|1",
            expiresAt: "2027-10-12T00:00:00.000Z",
            occurredAt: new Date(NOW).toISOString(),
        })
    })

    it("names an unnamed customer after the end of the phone", async () => {
        const { service, customers } = await build({ members: [null, null] })

        await service.earn(paramsOf({ name: "  " }))

        expect(customers.ensureByPhone).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({ name: "loyalty.customer.defaultName|5678" }),
        )
    })

    it("uses the date of the sale and the tier the customer holds", async () => {
        const held = memberOf({ tierKey: "bac" })
        const { service, ledger } = await build({ members: [held, held] })

        await service.earn(paramsOf({ occurredAt: "2026-09-01T00:00:00.000Z" }))

        expect(ledger.post).toHaveBeenCalledWith(
            expect.objectContaining({
                points: 120,
                occurredAt: "2026-09-01T00:00:00.000Z",
                expiresAt: "2027-09-01T00:00:00.000Z",
            }),
        )
    })

    it("earns nothing for a sale below the smallest order", async () => {
        const { service, ledger } = await build({ members: [null] })

        await expect(service.earn(paramsOf({ amountVnd: 5000 }))).resolves.toEqual({
            customerId: "c1",
            status: "no_points",
        })
        expect(ledger.post).not.toHaveBeenCalled()
    })

    it("answers duplicate for a sale posted before and does not look at the tier", async () => {
        const { service, customers } = await build({ members: [null], posted: null })

        await expect(service.earn(paramsOf())).resolves.toEqual({ customerId: "c1", status: "duplicate" })
        expect(customers.moveTier).not.toHaveBeenCalled()
    })

    it("fails when no customer can be made", async () => {
        const { service } = await build({ customerId: null })

        await expect(service.earn(paramsOf())).rejects.toMatchObject({ code: LoyaltyErrorCode.CustomerNotCreated })
    })

    describe("tier lift", () => {
        it("lifts a customer whose spend reached a higher tier", async () => {
            const lifted = memberOf({ tierKey: "dong", lifetimeSpendVnd: 3_500_000 })
            const { service, customers } = await build({ members: [memberOf(), lifted] })

            await service.earn(paramsOf())

            expect(customers.moveTier).toHaveBeenCalledWith({
                manager: expect.anything(),
                workspaceId: "ws-1",
                customerId: "c1",
                toKey: "bac",
                fromKey: "dong",
                nowIso: new Date(NOW).toISOString(),
            })
        })

        it("lifts a customer who had no tier yet", async () => {
            const { service, customers } = await build({
                members: [memberOf({ tierKey: null }), memberOf({ tierKey: null })],
            })

            await service.earn(paramsOf())

            expect(customers.moveTier).toHaveBeenCalledWith(expect.objectContaining({ toKey: "dong", fromKey: null }))
        })

        it("leaves a customer who already holds the tier their spend earns", async () => {
            const { service, customers } = await build({
                members: [null, memberOf({ tierKey: "bac", lifetimeSpendVnd: 3_500_000 })],
            })

            await service.earn(paramsOf())

            expect(customers.moveTier).not.toHaveBeenCalled()
        })

        it("does nothing when the customer cannot be read back", async () => {
            const { service, customers } = await build({ members: [null, null] })

            await service.earn(paramsOf())

            expect(customers.moveTier).not.toHaveBeenCalled()
        })

        it("does nothing for a programme without tiers", async () => {
            const { service, customers } = await build({
                members: [null, memberOf()],
                config: { ...CONFIG, tiers: [] },
            })

            await service.earn(paramsOf())

            expect(customers.moveTier).not.toHaveBeenCalled()
        })
    })
})
