import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { SepayConnectionService } from "@modules/domain/channel-connections"
import { FeedWebhookRegistryService } from "@modules/domain/provider-registry"
import { SepayFeedWebhookService } from "./sepay-feed-webhook.service"

const REAL = {
    id: 95958515,
    gateway: "MBBank",
    transferType: "in",
    transferAmount: 5000,
    content: "BUI NGUYEN DINH Test sepay Chuyen tien dat chau hoa- Ma GD ACSP/ 7o940",
    code: null,
    description: "BankAPINotify",
    accountNumber: "0123456789",
    transactionDate: "2026-11-03 18:06:00",
}

const build = async () => {
    const page = mock<SepayConnectionService>()
    const webhooks = mock<FeedWebhookRegistryService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            SepayFeedWebhookService,
            { provide: SepayConnectionService, useValue: page },
            { provide: FeedWebhookRegistryService, useValue: webhooks },
        ],
    }).compile()
    return { service: moduleRef.get(SepayFeedWebhookService), page, webhooks }
}

describe("SepayFeedWebhookService", () => {
    it("answers for the sepay provider and its inbox identity", async () => {
        const { service } = await build()

        expect([service.provider, service.inboxProvider]).toEqual(["sepay", "sepay-feed"])
    })

    it("registers itself with the webhook registry when the app starts", async () => {
        const { service, webhooks } = await build()

        service.onModuleInit()

        expect(webhooks.register).toHaveBeenCalledWith(service)
    })

    it("reads the key SePay presents", async () => {
        const { service } = await build()

        expect(service.keyOf("Apikey abc")).toBe("abc")
        expect(service.keyOf("Bearer abc")).toBeUndefined()
    })

    it("reads a transfer in as a credit under the event id the poll uses", async () => {
        const { service } = await build()

        expect(service.read(REAL)).toEqual({
            kind: "transaction",
            credit: {
                amount: 5000,
                content: "BUI NGUYEN DINH Test sepay Chuyen tien dat chau hoa- Ma GD ACSP/ 7o940",
                eventId: "sepay:95958515",
                fallbackBankName: "MBBank",
                account: "0123456789",
                occurredAt: "2026-11-03T11:06:00.000Z",
            },
        })
    })

    it("reads a transfer out as a debit and falls back to the description, the code and SePay", async () => {
        const { service } = await build()

        expect(service.read({ ...REAL, transferType: "out", content: null, gateway: undefined })).toMatchObject({
            kind: "transaction",
            credit: { direction: "debit", content: "BankAPINotify", fallbackBankName: "SePay" },
        })
        expect(service.read({ id: 1, transferType: "in", transferAmount: 1, code: "DH7" })).toMatchObject({
            credit: { content: "DH7" },
        })
        expect(service.read({ id: 1, transferType: "in", transferAmount: 1 })).toMatchObject({
            credit: { content: "" },
        })
    })

    it.each([
        ["the test ping", {}],
        ["a transfer that is neither in nor out", { ...REAL, transferType: "refund" }],
        ["a transfer of no money", { ...REAL, transferAmount: 0 }],
        ["an unreadable amount", { ...REAL, transferAmount: "lots" }],
    ])("ignores %s", async (_name, body) => {
        const { service } = await build()

        expect(service.read(body)).toEqual({ kind: "ignored" })
    })

    it("reads a money delivery without a usable id as invalid, so a real credit is never lost quietly", async () => {
        const { service } = await build()

        expect(service.read({ ...REAL, id: 1.5 })).toEqual({ kind: "invalid" })
    })
})

describe("SepayFeedWebhookService, the connection page", () => {
    it("hands the connection page the intake to trace and the refusal to remember", async () => {
        const { service, page } = await build()
        const intake = jest.fn().mockResolvedValue(undefined)
        page.traceIntake.mockResolvedValue(undefined)
        page.traceRefusal.mockResolvedValue(undefined)

        await service.traceIntake("conn-1", Buffer.from("{}"), intake)
        await service.traceRefusal("conn-1")

        expect(page.traceIntake).toHaveBeenCalledWith("conn-1", Buffer.from("{}"), intake)
        expect(page.traceRefusal).toHaveBeenCalledWith("conn-1")
    })
})
