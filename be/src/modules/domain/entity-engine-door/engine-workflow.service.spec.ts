import { Test } from "@nestjs/testing"
import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { isTransactionManager } from "@starci/jest-preset/entity-manager"
import { WORKFLOW_CALL_TRIGGER } from "@modules/domain/agent-schedules/workflow-call.trigger"
import { AgentDirectoryService } from "@modules/domain/agents"
import { ModuleJobRunnerService } from "@modules/domain/entity-engine"
import { ProviderTriggersService, type DeliverResult } from "@modules/domain/provider-triggers"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
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

const WOKEN: Extract<DeliverResult, { readonly status: "delivered" }> = {
    status: "delivered",
    events: 1,
    dropped: 0,
    woken: [{ agentId: "a-1", workflowId: "w-1", eventId: "workflow-start:rematch:t-1:o-1", wakeId: "wake-1" }],
    repeats: 0,
    untaken: 0,
    held: 0,
}

const build = async (agentIds: Array<string> = ["a-1"], delivered: DeliverResult = WOKEN) => {
    const tx = fakeTransaction(mockEntityManager({}))
    const agents = mock<AgentDirectoryService>()
    agents.idsOfModule.mockResolvedValue(agentIds)
    const triggers = mock<ProviderTriggersService>()
    triggers.deliver.mockResolvedValue(delivered)
    const runner = mock<ModuleJobRunnerService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            EngineWorkflowService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: AgentDirectoryService, useValue: agents },
            { provide: ProviderTriggersService, useValue: triggers },
            { provide: ModuleJobRunnerService, useValue: runner },
        ],
    }).compile()
    return { service: moduleRef.get(EngineWorkflowService), triggers, runner }
}

const BINDING = { workspaceId: "ws-1", scopeOpen: () => false }

describe("EngineWorkflowService", () => {
    it("binds itself to the job runner at boot", async () => {
        const { service, runner } = await build()
        service.onModuleInit()
        expect(runner.bindWorkflow).toHaveBeenCalledWith(service)
    })

    it("delivers one workflow call to the module's agent: the inputs as the event's data, the pin beside it, the once-key the dedupe key", async () => {
        const { service, triggers } = await build()

        await expect(service.workflowApi(BINDING).start(REQUEST)).resolves.toEqual({ started: true })

        expect(isTransactionManager(triggers.deliver.mock.calls[0]?.[1])).toBe(true)
        expect(triggers.deliver.mock.calls[0]?.[0]).toEqual({
            workspaceId: "ws-1",
            declaration: WORKFLOW_CALL_TRIGGER,
            connectionId: null,
            agentId: "a-1",
            events: [
                {
                    event: { id: "workflow-start:rematch:t-1:o-1", data: { transactionId: "t-1" } },
                    pin: { workflow: "reconcile", version: "latest" },
                },
            ],
        })
    })

    it("hands the same event id for the same dedupe key and another for another key, so a job delivered twice starts one run", async () => {
        const { service, triggers } = await build()

        await service.workflowApi(BINDING).start(REQUEST)
        await service.workflowApi(BINDING).start(REQUEST)
        await service.workflowApi(BINDING).start({ ...REQUEST, dedupeKey: "rematch:t-1:o-2" })

        expect(triggers.deliver.mock.calls.map((call) => call[0].events[0]?.event.id)).toEqual([
            "workflow-start:rematch:t-1:o-1",
            "workflow-start:rematch:t-1:o-1",
            "workflow-start:rematch:t-1:o-2",
        ])
    })

    it("pins the version the job asked for, a number as well as latest", async () => {
        const { service, triggers } = await build()

        await service.workflowApi(BINDING).start({ ...REQUEST, version: 3 })

        expect(triggers.deliver.mock.calls[0]?.[0].events[0]?.pin).toEqual({ workflow: "reconcile", version: 3 })
    })

    it("answers duplicate for a key that already started a run, refused for a call no registration takes, and no_agent for a module with no agent", async () => {
        const repeat = await build(["a-1"], { ...WOKEN, woken: [], repeats: 1 })
        await expect(repeat.service.workflowApi(BINDING).start(REQUEST)).resolves.toEqual({ started: false, reason: "duplicate" })
        const untaken = await build(["a-1"], { ...WOKEN, woken: [], untaken: 1 })
        await expect(untaken.service.workflowApi(BINDING).start(REQUEST)).resolves.toEqual({ started: false, reason: "refused" })
        const off = await build(["a-1"], { status: "off" })
        await expect(off.service.workflowApi(BINDING).start(REQUEST)).resolves.toEqual({ started: false, reason: "refused" })
        const none = await build([])
        await expect(none.service.workflowApi(BINDING).start(REQUEST)).resolves.toEqual({ started: false, reason: "no_agent" })
        expect(none.triggers.deliver).not.toHaveBeenCalled()
    })

    it("refuses to start while an engine scope is open", async () => {
        const { service, triggers } = await build()
        await expect(service.workflowApi({ workspaceId: "ws-1", scopeOpen: () => true }).start(REQUEST)).rejects.toMatchObject({
            code: EntityEngineDoorErrorCode.InScope,
        })
        expect(triggers.deliver).not.toHaveBeenCalled()
    })
})
