import { Test } from "@nestjs/testing"
import { ChatApprovalDecisionService } from "./chat-approval-decision.service"

describe("ChatApprovalDecisionService.decide", () => {
    it("refuses every verdict as decision_not_found and writes nothing", async () => {
        const container = await Test.createTestingModule({ providers: [ChatApprovalDecisionService] }).compile()

        await expect(container.get(ChatApprovalDecisionService).decide()).resolves.toEqual({
            ok: false,
            refusal: "decision_not_found",
        })
    })
})
