import { mock } from "@starci/jest-preset"
import { AgentTagService } from "@modules/domain/agent-work"
import { AgentDirectoryService } from "@modules/domain/agents"
import { ModuleJobRunnerService } from "@modules/domain/entity-engine"
import type { WorkflowStart } from "@nivo-lite/agent-sdk/mutation"
import { EntityEngineDoorErrorCode } from "./errors/entity-engine-door.error"
import { EngineWorkflowService } from "./engine-workflow.service"

const REQUEST: WorkflowStart = {
    moduleKey: "accounting",
    workflow: "reconcile",
    version: "latest",
    inputs: { transactionId: "t-1" },
    dedupeKey: "rematch:t-1:o-1",
}

const build = (
    agentIds: Array<string> = ["a-1"],
    tagged: Awaited<ReturnType<AgentTagService["tagAgent"]>> = { tagged: true, wakeId: "w-1" },
) => {
    const agents = mock<AgentDirectoryService>()
    agents.idsOfModule.mockResolvedValue(agentIds)
    const tags = mock<AgentTagService>()
    tags.tagAgent.mockResolvedValue(tagged)
    const runner = mock<ModuleJobRunnerService>()
    return { service: new EngineWorkflowService(agents, tags, runner), tags, runner }
}

describe("EngineWorkflowService", () => {
    it("binds itself to the job runner at boot", () => {
        const { service, runner } = build()
        service.onModuleInit()
        expect(runner.bindWorkflow).toHaveBeenCalledWith(service)
    })

    it("wakes the module's agent with a tag pinned to the workflow, the inputs as its params, keyed by the dedupe key", async () => {
        const { service, tags } = build()
        await expect(
            service.workflowApi({ workspaceId: "ws-1", scopeOpen: () => false }).start(REQUEST),
        ).resolves.toEqual({ started: true })
        expect(tags.tagAgent).toHaveBeenCalledWith(
            expect.objectContaining({
                source: "engine.workflow",
                workspaceId: "ws-1",
                toAgentId: "a-1",
                eventKey: "workflow-start:rematch:t-1:o-1",
                context: {
                    workflowCall: { workflow: "reconcile", version: "latest" },
                    params: { transactionId: "t-1" },
                },
            }),
        )
    })

    it("answers duplicate for a key that already started a run, and no_agent for a module with no agent", async () => {
        const repeat = build(["a-1"], { tagged: false, reason: "duplicate" })
        await expect(
            repeat.service.workflowApi({ workspaceId: "ws-1", scopeOpen: () => false }).start(REQUEST),
        ).resolves.toEqual({ started: false, reason: "duplicate" })
        const none = build([])
        await expect(
            none.service.workflowApi({ workspaceId: "ws-1", scopeOpen: () => false }).start(REQUEST),
        ).resolves.toEqual({ started: false, reason: "no_agent" })
        expect(none.tags.tagAgent).not.toHaveBeenCalled()
    })

    it("refuses to start while an engine scope is open", async () => {
        const { service, tags } = build()
        await expect(
            service.workflowApi({ workspaceId: "ws-1", scopeOpen: () => true }).start(REQUEST),
        ).rejects.toMatchObject({
            code: EntityEngineDoorErrorCode.InScope,
        })
        expect(tags.tagAgent).not.toHaveBeenCalled()
    })
})
