import { mock } from "@starci/jest-preset"
import { SepayConnectionService } from "@modules/domain/channel-connections"
import { SepayFeedWebhookService } from "./sepay-feed-webhook.service"

const REAL = {
    id: 95958515,
    gateway: "MBBank",
    transferType: "in",
    transferAmount: 5000,
    content: "BUI NGUYEN DINH Test sepay Chuyen tien dat chau hoa- Ma GD ACSP/ 7o940",
    code: null,
    description: "BankAPINotify",
}

const build = () => {
    const page = mock<SepayConnectionService>()
    return { service: new SepayFeedWebhookService(page), page }
}

describe("SepayFeedWebhookService", () => {
    it("answers for the sepay provider and its inbox identity", () => {
        const { service } = build()

        expect([service.provider, service.inboxProvider]).toEqual(["sepay", "sepay-feed"])
    })

    it("reads the key SePay presents", () => {
        const { service } = build()

        expect(service.keyOf("Apikey abc")).toBe("abc")
        expect(service.keyOf("Bearer abc")).toBeUndefined()
    })

    it("reads a transfer in as a credit under the event id the poll uses", () => {
        const { service } = build()

        expect(service.read(REAL)).toEqual({
            kind: "transaction",
            credit: {
                amount: 5000,
                content: "BUI NGUYEN DINH Test sepay Chuyen tien dat chau hoa- Ma GD ACSP/ 7o940",
                eventId: "sepay:95958515",
                fallbackBankName: "MBBank",
            },
        })
    })

    it("reads a transfer out as a debit and falls back to the description, the code and SePay", () => {
        const { service } = build()

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
    ])("ignores %s", (_name, body) => {
        const { service } = build()

        expect(service.read(body)).toEqual({ kind: "ignored" })
    })

    it("reads a money delivery without a usable id as invalid, so a real credit is never lost quietly", () => {
        const { service } = build()

        expect(service.read({ ...REAL, id: 1.5 })).toEqual({ kind: "invalid" })
    })

    it("hands the connection page the intake to trace and the refusal to remember", async () => {
        const { service, page } = build()
        const intake = jest.fn().mockResolvedValue(undefined)
        page.traceIntake.mockResolvedValue(undefined)
        page.traceRefusal.mockResolvedValue(undefined)

        await service.traceIntake("conn-1", Buffer.from("{}"), intake)
        await service.traceRefusal("conn-1")

        expect(page.traceIntake).toHaveBeenCalledWith("conn-1", Buffer.from("{}"), intake)
        expect(page.traceRefusal).toHaveBeenCalledWith("conn-1")
    })
})
