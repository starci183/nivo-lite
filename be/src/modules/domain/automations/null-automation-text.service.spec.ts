import { Test } from "@nestjs/testing"
import type { AutomationTextRequest } from "./automation-ports.contracts"
import { NullAutomationText } from "./null-automation-text.service"

describe("NullAutomationText", () => {
    it.each<AutomationTextRequest["purpose"]>(["personalize", "per_case", "classify"])(
        "answers none for a %s request",
        async (purpose) => {
            const moduleRef = await Test.createTestingModule({ providers: [NullAutomationText] }).compile()
            const service = moduleRef.get(NullAutomationText)

            await expect(
                service.generate({ workspaceId: "ws-1", purpose, system: "instructions", prompt: "input" }),
            ).resolves.toBeNull()
        },
    )
})
