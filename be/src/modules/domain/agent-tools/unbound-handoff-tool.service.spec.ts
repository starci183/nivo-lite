import { Test } from "@nestjs/testing"
import { AgentToolsError } from "./errors/agent-tools.error"
import { UnboundHandoffToolService } from "./unbound-handoff-tool.service"

describe("UnboundHandoffToolService", () => {
    it("refuses handoff with the exact unavailable tool", async () => {
        const moduleRef = await Test.createTestingModule({
            providers: [UnboundHandoffToolService],
        }).compile()
        const subject = moduleRef.get(UnboundHandoffToolService)

        const result = subject.handoff()

        await expect(result).rejects.toBeInstanceOf(AgentToolsError)
        await expect(result).rejects.toHaveProperty("code", "AGENT_TOOLS_TOOL_UNAVAILABLE")
        await expect(result).rejects.toHaveProperty("params", { tool: "handoff.to_person" })
    })
})
