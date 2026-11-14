import { AGENT_WRITE_PURPOSE, CORE_AGENT_WRITE, NOTE_WRITE } from "@tests/fixtures/builders/engine-core-plugin.builder"
import { CORE, FRONT, WS, rowsOf, startThread, stopsOf, threadDbOf } from "./thread-world"
import { NOTE_TRIGGER, coreFlowOf, coreProcessOf, noteActsOf } from "./thread-world-core"

// The GENERIC engine core fixture installed beside the core (`engine-core-plugin.builder.ts`; moved off the world's business desk by
// worker E: the same facts on the generic graph whose agent step writes itself and answers its words, `tcore.agent-write`).
jest.mock("@nivo-lite/plugin-registry", () => {
    const parts: typeof import("@tests/fixtures/builders/installation-parts.builder") = jest.requireActual(
        "@tests/fixtures/builders/installation-parts.builder",
    )
    const fixture: typeof import("@tests/fixtures/builders/engine-core-plugin.builder") = jest.requireActual(
        "@tests/fixtures/builders/engine-core-plugin.builder",
    )
    return { installed: parts.installationWith([fixture.CORE_PLUGIN], "engine-core") }
})

// Package 0-9, item 9 (design risk 2, the spec 0-2 dropped): a step whose state would exceed the checkpoint ceiling is stopped by the engine
// for the founder before anything of it is written; the saver's own refusal (`LANGGRAPH_CHECKPOINT_TOO_LARGE`) stays the backstop.

const LIMITS = { warnBytes: 2_000, maxBytes: 8_000, listMax: 1000 }
const LONG = "Ghi chu da duoc luu lai. ".repeat(400)

/** The agent step writes the note, then answers `said`. */
const writesThenSays = (said: string) =>
    [{ call: { tool: NOTE_WRITE, args: { noteId: "n1", text: "x" } } }, { done: { said } }] as const

/** Starts the agent-write graph on a thread. */
const started = (process: Awaited<ReturnType<typeof coreProcessOf>>) =>
    startThread(process, { flow: coreFlowOf(CORE_AGENT_WRITE), versionId: `${FRONT}:agent-write@1`, trigger: NOTE_TRIGGER, workflowId: "wf:direct" })

describe("the checkpoint size ceiling", () => {
    it("stops a step whose output is over the limit for the founder (an engine stop); nothing over the limit is stored", async () => {
        const db = threadDbOf()
        db.model.script(AGENT_WRITE_PURPOSE, ...writesThenSays(LONG))
        const process = await coreProcessOf(db, { limits: LIMITS })

        const woken = await started(process)

        expect(LONG.length).toBeGreaterThan(LIMITS.maxBytes)
        // N-0-9-1 (fixed): the node measures its output against the ceiling before writing anything and stops the step itself, so the
        // checkpoint never refuses it: the thread waits at the gate with an engine stop and one card; the AI core is not asked.
        expect(woken.error).toBeNull()
        const runId = woken.runId ?? ""
        const stored = db.checkpoints.rowsOf(runId)
        expect(Math.max(...stored.map((one) => one.row.payload.byteLength))).toBeLessThanOrEqual(LIMITS.maxBytes)
        const view = await process.threads.stateOf({ workspaceId: WS, runId })
        expect(view?.status).toBe("stopped")
        expect(Object.keys(view?.state.steps ?? {})).toEqual([])
        const [stop, ...none] = await stopsOf(process, runId)
        expect(none).toEqual([])
        expect(stop).toMatchObject({ stepKey: "write", kind: "engine", state: "open" })
        expect(stop?.detail.facts).toEqual(
            expect.arrayContaining([expect.objectContaining({ value: "step_output_too_large" })]),
        )
        expect(db.team).toHaveLength(1)
        expect(db.model.askedOf(CORE)).toHaveLength(0)
        expect(rowsOf(db, runId).steps.map((step) => [step.stepKey, step.status])).toEqual([["write", "failed"]])
        // The write itself acted once, before the output was measured (the ledger keeps it for the retry).
        expect(noteActsOf(db)).toHaveLength(1)
        expect(rowsOf(db, runId).run).toMatchObject({ status: "waiting" })
    })

    it("keeps a step under the limit (the same walk with a short reply ends) and the thread small", async () => {
        const db = threadDbOf()
        db.model.script(AGENT_WRITE_PURPOSE, ...writesThenSays("Da ghi."))
        const process = await coreProcessOf(db, { limits: LIMITS })

        const woken = await started(process)

        expect(woken.error).toBeNull()
        expect((await process.threads.stateOf({ workspaceId: WS, runId: woken.runId ?? "" }))?.status).toBe("ended")
        // Growth (design risk 2): the two-step walk keeps a handful of rows and a few kilobytes per thread.
        const usage = await db.checkpoints.port.usage(WS, woken.runId ?? "")
        expect(usage.checkpoints).toBeLessThanOrEqual(6)
        expect(usage.bytes).toBeLessThan(16 * 1024)
    })
})
