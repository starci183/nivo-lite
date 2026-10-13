import { Test } from "@nestjs/testing"
import { AgentToolsError } from "./errors/agent-tools.error"
import { UnboundBookingToolsService } from "./unbound-booking-tools.service"

describe("UnboundBookingToolsService", () => {
    it("refuses to find booking slots with the exact unavailable tool", async () => {
        const moduleRef = await Test.createTestingModule({
            providers: [UnboundBookingToolsService],
        }).compile()
        const subject = moduleRef.get(UnboundBookingToolsService)

        const result = subject.run({ workspaceId: "workspace-1" }, "booking.find_slots")

        await expect(result).rejects.toBeInstanceOf(AgentToolsError)
        await expect(result).rejects.toHaveProperty("code", "AGENT_TOOLS_TOOL_UNAVAILABLE")
        await expect(result).rejects.toHaveProperty("params", { tool: "booking.find_slots" })
    })

    it("refuses to request a booking with the exact unavailable tool", async () => {
        const moduleRef = await Test.createTestingModule({
            providers: [UnboundBookingToolsService],
        }).compile()
        const subject = moduleRef.get(UnboundBookingToolsService)

        const result = subject.run({ workspaceId: "workspace-2" }, "booking.request")

        await expect(result).rejects.toBeInstanceOf(AgentToolsError)
        await expect(result).rejects.toHaveProperty("code", "AGENT_TOOLS_TOOL_UNAVAILABLE")
        await expect(result).rejects.toHaveProperty("params", { tool: "booking.request" })
    })
})
