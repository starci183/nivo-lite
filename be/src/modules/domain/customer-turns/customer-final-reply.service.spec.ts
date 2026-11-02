import { Test } from "@nestjs/testing"
import { CustomerFinalReplyService } from "./customer-final-reply.service"
import { outputResultOf } from "./output-steps.policy"

const build = async () => {
    const moduleRef = await Test.createTestingModule({ providers: [CustomerFinalReplyService] }).compile()
    return moduleRef.get(CustomerFinalReplyService)
}

describe("CustomerFinalReplyService", () => {
    it("owes no final reply when no output came to something", async () => {
        expect((await build()).owedOf({ turn: { text: "x" } })).toBeNull()
    })

    it("owes the final reply once an output ran", async () => {
        const result = outputResultOf(
            { tool: "orders.draft", status: "ok", code: null, summary: "ORD-1" },
            {
                conversationId: "c1",
                messageId: "m1",
                approvedBy: null,
                workItemId: null,
                planned: "",
                declined: false,
                outputNode: "act:gateway_call",
                approvalNode: "ask:gateway_call",
                replyNode: "act:reply_customer",
            },
        )
        expect((await build()).owedOf({ "output:orders.draft:1": result })).toMatchObject({ kind: "final_reply" })
    })
})
