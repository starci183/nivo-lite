import { AgentGraphsModule } from "./agent-graphs.module"
import { AgentGraphContextService } from "./agent-graph-context.service"
import { AgentGraphFlowRunsService } from "./agent-graph-flow-runs.service"
import { AgentGraphsService } from "./agent-graphs.service"
import { AgentWorkflowRunsService } from "./agent-workflow-runs.service"
import { AgentWorkflowStartService } from "./agent-workflow-start.service"
import { AgentWorkflowsAdminService } from "./agent-workflows-admin.service"

describe("AgentGraphsModule doors only (the mcp app: people's doors to the workflows, no engine)", () => {
    it("registers the workflows' reads and the hand-off that starts one, and none of the engine that walks a graph", () => {
        const module = AgentGraphsModule.register({ doorsOnly: true })
        const providers = module.providers ?? []

        for (const door of [AgentGraphsService, AgentWorkflowsAdminService, AgentWorkflowRunsService, AgentWorkflowStartService])
            expect(providers).toContain(door)
        for (const engine of [AgentGraphContextService, AgentGraphFlowRunsService]) expect(providers).not.toContain(engine)
        expect(module.exports).toContain(AgentWorkflowStartService)
    })
})
