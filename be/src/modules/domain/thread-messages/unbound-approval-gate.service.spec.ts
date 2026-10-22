import { Test } from "@nestjs/testing"
import { ThreadMessagesErrorCode } from "./errors/thread-messages.error"
import { UnboundApprovalGateService } from "./unbound-approval-gate.service"

const build = async () => {
    const moduleRef = await Test.createTestingModule({ providers: [UnboundApprovalGateService] }).compile()
    return moduleRef.get(UnboundApprovalGateService)
}

describe("UnboundApprovalGateService", () => {
    it("refuses to open a request while the approval capability is not bound", async () => {
        const gate = await build()

        await expect(gate.open()).rejects.toMatchObject({ code: ThreadMessagesErrorCode.ApprovalUnbound })
    })

    it("refuses to record a verdict while the approval capability is not bound", async () => {
        const gate = await build()

        await expect(gate.decide()).rejects.toMatchObject({ code: ThreadMessagesErrorCode.ApprovalUnbound })
    })
})
