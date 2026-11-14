import { mock } from "@starci/jest-preset"
import type { GraphSpecNode } from "@nivo-lite/agent-sdk/graph"
import type { WorkflowCallReachService } from "@modules/domain/agents"
import type { NodeStepRef, NodeTurn } from "@modules/domain/graph-nodes"
import type { Logger } from "@modules/platform/logging"
import { AgentNodeRoutesService } from "./agent-node-routes.service"
import type { AgentGraphsService } from "./agent-graphs.service"
import { AgentGraphsError, AgentGraphsErrorCode } from "./errors/agent-graphs.error"
import { routeRoadsOf } from "./policies/route-roads.policy"

// E-SMALL item 1. RULE (R75, engine words): a step's route is closed when EVERY road it leads to (through the engine's conditions and
// hand-backs) ends at a workflow call this workspace cannot start; a road that may reach a node, an outcome, the end of the run or a call
// that can start keeps it open. The graphs below are a clock-started books round (not a customer line) and a front desk.

const call = (key: string, agent: string, workflow: string, next?: string): GraphSpecNode => ({
    key,
    kind: "output",
    step: "core.call-workflow",
    params: { agent, workflow, version: "latest", inputs: {} },
    ...(next === undefined ? {} : { next }),
})
const when = (key: string, yes?: string, no?: string): GraphSpecNode => ({
    key,
    kind: "condition",
    step: "core.when",
    params: { when: {} },
    routes: { ...(yes === undefined ? {} : { yes }), ...(no === undefined ? {} : { no }) },
})
const handBack = (key: string, next?: string): GraphSpecNode => ({
    key,
    kind: "output",
    step: "core.hand-back",
    params: { wait: "await" },
    ...(next === undefined ? {} : { next }),
})
const end = (key: string): GraphSpecNode => ({ key, kind: "output", step: "core.outcome", params: { outcome: key, outputs: {} } })
const work = (key: string, routes: Readonly<Record<string, string>>): GraphSpecNode => ({
    key,
    kind: "condition",
    step: "tbooks.sort",
    routes,
})

/** A books round: `sort` routes a credit to a call behind a condition, a hand-back, a work step, a call that starts, or the run's end. */
const BOOKS: ReadonlyArray<GraphSpecNode> = [
    work("sort", { post: "post-when", back: "give-back", note: "noted", file: "to-file", gone: "nowhere", mixed: "mixed-when" }),
    when("post-when", "to-ledger", "to-ledger-later"),
    call("to-ledger", "ledger", "post"),
    call("to-ledger-later", "ledger", "post-later", "noted"),
    handBack("give-back", "to-ledger"),
    work("noted", {}),
    call("to-file", "books", "file"),
    when("mixed-when", "to-ledger"),
    end("done"),
]

describe("routeRoadsOf (pure)", () => {
    it("walks conditions (every branch) and hand-backs to the first step that works; a missing branch or step is an open end", () => {
        const ends = Object.fromEntries(routeRoadsOf(BOOKS, "sort").map((road) => [road.route, road.ends]))
        expect(ends.post).toEqual([
            { kind: "call", module: "ledger", workflow: "post" },
            { kind: "call", module: "ledger", workflow: "post-later" },
        ])
        expect(ends.back).toEqual([{ kind: "call", module: "ledger", workflow: "post" }])
        expect(ends.note).toEqual([{ kind: "open" }])
        expect(ends.file).toEqual([{ kind: "call", module: "books", workflow: "file" }])
        expect(ends.gone).toEqual([{ kind: "open" }])
        // A condition with one branch ends the run on the other: an open end beside the call.
        expect(ends.mixed).toEqual([{ kind: "open" }, { kind: "call", module: "ledger", workflow: "post" }])
    })

    it("a step that does not route, or is not in the graph, has no roads; two branches meeting add one end", () => {
        expect(routeRoadsOf(BOOKS, "done")).toEqual([])
        expect(routeRoadsOf(BOOKS, "missing")).toEqual([])
        const meeting = [work("s", { a: "w" }), when("w", "c", "c"), call("c", "m", "x")]
        expect(routeRoadsOf(meeting, "s")).toEqual([{ route: "a", ends: [{ kind: "call", module: "m", workflow: "x" }] }])
    })
})

const TURN: NodeTurn = { turnId: "t", workspaceId: "ws-1", agentId: "books-agent", subject: null, conversationId: null, locale: "vi" }
const STEP: NodeStepRef = { nodeKey: "sort", versionId: "v-1", workflowId: "wf-1" }

const serviceOf = (nodes: ReadonlyArray<GraphSpecNode>, startable: (module: string, workflow: string) => boolean) => {
    const graphs = mock<AgentGraphsService>()
    graphs.versionAt.mockResolvedValue({ version: 1, document: { nodes: [], flow: { nodes } } } as never)
    const reach = mock<WorkflowCallReachService>()
    reach.startable.mockImplementation((_origin, called) => Promise.resolve(startable(called.module, called.workflow)))
    return { service: new AgentNodeRoutesService(graphs, mock<Logger>(), reach), graphs, reach }
}

describe("AgentNodeRoutesService.closedRoutesOf", () => {
    it("closes a route only when every road ends at a call that cannot start; asks each target once", async () => {
        const { service, reach } = serviceOf(BOOKS, (module) => module === "books")
        await expect(service.closedRoutesOf(TURN, STEP)).resolves.toEqual(["post", "back"])
        // ledger.post, ledger.post-later, books.file: three targets, each asked once though `post` and `back` share ledger.post.
        expect(reach.startable).toHaveBeenCalledTimes(3)
        expect(reach.startable).toHaveBeenCalledWith({ workspaceId: "ws-1", routeId: null, contactId: null }, { module: "ledger", workflow: "post" })
    })

    it("a road with one startable call keeps its route open; everything startable closes nothing", async () => {
        const half = serviceOf(BOOKS, (_module, workflow) => workflow === "post-later")
        // `post` has a road to ledger.post-later (it starts): open. `back` reaches ledger.post only; `file` reaches books.file only.
        await expect(half.service.closedRoutesOf(TURN, STEP)).resolves.toEqual(["back", "file"])
        const all = serviceOf(BOOKS, () => true)
        await expect(all.service.closedRoutesOf(TURN, STEP)).resolves.toEqual([])
    })

    it("a version that is not the agent's reads as no graph (every route open); any other failure is the caller's", async () => {
        const { service, graphs } = serviceOf(BOOKS, () => false)
        graphs.versionAt.mockRejectedValueOnce(new AgentGraphsError({ code: AgentGraphsErrorCode.VersionNotFound, params: {} }))
        await expect(service.closedRoutesOf(TURN, STEP)).resolves.toEqual([])
        graphs.versionAt.mockRejectedValueOnce(new Error("db down"))
        await expect(service.closedRoutesOf(TURN, STEP)).rejects.toThrow("db down")
    })

    it("with no reach bound, nothing is read and nothing is closed", async () => {
        const graphs = mock<AgentGraphsService>()
        await expect(new AgentNodeRoutesService(graphs, mock<Logger>()).closedRoutesOf(TURN, STEP)).resolves.toEqual([])
        expect(graphs.versionAt).not.toHaveBeenCalled()
    })
})
