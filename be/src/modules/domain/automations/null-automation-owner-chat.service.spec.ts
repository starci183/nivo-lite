import { Test } from "@nestjs/testing"
import { NullAutomationOwnerChat } from "./null-automation-owner-chat.service"

describe("NullAutomationOwnerChat", () => {
    it("reports that no owner chat was reached", async () => {
        const moduleRef = await Test.createTestingModule({ providers: [NullAutomationOwnerChat] }).compile()
        const chat = moduleRef.get(NullAutomationOwnerChat)

        await expect(chat.sendToOwner("ws-1", "Daily report")).resolves.toBe(false)
    })
})
