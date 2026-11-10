import { mock } from "@starci/jest-preset"
import { AgentRunsService } from "@modules/domain/agent-runs"
import type { FlowThreads } from "@modules/domain/agent-graphs"
import { AgentTagService } from "@modules/domain/agent-work"
import { AgentDirectoryService } from "@modules/domain/agents"
import { ModuleJobRunnerService } from "@modules/domain/entity-engine"
import type { WorkflowStart } from "@nivo-lite/agent-sdk/mutation"
import { runViewOf } from "@tests/fixtures/builders/agent-runs.builder"
import { agentTurnViewOf } from "@tests/fixtures/builders/agent-work.builder"
import { NO_FLOW, flowServicesOf, flowWorldOf } from "@tests/fixtures/builders/flow-f-world.builder"
import { agentOf, routedWorkflowsOf } from "@tests/fixtures/builders/flow-routed-world.builder"
import { leadMemoryWorldOf } from "@tests/fixtures/builders/lead-memory-world.builder"
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

/** A tag as `AgentTagService.tagAgent` receives it. */
type AgentTagRequest = Parameters<AgentTagService["tagAgent"]>[0]

describe("EngineWorkflowService and the thread runs: the rematch job's start", () => {
    /** The tag the job's start writes, as `AgentTagService.tagAgent` receives it. */
    const taggedBy = async (request: WorkflowStart): Promise<AgentTagRequest> => {
        const { service, tags } = build(["accounting-agent"])
        await service.workflowApi({ workspaceId: "ws-1", scopeOpen: () => false }).start(request)
        const [tag] = tags.tagAgent.mock.calls.map(([one]) => one)
        if (tag === undefined) throw new Error("no tag written")
        return tag
    }

    /**
     * The wake that tag becomes, as the drain hands it to the flow: the source `tag`, the tagger's words, the plain data as JSON text and
     * the tagger's name (`tagContextOf`), the agent's own lock scope (no conversation).
     */
    const wakeOf = (tag: AgentTagRequest) =>
        agentTurnViewOf({
            agentId: agentOf("accounting"),
            source: "tag",
            scopeKey: "agent",
            eventKey: tag.eventKey ?? "",
            context: {
                text: tag.text,
                tagContext: JSON.stringify(tag.context),
                locale: "vi",
                ...("source" in tag ? { tagSource: tag.source } : {}),
            },
        })

    /** The REAL flow over the workflows seeded from the templates, with thread runs that engage what the app's config says. */
    const flowsOf = async () => {
        const runs = mock<AgentRunsService>({
            open: () => Promise.resolve(runViewOf({ id: "run-1", agentId: agentOf("accounting") })),
        })
        const built = await flowServicesOf(flowWorldOf({}), NO_FLOW, {}, undefined, {
            runs,
            workflows: routedWorkflowsOf(),
            memory: leadMemoryWorldOf({}),
        })
        // Threads are the one engine: the flow hands every workflow wake to them.
        const threads = mock<FlowThreads>({
            owns: jest.fn().mockReturnValue(false),
            opened: jest.fn().mockResolvedValue(undefined),
            started: jest.fn().mockResolvedValue({ status: "done", reason: null, outcome: { runId: "run-1" } }),
        })
        built.flows.setThreads(threads)
        return { flows: built.flows, threads }
    }

    it("starts the reconcile on a THREAD: the job's tag routes by its pin, the inputs reach trigger.*", async () => {
        const wake = wakeOf(await taggedBy(REQUEST))
        const { flows, threads } = await flowsOf()

        await expect(flows.run(wake)).resolves.toEqual({ status: "done", reason: null, outcome: { runId: "run-1" } })

        expect(threads.opened).toHaveBeenCalledTimes(1)
        expect(threads.started).toHaveBeenCalledTimes(1)
        expect(threads.started).toHaveBeenCalledWith(
            expect.objectContaining({
                runId: "run-1",
                namespace: "accounting.reconcile",
                trigger: expect.objectContaining({ transactionId: "t-1" }),
            }),
            expect.anything(),
        )
    })

    it("keys the wake by the dedupe key, so a job delivered twice writes ONE wake and so ONE run and one thread", async () => {
        const first = await taggedBy(REQUEST)
        const again = await taggedBy(REQUEST)
        const otherOrder = await taggedBy({ ...REQUEST, dedupeKey: "rematch:t-1:o-2" })

        expect(first.eventKey).toBe("workflow-start:rematch:t-1:o-1")
        expect(again.eventKey).toBe(first.eventKey)
        expect(otherOrder.eventKey).not.toBe(first.eventKey)
    })
})
