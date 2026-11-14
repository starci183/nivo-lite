import { mock } from "@starci/jest-preset"
import { connectionRecord } from "@tests/fixtures/builders/connection-records.builder"
import type { CustomerSendPort } from "@modules/domain/channels"
import { MetaChannelSender } from "./meta-channel-sender.service"
import { MetaCustomerSendService } from "./meta-customer-send.service"

const ACCOUNT = connectionRecord({ id: "m1", workspaceId: "ws-1", provider: "meta" })
const TARGET = { id: "route-1", workspaceId: "ws-1", channel: "facebook", externalId: "person-1:archived", connectionId: "m1" }
const REQUEST = { workspaceId: "ws-1", conversationId: "route-1", messageId: "m-1", text: "Hello", at: new Date(0) }

describe("MetaCustomerSendService (the live Page sender behind the port)", () => {
    it("hands the target and the text to the Page sender unchanged and answers its yes as an acknowledged delivery", async () => {
        const sender = mock<MetaChannelSender>()
        sender.send.mockResolvedValue(true)
        const service = new MetaCustomerSendService(sender)

        expect(service.provider).toBe("meta")
        await expect(service.send(ACCOUNT, TARGET, "person-1", REQUEST)).resolves.toEqual({ delivered: true, failure: null, outcome: "acknowledged" })
        expect(sender.send).toHaveBeenCalledWith(TARGET, "Hello")
    })

    it("answers the sender's no as an unknown outcome, as the engine always read it", async () => {
        const sender = mock<MetaChannelSender>()
        sender.send.mockResolvedValue(false)

        await expect(new MetaCustomerSendService(sender).send(ACCOUNT, { ...TARGET, channel: "instagram" }, "person-1", REQUEST)).resolves.toEqual({
            delivered: false,
            failure: null,
            outcome: "ambiguous",
        })
    })

    it("has no staff text, no name read and no typing", () => {
        const service: CustomerSendPort = new MetaCustomerSendService(mock<MetaChannelSender>())

        expect([service.sendToPerson, service.nameOf, service.showTyping]).toEqual([undefined, undefined, undefined])
    })
})
