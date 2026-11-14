import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import { AgentTemplateVersionsService, TemplateRecordsService } from "@modules/domain/agent-templates"
import { PaymentOrdersService, type PaymentOrder } from "@modules/domain/payment-orders"
import { CREATOR } from "@tests/fixtures/builders/agent-template.builder"
import { CreatorLedgerEntryEntity, TemplateListingEntity } from "./persistence/entities"
import { TemplatePaymentsService } from "./template-payments.service"

const ORDER: PaymentOrder = {
    id: "order-1",
    workspaceId: "ws-buyer",
    planCode: "pro",
    amountVnd: 990_000,
    orderCode: "NIVO8F3K2",
    status: "paid",
    expiresAt: "2026-11-03T03:00:00.000Z",
    paidAt: "2026-11-03T02:30:00.000Z",
    createdAt: "2026-11-03T02:00:00.000Z",
    kind: "agent_template",
    packCode: null,
    detail: { listingId: "listing-1", templateKey: "spa-booking-by-linh", version: 1 },
}

const listing = Object.assign(new TemplateListingEntity(), {
    id: "listing-1",
    templateKey: "spa-booking-by-linh",
    version: 1,
    revenueSharePct: 70,
})

interface Options {
    readonly order?: PaymentOrder | null
    readonly listing?: TemplateListingEntity | null
    readonly template?: object | null
    readonly licensed?: boolean
}

const build = async (options: Options = {}) => {
    const orders = mock<PaymentOrdersService>({
        findByCode: jest.fn().mockResolvedValue(options.order === undefined ? ORDER : options.order),
    })
    const versions = mock<AgentTemplateVersionsService>({
        templateOf: jest
            .fn()
            .mockResolvedValue(
                options.template === undefined ? { creatorAccountId: CREATOR.accountId } : options.template,
            ),
    })
    const em = mockEntityManager({
        findOne: [[TemplateListingEntity, options.listing === undefined ? listing : options.listing]],
        insert: [CreatorLedgerEntryEntity, {}],
    })
    const records = mock<TemplateRecordsService>({
        hasLicenseForOrder: jest.fn().mockResolvedValue(options.licensed === true),
        grantPaid: jest.fn().mockResolvedValue(undefined),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            TemplatePaymentsService,
            { provide: PaymentOrdersService, useValue: orders },
            { provide: AgentTemplateVersionsService, useValue: versions },
            { provide: TemplateRecordsService, useValue: records },
        ],
    }).compile()
    return { service: moduleRef.get(TemplatePaymentsService), em, orders, records }
}

describe("TemplatePaymentsService.fulfil", () => {
    it("writes the license of the workspace and the two ledger lines of the sale from a paid order, in the transaction that settled it", async () => {
        const { service, em, orders, records } = await build()

        await service.fulfil(em, "nivo8f3k2")

        expect(orders.findByCode).toHaveBeenCalledWith("nivo8f3k2", em)
        expect(records.grantPaid).toHaveBeenCalledWith(em, {
            workspaceId: "ws-buyer",
            templateKey: "spa-booking-by-linh",
            listingId: "listing-1",
            orderId: "order-1",
        })
        expect(em.insert).toHaveBeenCalledWith(CreatorLedgerEntryEntity, [
            expect.objectContaining({
                kind: "creator_share",
                amountVnd: 693_000,
                creatorAccountId: CREATOR.accountId,
                orderId: "order-1",
                listingId: "listing-1",
                workspaceId: "ws-buyer",
            }),
            expect.objectContaining({ kind: "platform_fee", amountVnd: 297_000 }),
        ])
    })

    it("splits by the share of the listing, so the two lines always add up to the amount paid", async () => {
        const { service, em } = await build({
            listing: Object.assign(new TemplateListingEntity(), { ...listing, revenueSharePct: 33 }),
        })

        await service.fulfil(em, "NIVO8F3K2")

        const lines: unknown = em.insert.mock.calls.find((call) => call[0] === CreatorLedgerEntryEntity)?.[1]
        const amounts = Array.isArray(lines)
            ? lines.map((line: CreatorLedgerEntryEntity) => Number(line.amountVnd))
            : []
        expect(amounts.reduce((sum, amount) => sum + amount, 0)).toBe(990_000)
    })

    it("writes nothing twice when the delivery is processed again", async () => {
        const { service, em, records } = await build({ licensed: true })

        await service.fulfil(em, "NIVO8F3K2")

        expect(records.grantPaid).not.toHaveBeenCalled()
        expect(em.insert).not.toHaveBeenCalled()
    })

    it("leaves alone an order of another kind, one not paid, one that does not exist, and a listing or template that is gone", async () => {
        for (const options of [
            { order: { ...ORDER, kind: "credit_pack" as const } },
            { order: { ...ORDER, status: "pending" as const } },
            { order: null },
            { listing: null },
            { template: null },
        ]) {
            const { service, em } = await build(options)

            await service.fulfil(em, "NIVO8F3K2")

            expect(em.insert).not.toHaveBeenCalled()
        }
    })

    it("reads a listing id that is missing from the order as no listing", async () => {
        const { service, em } = await build({ order: { ...ORDER, detail: {} }, listing: null })

        await service.fulfil(em, "NIVO8F3K2")

        expect(em.insert).not.toHaveBeenCalled()
    })
})
