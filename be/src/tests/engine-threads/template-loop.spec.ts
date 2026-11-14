import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import { INSTALLED } from "@modules/domain/installed-plugins"
import { LOOP_GRAPH, MARK_FAILS, SIDE_FAILS } from "@tests/fixtures/builders/template-loop-plugin.builder"
import { CORE, WS, processOf, startThread, stopsOf, threadDbOf, type ThreadDb } from "./thread-world"

// SLICE G4 (contract ADDENDUM 2 point 3(e)(f)): a `nivo/agent-graph@2` for-each of TEMPLATE nodes, run on threads by the REAL engine
// (the thread compiler, the node function, the node host's template branch, the loop frame, the stops and the gate). The body is two
// nodes behind an `ifNode` that may end the item (`endItem`): `side` (NON-blocking) then `mark` (blocking, the collect step, which
// answers `ctx.run.item`). Faked: the model (only the AI core is ever asked) and the outside world (no node calls a tool).
jest.mock("@nivo-lite/plugin-registry", () => {
    const parts: typeof import("@tests/fixtures/builders/installation-parts.builder") = jest.requireActual(
        "@tests/fixtures/builders/installation-parts.builder",
    )
    const fixture: typeof import("@tests/fixtures/builders/template-loop-plugin.builder") = jest.requireActual(
        "@tests/fixtures/builders/template-loop-plugin.builder",
    )
    return { installed: parts.installationWith([fixture.LOOP_PLUGIN], "template-array") }
})

/** The report of the AI core for a step it cannot complete: it stops for the founder. */
const report = {
    decision: "report",
    reason: "Buoc nay khong the tiep tuc.",
    question: "Lam gi tiep?",
    suggestions: [{ text: "Thu lai", handledBy: "workflow" }],
    customerLine: null,
}

const flow = (): GraphSpec => {
    const graph = INSTALLED.templateOf(LOOP_GRAPH)?.versions[0]?.graph
    if (graph === undefined) throw new Error(`no template ${LOOP_GRAPH}`)
    return graph
}

const ran = async (db: ThreadDb, orders: ReadonlyArray<{ readonly orderId: string; readonly skip: boolean }>) => {
    const process = await processOf(db, {})
    const woken = await startThread(process, { flow: flow(), versionId: `${LOOP_GRAPH}@1`, trigger: { orders, locale: "vi" } })
    expect(woken.error).toBeNull()
    const runId = woken.runId ?? ""
    const state = await process.threads.stateOf({ workspaceId: WS, runId })
    return { process, runId, status: state?.status, steps: state?.state.steps ?? {} }
}

describe("a for-each of template nodes (GraphSpec @2)", () => {
    it("on an empty list completes with no item and runs the step after the loop", async () => {
        const db = threadDbOf()
        const { status, steps } = await ran(db, [])

        expect(status).toBe("ended")
        expect(steps.each).toMatchObject({ output: { items: [], held: null } })
        expect(steps.tally).toMatchObject({ output: { count: 0 } })
        expect(steps.done).toMatchObject({ output: { outcome: "done", values: { count: 0 } } })
    })

    it("runs the two-node body per item, hands each template node its item, and ends an item early through endItem", async () => {
        const db = threadDbOf()
        const { status, steps } = await ran(db, [
            { orderId: "o-1", skip: false },
            { orderId: "o-2", skip: true },
            { orderId: "o-3", skip: false },
        ])

        expect(status).toBe("ended")
        expect(steps.each).toMatchObject({
            output: {
                items: [
                    { key: "o-1", output: { orderId: "o-1", seen: "o-1", key: "o-1", index: 0 } },
                    { key: "o-2", output: null },
                    { key: "o-3", output: { orderId: "o-3", seen: "o-3", key: "o-3", index: 2 } },
                ],
            },
        })
        expect(steps.tally).toMatchObject({ output: { count: 3 } })
    })

    it("passes over a NON-blocking body node that fails: the item goes on to the next body node, the run ends", async () => {
        const db = threadDbOf()
        const { status, steps } = await ran(db, [
            { orderId: SIDE_FAILS, skip: false },
            { orderId: "o-2", skip: false },
        ])

        expect(status).toBe("ended")
        expect(steps.each).toMatchObject({
            output: {
                items: [
                    { key: SIDE_FAILS, output: { orderId: SIDE_FAILS, seen: "", key: SIDE_FAILS, index: 0 } },
                    { key: "o-2", output: { orderId: "o-2", seen: "o-2", key: "o-2", index: 1 } },
                ],
            },
        })
    })

    it("freezes the run at the item whose BLOCKING body node fails; no later item runs", async () => {
        const db = threadDbOf()
        db.model.script(CORE, report)
        const { process, runId, status, steps } = await ran(db, [
            { orderId: "o-1", skip: false },
            { orderId: MARK_FAILS, skip: false },
            { orderId: "o-3", skip: false },
        ])

        expect(status).toBe("stopped")
        expect((await stopsOf(process, runId)).map((stop) => stop.stepKey)).toEqual([`each[${MARK_FAILS}].mark`])
        expect(steps.tally).toBeUndefined()
        expect(JSON.stringify(steps)).not.toContain('"o-3"')
    })
})

/** The installed loop graph as a fan-out: the same `@2` graph with `concurrency` 2 on its loop (a `loop({ over, concurrency })`). */
const fanned = (): GraphSpec => {
    const graph = flow()
    return { ...graph, nodes: graph.nodes.map((one) => (one.key === "each" ? { ...one, params: { ...one.params, concurrency: 2 } } : one)) }
}

const fannedRun = async (db: ThreadDb, orders: ReadonlyArray<{ readonly orderId: string; readonly skip: boolean }>) => {
    const process = await processOf(db, {})
    const woken = await startThread(process, { flow: fanned(), versionId: `${LOOP_GRAPH}@fan`, trigger: { orders, locale: "vi" } })
    expect(woken.error).toBeNull()
    const runId = woken.runId ?? ""
    const state = await process.threads.stateOf({ workspaceId: WS, runId })
    return { process, runId, status: state?.status, steps: state?.state.steps ?? {} }
}

describe("a for-each of template nodes as a Send fan-out (concurrency 2), on the real engine", () => {
    it("runs every item's body in its own branch, ends an item early through endItem, passes a side node over, gathers in list order", async () => {
        const db = threadDbOf()
        const { status, steps } = await fannedRun(db, [
            { orderId: "o-1", skip: false },
            { orderId: "o-2", skip: true },
            { orderId: SIDE_FAILS, skip: false },
            { orderId: "o-4", skip: false },
            { orderId: "o-5", skip: false },
        ])

        expect(status).toBe("ended")
        expect(steps.each).toMatchObject({
            output: {
                items: [
                    { key: "o-1", output: { orderId: "o-1", seen: "o-1", key: "o-1", index: 0 } },
                    { key: "o-2", output: null },
                    { key: SIDE_FAILS, output: { orderId: SIDE_FAILS, seen: "", key: SIDE_FAILS, index: 2 } },
                    { key: "o-4", output: { orderId: "o-4", seen: "o-4", key: "o-4", index: 3 } },
                    { key: "o-5", output: { orderId: "o-5", seen: "o-5", key: "o-5", index: 4 } },
                ],
                held: null,
            },
        })
        expect(steps.tally).toMatchObject({ output: { count: 5 } })
    })

    it("holds the item whose BLOCKING node fails while the other item of its window ends; no later window starts", async () => {
        const db = threadDbOf()
        db.model.script(CORE, report)
        const { process, runId, status, steps } = await fannedRun(db, [
            { orderId: "o-1", skip: false },
            { orderId: "o-2", skip: false },
            { orderId: MARK_FAILS, skip: false },
            { orderId: "o-4", skip: false },
            { orderId: "o-5", skip: false },
        ])

        expect(status).toBe("stopped")
        expect((await stopsOf(process, runId)).map((stop) => stop.stepKey)).toEqual([`each[${MARK_FAILS}].mark`])
        // The other item of the held item's window ended; the window after it did not start.
        expect(steps["each[o-4].mark"]).toMatchObject({ output: { orderId: "o-4" } })
        expect(JSON.stringify(steps)).not.toContain('"o-5"')
        expect(steps.tally).toBeUndefined()
    })
})
