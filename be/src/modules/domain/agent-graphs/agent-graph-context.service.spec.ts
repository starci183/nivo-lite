import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { ToolRegistryService } from "@modules/domain/tools"
import { FACTS } from "@tests/fixtures/builders/agent-graph.builder"
import { AgentGraphContextService } from "./agent-graph-context.service"
import { GraphFactsService } from "./graph-facts.service"

const SCOPE = { workspaceId: "ws-1", agentId: "agent-1", installationId: "inst-1", moduleKey: "accounting" }

const build = async () => {
    const facts = mock<GraphFactsService>({ registry: jest.fn().mockReturnValue(FACTS) })
    const gateway = mock<ToolRegistryService>({
        grantsOf: jest.fn().mockResolvedValue([
            { tool: "nivo.tool.connection.status.get", mode: "auto", limitVnd: null, constraints: [] },
            { tool: "nivo.tool.brain.*", mode: "ask", limitVnd: null, constraints: [] },
        ]),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentGraphContextService,
            { provide: GraphFactsService, useValue: facts },
            { provide: ToolRegistryService, useValue: gateway },
        ],
    }).compile()
    return { service: moduleRef.get(AgentGraphContextService), gateway }
}

describe("AgentGraphContextService.contextOf facts", () => {
    it("holds the declared facts", async () => {
        const { service } = await build()

        expect((await service.contextOf(SCOPE)).facts).toEqual(FACTS)
    })
})

describe("AgentGraphContextService.contextOf grants", () => {
    it("grants a tool by its name or its connector wildcard, and not a tool no grant holds", async () => {
        const { service, gateway } = await build()

        const context = await service.contextOf(SCOPE)

        expect(gateway.grantsOf).toHaveBeenCalledWith("ws-1", "agent-1")
        expect(context.isGranted("nivo.tool.connection.status.get")).toBe(true)
        expect(context.isGranted("nivo.tool.brain.fact.list")).toBe(true)
        expect(context.isGranted("drive.search")).toBe(false)
        expect(context.isGranted("zalo.send")).toBe(false)
    })
})
