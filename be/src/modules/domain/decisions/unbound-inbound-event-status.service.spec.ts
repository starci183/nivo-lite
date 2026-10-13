import { Test } from "@nestjs/testing"
import { UnboundInboundEventStatusService } from "./unbound-inbound-event-status.service"

describe("UnboundInboundEventStatusService", () => {
    it("marks no inbound event", async () => {
        const moduleRef = await Test.createTestingModule({
            providers: [UnboundInboundEventStatusService],
        }).compile()
        const subject = moduleRef.get(UnboundInboundEventStatusService)

        await expect(subject.mark()).resolves.toBeUndefined()
    })
})
