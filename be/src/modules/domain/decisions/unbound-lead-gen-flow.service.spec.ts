import { Test } from "@nestjs/testing"
import { UnboundLeadGenFlowService } from "./unbound-lead-gen-flow.service"

describe("UnboundLeadGenFlowService", () => {
    it("starts no next step after a work item finishes", async () => {
        const moduleRef = await Test.createTestingModule({
            providers: [UnboundLeadGenFlowService],
        }).compile()
        const subject = moduleRef.get(UnboundLeadGenFlowService)

        await expect(subject.continueAfter()).resolves.toBeUndefined()
    })
})
