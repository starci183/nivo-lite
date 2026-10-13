import { Test } from "@nestjs/testing"
import { UnboundDecisionEventsService } from "./unbound-decision-events.service"

describe("UnboundDecisionEventsService", () => {
    it("emits no event when a decision is made", async () => {
        const moduleRef = await Test.createTestingModule({
            providers: [UnboundDecisionEventsService],
        }).compile()
        const subject = moduleRef.get(UnboundDecisionEventsService)

        await expect(subject.decisionMade()).resolves.toBeUndefined()
    })
})
