import { Test } from "@nestjs/testing"
import { AgentToolsError } from "./errors/agent-tools.error"
import { UnboundLeadWriterService } from "./unbound-lead-writer.service"

describe("UnboundLeadWriterService", () => {
    it("refuses a lead write with the exact unavailable tool", async () => {
        const moduleRef = await Test.createTestingModule({
            providers: [UnboundLeadWriterService],
        }).compile()
        const subject = moduleRef.get(UnboundLeadWriterService)

        const result = subject.createOrUpdate()

        await expect(result).rejects.toBeInstanceOf(AgentToolsError)
        await expect(result).rejects.toHaveProperty("code", "AGENT_TOOLS_TOOL_UNAVAILABLE")
        await expect(result).rejects.toHaveProperty("params", { tool: "lead.create_or_update" })
    })
})
