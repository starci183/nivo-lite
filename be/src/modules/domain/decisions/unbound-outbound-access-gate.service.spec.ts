import { Test } from "@nestjs/testing"
import { UnboundOutboundAccessGateService } from "./unbound-outbound-access-gate.service"

describe("UnboundOutboundAccessGateService", () => {
    it("allows automatic outbound work under the rule alone", async () => {
        const moduleRef = await Test.createTestingModule({
            providers: [UnboundOutboundAccessGateService],
        }).compile()
        const subject = moduleRef.get(UnboundOutboundAccessGateService)

        await expect(subject.accessOf()).resolves.toBe("auto")
    })
})
