import type { GraphSpec, GraphSpecNode, GraphSpecV2 } from "@nivo-lite/agent-sdk/graph"
import { DEFAULT_MODEL } from "@nivo-lite/agent-sdk/models"
import { templateGraphProblems } from "@nivo-lite/agent-sdk/template"
import { modelChoiceOf } from "@modules/domain/ai-tasks/model-choice.policy"
import { templateFlowProblems } from "@modules/domain/agent-graphs/policies/flow.policy"
import type { NodeModelDoor } from "@modules/domain/graph-nodes"
import { INSTALLED, graphOfSpecV2 } from "@modules/domain/installed-plugins"
import {
    AUTO_PURPOSE,
    CLASSIFY_PURPOSE,
    CORE_MODELS,
    CORE_NO_MODEL,
    CORE_ROUTE,
    DUE_BEFORE,
    EXPLICIT_MODEL,
    EXPLICIT_PURPOSE,
    NOTE_WRITE,
    NO_MODEL_PURPOSE,
    routeGraph,
} from "@tests/fixtures/builders/engine-core-plugin.builder"
import { CORE, rowsOf, startThread, threadDbOf, type ThreadDb } from "./thread-world"
import { coreFlowOf, coreProcessOf, coreStarted, noteActsOf, threadOf } from "./thread-world-core"

// ENGINE CORE: THE GRAPH RUNTIME ON LANGGRAPH (frame `nivo-frame.layers` (1) and `templates`: node, routes, ifNode, outcome; a graph is
// pure data) and THE MODEL PER NODE (`templates`: model per node, default `auto` = claude-sonnet-5-5 today), on the GENERIC fixture
// (`engine-core-plugin`). What the other worlds already prove is not repeated here: `loop({ over })` in loop-fanout / loop-replay /
// template-loop, `loop({ until })` and the cycle refusal in loop-until, `callWorkflow` in template-node.
jest.mock("@nivo-lite/plugin-registry", () => {
    const parts: typeof import("@tests/fixtures/builders/installation-parts.builder") = jest.requireActual(
        "@tests/fixtures/builders/installation-parts.builder",
    )
    const fixture: typeof import("@tests/fixtures/builders/engine-core-plugin.builder") = jest.requireActual(
        "@tests/fixtures/builders/engine-core-plugin.builder",
    )
    return { installed: parts.installationWith([fixture.CORE_PLUGIN], "engine-core") }
})

/** What the classify's agent answers: the route by meaning, and the data the `ifNode` reads. */
interface Classified {
    readonly route: "keep" | "drop"
    readonly score: number
    readonly dueAt: string
    readonly tag: string | null
}

const BEFORE = "2026-11-20T00:00:00.000Z"
const AFTER = "2026-12-20T00:00:00.000Z"

/** Runs the routed graph with the classify answering `said`; answers the outcome it ended on and the steps it took. */
const routed = async (said: Classified) => {
    const db = threadDbOf()
    db.model.script(CLASSIFY_PURPOSE, { done: said })
    const process = await coreProcessOf(db)
    const runId = await coreStarted(process, CORE_ROUTE)
    const thread = await threadOf(process, runId)
    const ended = ["written", "skipped", "dropped"].find((name) => name in thread.steps) ?? null
    return { db, thread, ended }
}

describe("the graph runtime on LangGraph, on a small generic graph", () => {
    it("routes by MEANING (the node's own route member): drop ends on its outcome, the gate and the write never run", async () => {
        const { db, thread, ended } = await routed({ route: "drop", score: 9, dueAt: BEFORE, tag: "soon" })

        expect(thread.status).toBe("ended")
        expect(ended).toBe("dropped")
        expect(Object.keys(thread.steps)).toEqual(["classify", "dropped"])
        expect(noteActsOf(db)).toEqual([])
    })

    it.each<readonly [string, Classified, "written" | "skipped"]>([
        ["all hold (present, 7 > 5, due before)", { route: "keep", score: 7, dueAt: BEFORE, tag: "soon" }, "written"],
        ["present fails (tag null)", { route: "keep", score: 7, dueAt: BEFORE, tag: null }, "skipped"],
        ["gt on numbers fails (5 is not above 5)", { route: "keep", score: 5, dueAt: BEFORE, tag: "soon" }, "skipped"],
        ["or: due after, but not `later`", { route: "keep", score: 7, dueAt: AFTER, tag: "soon" }, "written"],
        ["or: due before, though `later`", { route: "keep", score: 7, dueAt: BEFORE, tag: "later" }, "written"],
        ["or fails: due after AND `later` (not)", { route: "keep", score: 7, dueAt: AFTER, tag: "later" }, "skipped"],
    ])("ifNode by DATA: %s", async (_name, said, expected) => {
        const { db, thread, ended } = await routed(said)

        expect(thread.status).toBe("ended")
        expect(ended).toBe(expected)
        expect(thread.steps).toMatchObject({ gate: { output: { branch: expected === "written" ? "yes" : "no" } } })
        expect(noteActsOf(db).map((act) => act.effect)).toEqual(expected === "written" ? [NOTE_WRITE] : [])
    })

    it("orders ISO instants as instants: the boundary instant itself is not before itself", async () => {
        const { ended } = await routed({ route: "keep", score: 7, dueAt: DUE_BEFORE, tag: "later" })

        expect(ended).toBe("skipped")
    })
})

describe("a graph is pure data", () => {
    it("the stored @2 document round-trips through JSON: the same graph, judged clean, and it runs the same", async () => {
        const stored: GraphSpecV2 = JSON.parse(JSON.stringify(routeGraph.spec))
        expect(stored).toEqual(routeGraph.spec)
        const lookups = {
            legacyNodeOf: () => undefined,
            templateNodeOf: (id: string) => routeGraph.nodes.get(id),
        }
        const flow = graphOfSpecV2(stored, lookups)
        expect(flow).toEqual(coreFlowOf(CORE_ROUTE))
        expect(templateFlowProblems(flow)).toEqual([])

        const db = threadDbOf()
        db.model.script(CLASSIFY_PURPOSE, { done: { route: "keep", score: 7, dueAt: BEFORE, tag: "soon" } })
        const process = await coreProcessOf(db)
        const runId = await coreStarted(process, CORE_ROUTE)
        expect(Object.keys((await threadOf(process, runId)).steps)).toEqual(["classify", "gate", "write", "written"])
    })

    it("refuses a stored document with a malformed expression (an order between a number and a text), at the save check", () => {
        const spec = routeGraph.spec
        const nodes = spec.nodes.map((step) =>
            step.kind === "if"
                ? { ...step, params: { when: { op: "gt", ref: { $ref: "steps.classify.output.score" }, value: "high" } } }
                : step,
        )
        const raw = { ...spec, nodes } as unknown as GraphSpecV2
        const problems = templateGraphProblems(raw, { nodes: routeGraph.nodes })
        expect(problems.map((one) => one.code)).toContain("EXPR_TYPE_MISMATCH")
    })

    it("refuses a stored document whose expression names an operator the engine does not know, and never runs it", async () => {
        const flow = coreFlowOf(CORE_ROUTE)
        const broken: GraphSpec = {
            ...flow,
            nodes: flow.nodes.map(
                (one): GraphSpecNode =>
                    one.key === "gate" ? { ...one, params: { when: { op: "between", ref: { $ref: "trigger.text" } } } } : one,
            ),
        }
        expect(templateFlowProblems(broken)).not.toEqual([])

        const db = threadDbOf()
        db.model.script(CLASSIFY_PURPOSE, { done: { route: "keep", score: 7, dueAt: BEFORE, tag: "soon" } })
        db.model.script(CORE, { decision: "report", reason: "x", question: "x", suggestions: [], customerLine: null })
        const process = await coreProcessOf(db)
        const woken = await startThread(process, { flow: broken, versionId: `${CORE_ROUTE}@7`, trigger: { noteId: "n1", text: "x" }, workflowId: "wf:direct" })
        // Either the compile refuses the document, or the run stops at the gate: the write is never acted.
        expect(noteActsOf(db)).toEqual([])
        if (woken.error === null) expect((await threadOf(process, woken.runId ?? "")).status).not.toBe("ended")
    })
})

/** The model door of the world, recording the model scope each purpose was asked under. */
const recordingDoor = (db: ThreadDb) => {
    const scopes: Array<{ readonly purpose: string; readonly model: Parameters<NodeModelDoor["nodeText"]>[0]["model"] }> = []
    const inner = db.model.door()
    const door: NodeModelDoor = {
        nodeText: (scope, ask) => {
            scopes.push({ purpose: ask.purpose, model: scope.model })
            return inner.nodeText(scope, ask)
        },
        nodeJson: (scope, ask, schema) => {
            scopes.push({ purpose: ask.purpose, model: scope.model })
            return inner.nodeJson(scope, ask, schema)
        },
    }
    return { scopes, door }
}

const PROVIDERS = { anthropic: true, openrouter: false }

describe("the model per node", () => {
    it("a node of `auto` reaches the model call as `auto`, which the door resolves to the engine's default (claude-sonnet-5-5)", async () => {
        const db = threadDbOf()
        db.model.script(AUTO_PURPOSE, { done: { said: "a" } })
        db.model.script(EXPLICIT_PURPOSE, { done: { said: "b" } })
        const { scopes, door } = recordingDoor(db)
        const process = await coreProcessOf(db, { model: door })
        const runId = await coreStarted(process, CORE_MODELS)

        expect((await threadOf(process, runId)).status).toBe("ended")
        const auto = scopes.find((one) => one.purpose === AUTO_PURPOSE)?.model
        expect(auto?.model).toBe("auto")
        const choice = auto === undefined ? null : modelChoiceOf(auto, 1, PROVIDERS)
        expect(choice).toMatchObject({ ok: true, choice: { intended: DEFAULT_MODEL } })
        expect(DEFAULT_MODEL).toBe("claude-sonnet-5-5")
    })

    it("a node of an explicit model id reaches the model call with that id", async () => {
        const db = threadDbOf()
        db.model.script(AUTO_PURPOSE, { done: { said: "a" } })
        db.model.script(EXPLICIT_PURPOSE, { done: { said: "b" } })
        const { scopes, door } = recordingDoor(db)
        const process = await coreProcessOf(db, { model: door })
        await coreStarted(process, CORE_MODELS)

        const explicit = scopes.find((one) => one.purpose === EXPLICIT_PURPOSE)?.model
        expect(explicit).toMatchObject({ model: EXPLICIT_MODEL, source: "node" })
        expect(explicit === undefined ? null : modelChoiceOf(explicit, 1, PROVIDERS)).toMatchObject({
            ok: true,
            choice: { intended: EXPLICIT_MODEL, reason: "explicit" },
        })
    })

    it("the graph's step overrides the node's model: the stored step's model reaches the call", async () => {
        const db = threadDbOf()
        db.model.script(AUTO_PURPOSE, { done: { said: "a" } })
        db.model.script(EXPLICIT_PURPOSE, { done: { said: "b" } })
        const { scopes, door } = recordingDoor(db)
        const process = await coreProcessOf(db, { model: door })
        const flow = coreFlowOf(CORE_MODELS)
        const overridden: GraphSpec = {
            ...flow,
            nodes: flow.nodes.map((one): GraphSpecNode => (one.key === "second" ? { ...one, model: DEFAULT_MODEL } : one)),
        }
        await startThread(process, { flow: overridden, versionId: `${CORE_MODELS}@2`, trigger: { noteId: "n1", text: "x" }, workflowId: "wf:direct" })

        expect(scopes.find((one) => one.purpose === EXPLICIT_PURPOSE)?.model).toMatchObject({ model: DEFAULT_MODEL, source: "node" })
    })

    it("a node with no model that calls its agent fails NODE_MODEL_MISSING: the model is never asked", async () => {
        const db = threadDbOf()
        db.model.script(CORE, { decision: "report", reason: "x", question: "x", suggestions: [], customerLine: null })
        const process = await coreProcessOf(db)
        const runId = await coreStarted(process, CORE_NO_MODEL)

        expect((await threadOf(process, runId)).status).not.toBe("ended")
        expect(db.model.askedOf(NO_MODEL_PURPOSE)).toEqual([])
        expect(JSON.stringify(rowsOf(db, runId).steps.find((one) => one.stepKey === "none"))).toContain("NODE_MODEL_MISSING")
    })
})

describe("the fixture is installed as the engine reads it", () => {
    it("each fixture graph is a template of the agent's module, read by the adapter and judged clean", () => {
        expect(INSTALLED.templateOf(CORE_ROUTE)).toMatchObject({ moduleKey: "tcore" })
        expect(templateFlowProblems(coreFlowOf(CORE_ROUTE))).toEqual([])
    })
})
