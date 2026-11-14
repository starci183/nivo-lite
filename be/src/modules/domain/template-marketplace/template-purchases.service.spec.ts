import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import {
    AgentTemplateInstallerService,
    TemplateRecordsService,
    type TemplateLicenseView,
} from "@modules/domain/agent-templates"
import type { PayableOrder } from "@modules/domain/billing"
import type { PaymentOrder } from "@modules/domain/payment-orders"
import { CreditsService } from "@modules/domain/credits"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { TemplateMarketplaceError, TemplateMarketplaceErrorCode } from "./errors/template-marketplace.error"
import { TemplateListingsService } from "./template-listings.service"
import { TemplatePurchasesService } from "./template-purchases.service"
import { TemplateListingEntity } from "./persistence/entities"

const BUYER = "99999999-9999-4999-8999-999999999999"
const listing = (priceVnd: number): TemplateListingEntity =>
    Object.assign(new TemplateListingEntity(), {
        id: "listing-1",
        templateKey: "spa-booking-by-linh",
        version: 2,
        priceVnd,
    })

const licenseView = (over: Partial<TemplateLicenseView>): TemplateLicenseView => ({
    id: "license-1",
    kind: "paid",
    installationId: null,
    status: "active",
    ...over,
})

const payable = mock<PayableOrder>({ order: mock<PaymentOrder>({ id: "order-1" }) })
const REQUEST = {
    workspaceId: "ws-buyer",
    listingId: "listing-1",
    values: { autoLimit: 8_000_000 },
    name: null,
    locale: "vi" as const,
}

const build = async (price: number, license: TemplateLicenseView | null = null) => {
    const records = mock<TemplateRecordsService>({ unclaimedPaidLicense: jest.fn().mockResolvedValue(license) })
    const listings = mock<TemplateListingsService>({
        approved: jest.fn().mockResolvedValue({ row: listing(price), card: {} }),
    })
    const installer = mock<AgentTemplateInstallerService>({
        install: jest.fn().mockResolvedValue({ installationId: "inst-1" }),
    })
    const credits = mock<CreditsService>({ agentTemplate: jest.fn().mockResolvedValue(payable) })
    const members = mock<WorkspaceMembersService>({ require: jest.fn().mockResolvedValue({}) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            TemplatePurchasesService,
            { provide: TemplateRecordsService, useValue: records },
            { provide: TemplateListingsService, useValue: listings },
            { provide: AgentTemplateInstallerService, useValue: installer },
            { provide: CreditsService, useValue: credits },
            { provide: WorkspaceMembersService, useValue: members },
        ],
    }).compile()
    return { service: moduleRef.get(TemplatePurchasesService), installer, credits, members }
}

const codeOf = async (work: Promise<unknown>): Promise<unknown> => {
    try {
        await work
        return null
    } catch (cause) {
        return cause instanceof TemplateMarketplaceError ? cause.code : cause
    }
}

describe("TemplatePurchasesService.install", () => {
    it("installs a free listing at once, as a free license, for the owner of the workspace", async () => {
        const { service, installer, members } = await build(0)

        await service.install(BUYER, REQUEST)

        expect(members.require).toHaveBeenCalledWith(BUYER, "ws-buyer", ["owner"])
        expect(installer.install).toHaveBeenCalledWith(
            BUYER,
            expect.objectContaining({
                key: "spa-booking-by-linh",
                version: 2,
                access: { kind: "licensed", license: "free", listingId: "listing-1", licenseId: null },
            }),
        )
    })

    it("reads the values the form gave, keeps the label the buyer chose, and drops what is not a number, a text or yes or no", async () => {
        const { service, installer } = await build(0)

        await service.install(BUYER, {
            ...REQUEST,
            values: { autoLimit: 8_000_000, nested: { a: 1 } },
            name: "Spa Linh",
        })

        expect(installer.install).toHaveBeenCalledWith(
            BUYER,
            expect.objectContaining({ values: { autoLimit: 8_000_000 }, name: "Spa Linh" }),
        )
    })

    it("installs a paid listing on the license a settled order wrote, and not before", async () => {
        const paid = await build(990_000, licenseView({ installationId: null }))
        const unpaid = await build(990_000, null)

        await paid.service.install(BUYER, REQUEST)

        expect(paid.installer.install).toHaveBeenCalledWith(
            BUYER,
            expect.objectContaining({
                access: { kind: "licensed", license: "paid", listingId: "listing-1", licenseId: "license-1" },
            }),
        )
        expect(await codeOf(unpaid.service.install(BUYER, REQUEST))).toBe(TemplateMarketplaceErrorCode.PaymentRequired)
        expect(unpaid.installer.install).not.toHaveBeenCalled()
    })

    it("refuses a paid license that already runs an installation, so one payment is one install", async () => {
        const used = await build(990_000, licenseView({ installationId: "inst-9" }))

        expect(await codeOf(used.service.install(BUYER, REQUEST))).toBe(TemplateMarketplaceErrorCode.PaymentRequired)
        expect(used.installer.install).not.toHaveBeenCalled()
    })
})

describe("TemplatePurchasesService.order", () => {
    it("asks the payment rails for an order of the price of a paid listing", async () => {
        const { service, credits } = await build(990_000)

        const order = await service.order(BUYER, "ws-buyer", "listing-1")

        expect(order.order.id).toBe("order-1")
        expect(credits.agentTemplate).toHaveBeenCalledWith(BUYER, {
            workspaceId: "ws-buyer",
            listingId: "listing-1",
            templateKey: "spa-booking-by-linh",
            version: 2,
            amountVnd: 990_000,
        })
    })

    it("has no order for a free listing", async () => {
        const { service, credits } = await build(0)

        expect(await codeOf(service.order(BUYER, "ws-buyer", "listing-1"))).toBe(
            TemplateMarketplaceErrorCode.NothingToPay,
        )
        expect(credits.agentTemplate).not.toHaveBeenCalled()
    })
})
