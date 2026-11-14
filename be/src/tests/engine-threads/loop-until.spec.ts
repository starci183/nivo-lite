import type { GraphSpec, GraphSpecNode, GraphSpecV2 } from "@nivo-lite/agent-sdk/graph"
import { nodeIndexOf } from "@nivo-lite/agent-sdk/node"
import { AgentGraphsError, graphLoopProblemsOf } from "@modules/domain/agent-graphs"
import { requireSoundFlow } from "@modules/domain/agent-graphs/policies/flow.policy"
import type { NodeToolDoor } from "@modules/domain/graph-nodes"
import { INSTALLED, graphOfSpecV2 } from "@modules/domain/installed-plugins"
import { jobRecordingOutbox } from "@tests/fixtures/builders/queue-job-outbox.builder"
import {
    UNTIL_CAPPED,
    UNTIL_DATA,
    UNTIL_EVERY,
    UNTIL_EVERY_MINUTES,
    UNTIL_MEANING,
    UNTIL_READ,
    UNTIL_WRITE,
    untilCountNode,
    untilDataGraph,
    untilJudgeNode,
    untilNoteNode,
} from "@tests/fixtures/builders/template-until-plugin.builder"
import {
    CORE,
    LEAD,
    WS,
    button,
    drain,
    founderDecides,
    ledgerOf,
    processOf,
    startThread,
    stopsOf,
    threadDbOf,
    type ThreadDb,
    type ThreadProcess,
} from "./thread-world"
import { noteActsOf, noteExecutorsOf } from "./thread-world-core"

// WORKER L3 (`loop({ until })`, owner 2026-11-12 "bam langgraph"): a template agent's loops UNTIL a condition, run on threads by the
// REAL engine: the thread compiler (the cycle through `Command`s), the node function (the round counter in `state.loop`, the judge after
// each round, the park between rounds), the node host's template branch, the effect ledger, the stops and the gate, the round timer on
// the thread-deadline queue and the round's wake through the thread runs. Faked: the model (only the AI core is ever asked), the outside
// world, and the node door, whose reads answer what the spec scripts per call.
jest.mock("@nivo-lite/plugin-registry", () => {
    const parts: typeof import("@tests/fixtures/builders/installation-parts.builder") = jest.requireActual(
        "@tests/fixtures/builders/installation-parts.builder",
    )
    const fixture: typeof import("@tests/fixtures/builders/template-until-plugin.builder") = jest.requireActual(
        "@tests/fixtures/builders/template-until-plugin.builder",
    )
    return { installed: parts.installationWith([fixture.UNTIL_PLUGIN], "template-array") }
})

/** One call the door was asked. */
interface DoorCall {
    readonly tool: string
    readonly key: string
}

/** The door of the world: every call kept; a read answers the next scripted answer (the last one again once they run out). */
const doorOf = (answers: ReadonlyArray<unknown>) => {
    const calls: Array<DoorCall> = []
    const queue = [...answers]
    const port: NodeToolDoor = {
        call: (call) => {
            calls.push({ tool: call.tool, key: call.key })
            const answer: unknown = call.tool === UNTIL_READ ? (queue.length > 1 ? queue.shift() : queue[0]) : {}
            return Promise.resolve(structuredClone(answer ?? {}))
        },
    }
    return { calls, port, reads: () => calls.filter((call) => call.tool === UNTIL_READ) }
}

/** The report of the AI core for a step it cannot complete: it stops for the founder. */
const report = {
    decision: "report",
    reason: "Buoc nay khong the tiep tuc.",
    question: "Lam gi tiep?",
    suggestions: [{ text: "Thu lai", handledBy: "workflow" }],
    customerLine: null,
}

const flowOf = (id: string): GraphSpec => {
    const graph = INSTALLED.templateOf(id)?.versions[0]?.graph
    if (graph === undefined) throw new Error(`no template ${id}`)
    return graph
}

const TRIGGER = { leadId: LEAD, locale: "vi" }

/** The installed nodes the save check reads (the core's). */
const INDEX = nodeIndexOf(INSTALLED.nodeInstall())

const started = async (_db: ThreadDb, process: ThreadProcess, id: string, flow: GraphSpec = flowOf(id)) => {
    const woken = await startThread(process, { flow, versionId: `${id}@1`, trigger: TRIGGER })
    return { runId: woken.runId ?? "", error: woken.error }
}

const viewOf = async (process: ThreadProcess, runId: string) => process.threads.stateOf({ workspaceId: WS, runId })

const stepsOf = async (process: ThreadProcess, runId: string): Promise<Readonly<Record<string, unknown>>> =>
    (await viewOf(process, runId))?.state.steps ?? {}

/** The ledger rows of the round write, by the step key their effect key carries. */
const writeRowsOf = (db: ThreadDb, stepKey: string) =>
    ledgerOf(db).filter((row) => row.effectId === UNTIL_WRITE && String(row.effectKey).includes(`:${stepKey}:`))

/** The problems the save check refused a flow for (its `params.problems`), or null when it took the flow. */
const refusedFor = (flow: GraphSpec): string | null => {
    try {
        requireSoundFlow(flow, INDEX)
        return null
    } catch (error: unknown) {
        return error instanceof AgentGraphsError ? String(error.params.problems) : String(error)
    }
}

/** The lookups the adapter reads a raw @2 document with: the core's control nodes and the fixture's template nodes. */
const lookups = {
    legacyNodeOf: (id: string) => INSTALLED.nodeInstall().nodes.find((one) => one.id === id),
    templateNodeOf: (id: string) => [untilNoteNode, untilCountNode, untilJudgeNode].find((one) => one.id === id),
}

/** The raw @2 document of the loop by data with its loop step changed (a document the SDK's builder would never write). */
const rawWith = (change: (loop: Readonly<Record<string, unknown>>) => Readonly<Record<string, unknown>>): GraphSpec => {
    const spec = untilDataGraph.spec
    const nodes = spec.nodes.map((step) => (step.kind === "loop" ? change(structuredClone(step) as unknown as Readonly<Record<string, unknown>>) : step))
    return graphOfSpecV2({ ...spec, nodes } as unknown as GraphSpecV2, lookups)
}

describe("loop({ until }) on threads", () => {
    it("by DATA: rounds until the counter reaches 3, then `next`; each round keyed by its number, its write a ledger row of its own", async () => {
        const db = threadDbOf()
        const door = doorOf([{ n: 1 }, { n: 2 }, { n: 3 }])
        const process = await processOf(db, { door: door.port, executors: noteExecutorsOf(db) })
        const { runId, error } = await started(db, process, UNTIL_DATA)

        expect(error).toBeNull()
        expect((await viewOf(process, runId))?.status).toBe("ended")
        const steps = await stepsOf(process, runId)
        expect(steps.poll).toMatchObject({ output: { rounds: 3, stopped: true, last: { n: 3 } } })
        expect(steps.done).toMatchObject({ output: { outcome: "done", values: { rounds: 3 } } })
        expect(steps.gaveup).toBeUndefined()
        // Every body step ran under `<loop>[r<round>].<node>`, and reads the round as its item.
        expect(Object.keys(steps).filter((key) => key.startsWith("poll["))).toEqual([
            "poll[r1].note",
            "poll[r1].count",
            "poll[r2].note",
            "poll[r2].count",
            "poll[r3].note",
            "poll[r3].count",
        ])
        expect(steps["poll[r2].note"]).toMatchObject({ output: { noted: true, round: "r2", index: 1 } })
        // The same tool with the same args in two rounds: two calls, two ledger rows, acted twice.
        expect(writeRowsOf(db, "poll[r1].note")).toHaveLength(1)
        expect(writeRowsOf(db, "poll[r2].note")).toHaveLength(1)
        expect(writeRowsOf(db, "poll[r1].note")[0]?.effectKey).not.toBe(writeRowsOf(db, "poll[r2].note")[0]?.effectKey)
        expect(noteActsOf(db).filter((act) => act.effect === UNTIL_WRITE)).toHaveLength(3)
        expect(door.reads()).toHaveLength(3)
    })

    it("by MEANING: the routing node answers continue, continue, stop; the loop stops after round 3", async () => {
        const db = threadDbOf()
        const door = doorOf([{ route: "continue" }, { route: "continue" }, { route: "stop" }])
        const process = await processOf(db, { door: door.port, executors: noteExecutorsOf(db) })
        const { runId, error } = await started(db, process, UNTIL_MEANING)

        expect(error).toBeNull()
        expect((await viewOf(process, runId))?.status).toBe("ended")
        const steps = await stepsOf(process, runId)
        expect(steps.ask).toMatchObject({ output: { rounds: 3, stopped: true, last: { route: "stop" } } })
        expect(steps.done).toMatchObject({ output: { outcome: "done", values: { rounds: 3 } } })
        expect(door.reads()).toHaveLength(3)
    })

    it("`max` reached: the `exhausted` branch runs with `stopped: false` and `rounds = max`; `next` never runs", async () => {
        const db = threadDbOf()
        const door = doorOf([{ n: 1 }])
        const process = await processOf(db, { door: door.port, executors: noteExecutorsOf(db) })
        const { runId } = await started(db, process, UNTIL_CAPPED)

        expect((await viewOf(process, runId))?.status).toBe("ended")
        const steps = await stepsOf(process, runId)
        expect(steps.poll).toMatchObject({ output: { rounds: 2, stopped: false, last: { n: 1 } } })
        expect(steps.gaveup).toMatchObject({ output: { outcome: "gaveup", values: { rounds: 2 } } })
        expect(steps.done).toBeUndefined()
        expect(steps["poll[r3].note"]).toBeUndefined()
    })

    it("`every`: parks between rounds (an interrupt, a stored timer, no stop), survives a restart, and the fired timer runs round 2 once", async () => {
        const db = threadDbOf()
        const door = doorOf([{ n: 1 }, { n: 2 }])
        const outbox = jobRecordingOutbox()
        const first = await processOf(db, { door: door.port, outbox, executors: noteExecutorsOf(db) })
        const { runId, error } = await started(db, first, UNTIL_EVERY)

        expect(error).toBeNull()
        // Round 1 ran; the thread is parked on LangGraph's interrupt with the round that waits, and no stop waits for a person.
        const parked = await viewOf(first, runId)
        expect(parked?.status).toBe("stopped")
        expect(parked?.stop?.question).toMatchObject({ kind: "until_round", loopKey: "poll", round: 2, parkKey: "poll[r2]" })
        expect(await stopsOf(first, runId)).toEqual([])
        expect(door.reads()).toHaveLength(1)
        // The engine timer: ONE delayed job of the thread-deadline queue, keyed by the park, due 30 minutes after round 1 ended.
        expect(outbox.written).toHaveLength(1)
        const [job] = outbox.written
        expect(job).toMatchObject({
            queue: "thread_deadline",
            job: "thread-deadline.fire",
            payload: { workspaceId: WS, runId, stepKey: "poll[r2]", repeats: 2, answered: -1 },
        })
        expect(job?.delayMs).toBeGreaterThan((UNTIL_EVERY_MINUTES - 1) * 60_000)
        expect(job?.delayMs).toBeLessThanOrEqual(UNTIL_EVERY_MINUTES * 60_000)
        const payload = { workspaceId: WS, runId, stepKey: "poll[r2]", repeats: 2, answered: -1 }
        // The timer firing early starts nothing: no wake, no step.
        const wakesBefore = db.wakes.length
        await expect(first.deadlines?.fire(payload)).resolves.toBe("early")
        expect(db.wakes).toHaveLength(wakesBefore)
        await drain(first, wakesBefore)
        expect(door.reads()).toHaveLength(1)

        // The process dies; time passes; a NEW process over the same checkpoint fires the stored timer.
        db.clock.advance((UNTIL_EVERY_MINUTES + 1) * 60_000)
        const second = await processOf(db, { door: door.port, outbox, executors: noteExecutorsOf(db) })
        await expect(second.deadlines?.fire(payload)).resolves.toBe("admitted")
        // The same timer fired twice writes one wake.
        await second.deadlines?.fire(payload)
        expect(db.wakes).toHaveLength(wakesBefore + 1)
        await drain(second, wakesBefore)

        expect((await viewOf(second, runId))?.status).toBe("ended")
        const steps = await stepsOf(second, runId)
        expect(steps.poll).toMatchObject({ output: { rounds: 2, stopped: true, last: { n: 2 } } })
        // Round 2 ran ONCE, round 1 was not run again.
        expect(door.reads().map((call) => call.key.includes("poll[r2].count"))).toEqual([false, true])
        expect(noteActsOf(db).filter((act) => act.effect === UNTIL_WRITE)).toHaveLength(2)
        // A timer for a park the thread no longer waits on does nothing.
        await expect(second.deadlines?.fire(payload)).resolves.toBe("closed")
    })

    it("a failed node in round 2 freezes; the retry re-runs only that node: round 1 is not re-run, round 2's write acted once", async () => {
        const db = threadDbOf()
        db.model.script(CORE, report)
        const door = doorOf([{ n: 1 }, { fail: true }, { n: 3 }])
        const process = await processOf(db, { door: door.port, executors: noteExecutorsOf(db) })
        const { runId } = await started(db, process, UNTIL_DATA)

        expect((await viewOf(process, runId))?.status).toBe("stopped")
        expect((await stopsOf(process, runId)).map((stop) => stop.stepKey)).toEqual(["poll[r2].count"])
        expect(noteActsOf(db).filter((act) => act.effect === UNTIL_WRITE)).toHaveLength(2)

        await founderDecides(process, runId, button(db, "retry"))

        expect((await viewOf(process, runId))?.status).toBe("ended")
        const steps = await stepsOf(process, runId)
        expect(steps.poll).toMatchObject({ output: { rounds: 2, stopped: true, last: { n: 3 } } })
        // Only `count` of round 2 ran again; `note` of round 2 and round 1 did not.
        expect(door.reads().map((call) => call.key.slice(call.key.indexOf(":") + 1, call.key.lastIndexOf(":")))).toEqual([
            "poll[r1].count",
            "poll[r2].count",
            "poll[r2].count",
        ])
        expect(noteActsOf(db).filter((act) => act.effect === UNTIL_WRITE)).toHaveLength(2)
        expect(writeRowsOf(db, "poll[r2].note")).toHaveLength(1)
    })

    it("refuses a cycle that does not pass through a loop, at save and at compile; the until cycle itself is legal", async () => {
        const flow = flowOf(UNTIL_DATA)
        expect(graphLoopProblemsOf(flow)).toEqual([])
        // An explicit edge from a body node back to its own loop is the end of a round: legal.
        const backEdge: GraphSpec = {
            ...flow,
            nodes: flow.nodes.map((one): GraphSpecNode => (one.key === "count" ? { ...one, next: "poll" } : one)),
        }
        expect(graphLoopProblemsOf(backEdge)).toEqual([])
        // `done` going back to `poll`: a cycle not through a loop's body.
        const cycled: GraphSpec = {
            ...flow,
            nodes: flow.nodes.map((one): GraphSpecNode => (one.key === "done" ? { ...one, next: "poll" } : one)),
        }
        expect(graphLoopProblemsOf(cycled).map((one) => one.code)).toContain("GRAPH_CYCLE")
        expect(refusedFor(cycled)).toContain("GRAPH_CYCLE done")
        const db = threadDbOf()
        const process = await processOf(db, { door: doorOf([{ n: 1 }]).port, executors: noteExecutorsOf(db) })
        const { error } = await started(db, process, UNTIL_DATA, cycled)
        expect(JSON.stringify(error)).toContain("GRAPH_CYCLE")
    })

    it("refuses `max: 11` and a missing `exhausted` in a raw @2 document, by the engine's own check and its compiler", async () => {
        const eleven = rawWith((step) => ({ ...step, params: { ...(step.params as object), max: 11 } }))
        expect(graphLoopProblemsOf(eleven)).toEqual([{ code: "GRAPH_LOOP_MAX", at: "poll" }])
        const routes = (step: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> => ({
            ...(step.routes as object),
        })
        const noExhausted = rawWith((step) => ({
            ...step,
            routes: Object.fromEntries(Object.entries(routes(step)).filter(([name]) => name !== "exhausted")),
        }))
        expect(graphLoopProblemsOf(noExhausted)).toEqual([{ code: "GRAPH_LOOP_EXHAUSTED_MISSING", at: "poll" }])
        expect(refusedFor(eleven)).toContain("GRAPH_LOOP_MAX poll")
        const db = threadDbOf()
        const process = await processOf(db, { door: doorOf([{ n: 1 }]).port, executors: noteExecutorsOf(db) })
        const refused = await started(db, process, "tmuntil.raw", noExhausted)
        expect(JSON.stringify(refused.error)).toContain("GRAPH_LOOP_EXHAUSTED_MISSING")
    })
})
