import { Test } from "@nestjs/testing"
import { CustomerFinalReplyService } from "./customer-final-reply.service"

describe("CustomerFinalReplyService", () => {
    it("owes no final reply until the output steps land", async () => {
        const moduleRef = await Test.createTestingModule({ providers: [CustomerFinalReplyService] }).compile()

        expect(moduleRef.get(CustomerFinalReplyService).owedOf({ turn: { text: "x" } })).toBeNull()
    })
})
