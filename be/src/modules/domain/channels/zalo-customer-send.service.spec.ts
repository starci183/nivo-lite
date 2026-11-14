import { mock } from "@starci/jest-preset"
import { connectionRecord } from "@tests/fixtures/builders/connection-records.builder"
import type { ZaloClient } from "@modules/integrations/zalo"
import type { CustomerSendPort } from "./customer-send-ports.contracts"
import { ZaloCustomerSendService } from "./zalo-customer-send.service"
import { ZaloCredentialsService } from "./zalo-credentials.service"
import { ZaloDeliveryService } from "./zalo-delivery.service"

const build = () => {
    const delivery = mock<ZaloDeliveryService>()
    const credentials = mock<ZaloCredentialsService>()
    const zalo = mock<ZaloClient>()
    return { delivery, credentials, zalo, service: new ZaloCustomerSendService(delivery, credentials, zalo) }
}

describe("ZaloCustomerSendService (the live Zalo send behind the port)", () => {
    it("hands the target, the Zalo user id and the request to the Zalo route unchanged and answers its result", async () => {
        const { delivery, service } = build()
        const result = { delivered: true, failure: null, outcome: "acknowledged", via: "consultation" } as const
        delivery.send.mockResolvedValue(result)
        const target = { id: "route-1", workspaceId: "ws-1", channel: "zalo", externalId: "u-1", connectionId: "z1" }
        const request = { workspaceId: "ws-1", conversationId: "route-1", messageId: "m-1", text: "Hi", windowChecked: true, at: new Date(0) }

        expect(service.provider).toBe("zalo_oa")
        await expect(service.send(connectionRecord({ provider: "zalo_oa" }), target, "u-1", request)).resolves.toBe(result)
        expect(delivery.send).toHaveBeenCalledWith(target, "u-1", request)
    })

    it("sends a staff text through the OA's text route with the connection, the recipient and the words, and rethrows its failure", async () => {
        const { delivery, service } = build()
        const account = connectionRecord({ id: "z1", provider: "zalo_oa" })
        delivery.sendText.mockResolvedValueOnce(undefined)

        await expect(
            service.sendToPerson(account, { workspaceId: "ws-1", connectionId: "z1", provider: "zalo_oa", recipientId: "user-1", text: "Shift" }),
        ).resolves.toBeUndefined()
        expect(delivery.sendText).toHaveBeenCalledWith("z1", "user-1", "Shift")

        delivery.sendText.mockRejectedValueOnce(new Error("refused"))
        await expect(
            service.sendToPerson(account, { workspaceId: "ws-1", connectionId: "z1", provider: "zalo_oa", recipientId: "user-1", text: "Shift" }),
        ).rejects.toThrow("refused")
    })

    it("reads the customer's name from Zalo with the OA's token", async () => {
        const { credentials, zalo, service } = build()
        credentials.accessToken.mockResolvedValue("access-1")
        zalo.userDisplayName.mockResolvedValue("Minh")

        await expect(service.nameOf(connectionRecord({ id: "z1", provider: "zalo_oa" }), "user-1")).resolves.toBe("Minh")
        expect(credentials.accessToken).toHaveBeenCalledWith("z1")
        expect(zalo.userDisplayName).toHaveBeenCalledWith("access-1", "user-1")
    })

    it("has no typing: Zalo shows none", () => {
        const port: CustomerSendPort = build().service

        expect(port.showTyping).toBeUndefined()
    })
})
