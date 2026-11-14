import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import { AgentGraphsService } from "@modules/domain/agent-graphs"
import { INSTALLED } from "@modules/domain/installed-plugins"
import { latestGraphOf } from "@modules/domain/installed-plugins/installed-plugins.testing"
import { GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import { GRAPH_THREADS } from "@modules/integrations/langgraph"
import type { GraphThreads, ThreadNodeScope, ThreadRef, ThreadState } from "@modules/integrations/langgraph"
import { CLOCK } from "@modules/platform/clock"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { AGENT_THREADS_OPTIONS } from "./agent-threads.decorators"
import { AgentThreadsErrorCode } from "./errors/agent-threads.error"
import { FREEZE_NODE } from "./template-compiler.policy"
import { ThreadGraphsService } from "./thread-graphs.service"
import { ThreadProjectionService } from "./thread-projection.service"
import { ThreadStepService } from "./thread-step.service"

const NOW = "2026-11-10T10:00:00.000Z"
const REF: ThreadRef = { workspaceId: "ws-1", runId: "run-1" }
const RUN = { agentId: "agent-1", namespace: "chatbot.front-desk", workflowId: "wf-1" }
const STATE: ThreadState = { trigger: {}, steps: {}, trouble: null, founderAnswers: [], loop: null }

/** The front desk as blocks-core ships it. */
const frontDesk = (): GraphSpec => latestGraphOf("chatbot.front-desk")

const scopeOf = (runId: string): ThreadNodeScope => ({ thread: { ...REF, runId }, node: "hear", version: "v-1", stop: jest.fn() })

/** The registry's `defineNode` nodes (the control nodes since the flip); the service adds every template step itself. */
const REGISTERED: ReadonlyArray<string> = INSTALLED.nodeInstall().nodes.map((node) => node.id)

const build = async (graphsMax?: number, installed: ReadonlyArray<string> = REGISTERED) => {
    const replay = jest.fn()
    const port = mock<GraphThreads>({ replayPortsOf: replay })
    const graphs = mock<AgentGraphsService>({
        versionAt: jest.fn().mockResolvedValue({ version: 4, document: { nodes: [], flow: frontDesk() } }),
    })
    const nodes = mock<GraphNodeRegistryService>({
        installed: jest.fn(() => ({ nodes: new Map(installed.map((id) => [id, {}])) }) as never),
    })
    const steps = mock<ThreadStepService>({
        run: jest.fn().mockResolvedValue({ goto: "answer" }),
        gate: jest.fn().mockResolvedValue({ goto: "answer" }),
    })
    const projection = mock<ThreadProjectionService>({ runEnded: jest.fn().mockResolvedValue("written") })
    const moduleRef = await Test.createTestingModule({
        providers: [
            ThreadGraphsService,
            { provide: AGENT_THREADS_OPTIONS, useValue: { graphsMax } },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: LOGGER, useValue: mock<Logger>() },
            { provide: AgentGraphsService, useValue: graphs },
            { provide: GraphNodeRegistryService, useValue: nodes },
            { provide: ThreadStepService, useValue: steps },
            { provide: ThreadProjectionService, useValue: projection },
            { provide: GRAPH_THREADS, useValue: port },
        ],
    }).compile()
    return { service: moduleRef.get(ThreadGraphsService), graphs, nodes, steps, projection, replay }
}

describe("ThreadGraphsService", () => {
    it("builds the graph of a version once and keeps it by version id", async () => {
        const { service, nodes, graphs } = await build()

        const first = await service.routed(REF, { versionId: "v-1", flow: frontDesk(), number: 4 })
        const again = await service.routed(REF, { versionId: "v-1", flow: frontDesk(), number: 4 })
        const pinned = await service.pinned(REF, "agent-1", "v-1")

        expect(again).toBe(first)
        expect(pinned).toBe(first)
        expect(nodes.installed).toHaveBeenCalledTimes(1)
        expect(graphs.versionAt).not.toHaveBeenCalled()
        // The front desk's first step is the chatbot's own `hear` (one trigger pipeline: the package's first node), then `understand`.
        expect(first).toMatchObject({ version: "v-1", entry: "hear" })
        expect(first.nodes.at(-1)?.key).toBe(FREEZE_NODE)
        expect(service.moduleKeyOf("v-1")).toBe("chatbot")
        expect(service.moduleKeyOf("v-2")).toBeNull()
    })

    it("reads a pinned version it has not built by its id", async () => {
        const { service, graphs } = await build()

        const graph = await service.pinned(REF, "agent-1", "v-9")

        expect(graphs.versionAt).toHaveBeenCalledWith("ws-1", "agent-1", "v-9")
        expect(graph.version).toBe("v-9")
    })

    it("lets the oldest built graph go when it keeps more than its bound", async () => {
        const { service, nodes } = await build(1)
        await service.routed(REF, { versionId: "v-1", flow: frontDesk(), number: 1 })
        await service.routed(REF, { versionId: "v-2", flow: frontDesk(), number: 2 })

        expect(service.moduleKeyOf("v-1")).toBeNull()
        expect(service.moduleKeyOf("v-2")).toBe("chatbot")
        await service.routed(REF, { versionId: "v-1", flow: frontDesk(), number: 1 })
        expect(nodes.installed).toHaveBeenCalledTimes(3)
    })

    it("hands a node the facts of the run that is driven, and only while it is driven", async () => {
        const { service, steps, replay } = await build()
        const graph = await service.routed(REF, { versionId: "v-1", flow: frontDesk(), number: 4 })
        // The first step of the front desk is `hear` (it was `understand` before the chatbot's own first node).
        const hear = graph.nodes[0]
        const gate = graph.nodes.at(-1)

        await service.driving("run-1", RUN, async () => {
            expect(service.isDriving("run-1")).toBe(true)
            await hear?.run(STATE, scopeOf("run-1"))
            await gate?.run(STATE, scopeOf("run-1"))
        })

        expect(steps.run).toHaveBeenCalledWith(
            expect.objectContaining({ ...RUN, versionId: "v-1", replay, step: expect.objectContaining({ key: "hear" }) }),
            STATE,
            expect.anything(),
        )
        expect(steps.gate).toHaveBeenCalledWith({ agentId: "agent-1" }, STATE, expect.anything())
        expect(service.isDriving("run-1")).toBe(false)
        expect(() => hear?.run(STATE, scopeOf("run-1"))).toThrow(
            expect.objectContaining({ code: AgentThreadsErrorCode.NotDriving }),
        )
    })

    it("releases a run whose drive threw", async () => {
        const { service } = await build()

        await expect(service.driving("run-1", RUN, () => Promise.reject(new Error("cut")))).rejects.toThrow("cut")

        expect(service.isDriving("run-1")).toBe(false)
    })

    it("refuses by name a version that does not compile or holds no graph, and closes the run as failed", async () => {
        const { service, projection, graphs } = await build(undefined, ["chatbot.understand"])

        await expect(service.routed(REF, { versionId: "v-1", flow: frontDesk(), number: 4 })).rejects.toMatchObject({
            code: AgentThreadsErrorCode.TemplateRefused,
            params: { version: "v-1", problem: "TEMPLATE_STEP_UNKNOWN" },
        })
        graphs.versionAt.mockResolvedValue({ version: 1, document: { nodes: [] } })
        await expect(service.pinned(REF, "agent-1", "v-2")).rejects.toMatchObject({
            code: AgentThreadsErrorCode.TemplateRefused,
            params: { version: "v-2", problem: "TEMPLATE_EMPTY" },
        })

        expect(projection.runEnded).toHaveBeenCalledTimes(2)
        expect(projection.runEnded).toHaveBeenCalledWith(REF, {
            outcome: "failed",
            code: "TEMPLATE_STEP_UNKNOWN",
            by: null,
            at: new Date(NOW),
        })
    })
})
