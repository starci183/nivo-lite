import { Test } from "@nestjs/testing"
import { UnboundConversationLeadsService } from "./unbound-conversation-leads.service"

describe("UnboundConversationLeadsService", () => {
    it("returns no lead when the conversation capability is unbound", async () => {
        const moduleRef = await Test.createTestingModule({
            providers: [UnboundConversationLeadsService],
        }).compile()
        const subject = moduleRef.get(UnboundConversationLeadsService)

        await expect(subject.leadIdOf()).resolves.toBeNull()
    })
})
