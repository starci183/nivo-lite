import { mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { AgentConversationsService } from "@modules/domain/agent-conversations"
import { AgentMessagesService } from "@modules/domain/agent-messages"
import { ChannelDeliveryService } from "@modules/domain/channels"
import { EvidenceService } from "@modules/domain/decisions"
import { CustomerDeliveryService } from "./customer-delivery.service"
import { PerformerKitService } from "./performer-kit.service"

describe("CustomerDeliveryService", () => {
    const build = async () => {
        const conversations = mock<AgentConversationsService>()
        const moduleRef = await Test.createTestingModule({
            providers: [
                CustomerDeliveryService,
                { provide: PerformerKitService, useValue: mock<PerformerKitService>() },
                { provide: AgentConversationsService, useValue: conversations },
                { provide: AgentMessagesService, useValue: mock<AgentMessagesService>() },
                { provide: ChannelDeliveryService, useValue: mock<ChannelDeliveryService>() },
                { provide: EvidenceService, useValue: mock<EvidenceService>() },
            ],
        }).compile()
        return { service: moduleRef.get(CustomerDeliveryService), conversations }
    }

    it("uses the phone when the customer has one", async () => {
        const { service, conversations } = await build()

        await expect(service.contactOf("ws-1", { id: "lead-1", phone: "0901234567", email: "a@b.co" })).resolves.toBe(
            "0901234567",
        )

        expect(conversations.latestOfLead).not.toHaveBeenCalled()
    })

    it("uses the email when there is no phone", async () => {
        const { service } = await build()

        await expect(service.contactOf("ws-1", { id: "lead-1", phone: null, email: "a@b.co" })).resolves.toBe("a@b.co")
    })
})
