import { Test } from "@nestjs/testing"
import { UnboundUsageGateService } from "./unbound-usage-gate.service"

describe("UnboundUsageGateService", () => {
    it("does not block text generation", async () => {
        const moduleRef = await Test.createTestingModule({
            providers: [UnboundUsageGateService],
        }).compile()
        const subject = moduleRef.get(UnboundUsageGateService)

        await expect(subject.blockedBy()).resolves.toBeNull()
    })

    it("does not meter text generation usage", async () => {
        const moduleRef = await Test.createTestingModule({
            providers: [UnboundUsageGateService],
        }).compile()
        const subject = moduleRef.get(UnboundUsageGateService)

        await expect(subject.record()).resolves.toBeUndefined()
    })
})
