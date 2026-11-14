import { TOOL } from "@nivo-lite/agent-sdk/names"
import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import type { NodeToolDoor } from "@modules/domain/graph-nodes"
import { INSTALLED, TEMPLATE_IF_STEP } from "@modules/domain/installed-plugins"
import { isTemplateFlow, templateFlowProblems } from "@modules/domain/agent-graphs/policies/flow.policy"
import {
    TMPL_FOLLOWUP,
    TMPL_INTAKE,
    TMPL_READ,
    TMPL_UNDECLARED,
    TMPL_WRITE,
    TRIAGE_PURPOSE,
} from "@tests/fixtures/builders/template-plugin.builder"
import {
    CONV,
    CORE,
    LEAD,
    WS,
    actsOf,
    button,
    founderDecides,
    ledgerOf,
    processOf,
    rowsOf,
    startThread,
    stopsOf,
    threadDbOf,
    type ThreadDb,
} from "./thread-world"
import { noteActsOf, noteExecutorsOf } from "./thread-world-core"

// SLICE E3: a template agent written with the new builders (`defineTemplateNode` / `defineTemplateGraph` / `defineTemplateAgent`,
// GraphSpec `nivo/agent-graph@2`) installed BESIDE the core (whose nodes stay `defineNode` ones), read by the engine through ONE adapter
// (`graphOfSpecV2`) and run on threads by the REAL engine: the thread compiler, the node function, the node host's template branch,
// the effect ledger, the replay of LangGraph tasks, the stops and the gate. Faked: the model (scripted), the outside world, and the node
// door, whose reads answer what the spec says each time and whose writes act once per call key (the gateway's receipt).
jest.mock("@nivo-lite/plugin-registry", () => {
    const parts: typeof import("@tests/fixtures/builders/installation-parts.builder") = jest.requireActual(
        "@tests/fixtures/builders/installation-parts.builder",
    )
    const fixture: typeof import("@tests/fixtures/builders/template-plugin.builder") = jest.requireActual(
        "@tests/fixtures/builders/template-plugin.builder",
    )
    return { installed: parts.installationWith([fixture.TMPL_PLUGIN], "template-array") }
})

/** One call the door was asked. */
interface DoorCall {
    readonly tool: string
    readonly key: string
}

/** The door of the world: every call is kept; a read answers the next scripted answer (the last one again once they run out). */
interface Door {
    readonly calls: Array<DoorCall>
    readonly reads: Map<string, Array<unknown>>
    readonly port: NodeToolDoor
}

const doorOf = (): Door => {
    const calls: Array<DoorCall> = []
    const reads = new Map<string, Array<unknown>>()
    const port: NodeToolDoor = {
        call: (call) => {
            calls.push({ tool: call.tool, key: call.key })
            const queue = reads.get(call.tool) ?? []
            const answer: unknown = queue.length > 1 ? queue.shift() : queue[0]
            return Promise.resolve(structuredClone(answer ?? {}))
        },
    }
    return { calls, reads, port }
}

/** The report of the AI core for a step it cannot complete: it stops for the founder. */
const report = {
    decision: "report",
    reason: "Buoc nay khong the tiep tuc.",
    question: "Lam gi tiep?",
    suggestions: [{ text: "Thu lai", handledBy: "workflow" }],
    customerLine: null,
}

/** The graph a template graph is installed as: the one version of its workflow template. */
const flowOf = (id: string): GraphSpec => {
    const graph = INSTALLED.templateOf(id)?.versions[0]?.graph
    if (graph === undefined) throw new Error(`no template ${id}`)
    return graph
}

/** The generic scope of a channel message (the intake graph's trigger): the words are the engine's own line, the event carries the message key. */
const MESSAGE = { eventId: "e1", routeId: CONV, contactId: LEAD, data: { messageKey: "zalo:m-1" } }

const TRIGGER = { conversationId: CONV, leadId: LEAD, text: "Cho em 1 chau hoa", channel: "zalo", locale: "vi" }

const started = async (db: ThreadDb, door: Door, id: string, trigger: Readonly<Record<string, unknown>>) => {
    const process = await processOf(db, { door: door.port, executors: noteExecutorsOf(db) })
    const woken = await startThread(process, { flow: flowOf(id), versionId: `${id}@1`, trigger })
    expect(woken.error).toBeNull()
    const runId = woken.runId ?? ""
    return { process, runId }
}

const statusOf = async (process: Awaited<ReturnType<typeof processOf>>, runId: string) =>
    (await process.threads.stateOf({ workspaceId: WS, runId }))?.status

const stepsOf = async (process: Awaited<ReturnType<typeof processOf>>, runId: string): Promise<Readonly<Record<string, unknown>>> =>
    (await process.threads.stateOf({ workspaceId: WS, runId }))?.state.steps ?? {}

describe("a template agent installed beside the core (GraphSpec @2)", () => {
    it("installs each graph as a workflow template of its module, read by the adapter, and saves it clean", () => {
        const intake = INSTALLED.templateOf(TMPL_INTAKE)
        expect(intake).toMatchObject({ moduleKey: "tmpl", primary: true, versions: [{ version: 1 }] })
        expect(INSTALLED.templateOf(TMPL_FOLLOWUP)?.primary).toBe(false)
        const flow = flowOf(TMPL_INTAKE)
        expect(flow.schema).toBe("nivo/agent-graph@1")
        expect(flow.trigger.sources).toEqual(["channel"])
        expect(flow.triggers?.map((one) => one.source.kind)).toEqual(["zalo"])
        expect(flow.grant.tools).toEqual(expect.arrayContaining([TMPL_READ, TMPL_WRITE]))
        expect(flow.nodes.find((one) => one.key === "triage")).toMatchObject({ kind: "condition", routes: { order: "note", question: "rogue" } })
        expect(flowOf(TMPL_FOLLOWUP).nodes.find((one) => one.key === "check")?.step).toBe(TEMPLATE_IF_STEP)
        // The save checks of @2 (with the engine's lookups) judge both graphs, and find nothing.
        expect(isTemplateFlow(flow)).toBe(true)
        expect(templateFlowProblems(flow)).toEqual([])
        expect(templateFlowProblems(flowOf(TMPL_FOLLOWUP))).toEqual([])
        // A graph changed outside its package is no installed template graph any more.
        expect(templateFlowProblems({ ...flow, nodes: flow.nodes.slice(0, 2) })).toEqual([{ code: "GRAPH_V2_EDITED", at: "tmpl" }])
        // Since the flip (2026-11-12) a core graph is one of them too (the core's agents are template agents): the shipped front desk is
        // judged by the same @2 checks, and saves as clean.
        expect(isTemplateFlow(flowOf("chatbot.front-desk"))).toBe(true)
        expect(templateFlowProblems(flowOf("chatbot.front-desk"))).toEqual([])
    })

    it("routes on the node's own member, freezes on ctx.fail, and on the retry replays the write while the read runs again", async () => {
        const db = threadDbOf()
        const door = doorOf()
        door.reads.set(TMPL_READ, [{ blocked: true }, { blocked: true }, { blocked: false }])
        db.model.script(TRIAGE_PURPOSE, { done: { route: "order", summary: "1 chau hoa" } })
        db.model.script(CORE, report)
        const { process, runId } = await started(db, door, TMPL_INTAKE, MESSAGE)

        // `route: "order"` took the `order` route (routeBy), never `branch`: the note step ran and froze on its own failure.
        expect(await statusOf(process, runId)).toBe("stopped")
        expect((await stopsOf(process, runId)).map((stop) => stop.stepKey)).toEqual(["note"])
        expect(noteActsOf(db).filter((act) => act.effect === TMPL_WRITE)).toHaveLength(1)
        const reads = () => door.calls.filter((call) => call.tool === TMPL_READ)
        expect(reads()).toHaveLength(2)
        const instants = () => ledgerOf(db).filter((row) => row.effectId === "engine.step-instant")
        expect(instants()).toHaveLength(2)

        await founderDecides(process, runId, button(db, "retry"))

        expect(await statusOf(process, runId)).toBe("ended")
        // The write answered from the ledger under the same call key: acted once. The read went to the door again, under the same key.
        expect(noteActsOf(db).filter((act) => act.effect === TMPL_WRITE)).toHaveLength(1)
        expect(reads()).toHaveLength(3)
        expect(new Set(reads().slice(1).map((call) => call.key)).size).toBe(1)
        // The triage did not run again; `run.at` is the instant of the note step's FIRST attempt, kept in the ledger.
        expect(db.model.askedOf(TRIAGE_PURPOSE)).toHaveLength(1)
        expect(instants()).toHaveLength(2)
        const steps = await stepsOf(process, runId)
        const at = instants().find((row) => String(row.effectKey).includes(":note:"))?.subjectId
        expect(steps.note).toMatchObject({ output: { noted: true, at } })
        expect(steps.noted).toMatchObject({ output: { outcome: "noted", values: { at } } })
    })

    it("refuses a tool the node does not declare: nothing reaches the door, the step freezes", async () => {
        const db = threadDbOf()
        const door = doorOf()
        db.model.script(TRIAGE_PURPOSE, { done: { route: "question", summary: "gio mo cua" } })
        db.model.script(CORE, report)
        const { process, runId } = await started(db, door, TMPL_INTAKE, MESSAGE)

        expect(await statusOf(process, runId)).toBe("stopped")
        expect((await stopsOf(process, runId)).map((stop) => stop.stepKey)).toEqual(["rogue"])
        expect(door.calls.filter((call) => call.tool === TMPL_UNDECLARED)).toEqual([])
        // The team hears of the stop (the engine's card), never the rogue's own line.
        expect(actsOf(db, TOOL.teamMessagePost).filter((act) => act.payload.text === "gio mo cua")).toEqual([])
        const row = rowsOf(db, runId).steps.find((one) => one.stepKey === "rogue")
        expect(JSON.stringify(row)).toContain("TOOL_UNDECLARED")
    })

    it("decides on data with the engine's if, hands off to the other graph, and ends on the outcome", async () => {
        const db = threadDbOf()
        const door = doorOf()
        const { process, runId } = await started(db, door, TMPL_FOLLOWUP, { ...TRIGGER, urgent: true })

        expect(await statusOf(process, runId)).toBe("ended")
        const steps = await stepsOf(process, runId)
        expect(steps.check).toMatchObject({ output: { branch: "yes" } })
        expect(steps.handed).toMatchObject({ output: { outcome: "handed", values: { text: TRIGGER.text } } })
        expect(steps.quiet).toBeUndefined()
        // The hand-off tagged the intake workflow through the engine's own call-workflow (its tag effect, once).
        expect(actsOf(db, TOOL.agentTag)).toHaveLength(1)
        expect(JSON.stringify(actsOf(db, TOOL.agentTag)[0]?.payload)).toContain("intake")
    })

    it("takes the else way when the data says so: the quiet outcome, no hand-off", async () => {
        const db = threadDbOf()
        const door = doorOf()
        const { process, runId } = await started(db, door, TMPL_FOLLOWUP, { ...TRIGGER, urgent: false })

        expect(await statusOf(process, runId)).toBe("ended")
        const steps = await stepsOf(process, runId)
        expect(steps.check).toMatchObject({ output: { branch: "no" } })
        expect(steps.quiet).toMatchObject({ output: { outcome: "quiet" } })
        expect(actsOf(db, TOOL.agentTag)).toEqual([])
    })
})
