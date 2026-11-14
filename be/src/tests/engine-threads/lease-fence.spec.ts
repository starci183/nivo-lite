import { AgentThreadsErrorCode } from "@modules/domain/agent-threads"
import { LanggraphErrorCode } from "@modules/integrations/langgraph"
import { AGENT_WRITE_PURPOSE, CORE_AGENT_WRITE, NOTE_WRITE } from "@tests/fixtures/builders/engine-core-plugin.builder"
import { FRONT, WS, redrive, rowsOf, startThread, threadDbOf, type ThreadDb, type ThreadProcess } from "./thread-world"
import { NOTE_TRIGGER, coreFlowOf, coreProcessOf, noteActsOf } from "./thread-world-core"

// The GENERIC engine core fixture installed beside the core (`engine-core-plugin.builder.ts`; moved off the world's business desk by
// worker E: the same facts on the generic graph whose agent step writes itself, `tcore.agent-write`).
jest.mock("@nivo-lite/plugin-registry", () => {
    const parts: typeof import("@tests/fixtures/builders/installation-parts.builder") = jest.requireActual(
        "@tests/fixtures/builders/installation-parts.builder",
    )
    const fixture: typeof import("@tests/fixtures/builders/engine-core-plugin.builder") = jest.requireActual(
        "@tests/fixtures/builders/engine-core-plugin.builder",
    )
    return { installed: parts.installationWith([fixture.CORE_PLUGIN], "engine-core") }
})

// Package 0-9, item 4: one driver per thread. Inside one process the second driver gets `busy` (the thread runs refuse it by name, the
// client answers `busy`); across processes the saver refuses the writes of the driver whose lease was taken over (a stale fence), and
// the effects of that zombie are caught by the ledger. The first driver finishes once.

/** The code an error carries, or null. */
const codeOf = (error: unknown): unknown =>
    typeof error === "object" && error !== null ? Reflect.get(error, "code") : null

/** The agent step's turns: it writes the note, then says it did, `times` over. */
const answers = (db: ThreadDb, times: number) => {
    for (let one = 0; one < times; one += 1)
        db.model.script(AGENT_WRITE_PURPOSE, { call: { tool: NOTE_WRITE, args: { noteId: "n1", text: "x" } } }, { done: { said: "x" } })
}

/** Starts the agent-write graph on a thread of the process (not awaited: a spec holds its agent's turn). */
const writes = (process: ThreadProcess) =>
    startThread(process, { flow: coreFlowOf(CORE_AGENT_WRITE), versionId: `${FRONT}:agent-write@1`, trigger: NOTE_TRIGGER, workflowId: "wf:direct" })

describe("two drivers on one thread", () => {
    it("same process: the second driver is refused busy and runs nothing; the first finishes once", async () => {
        const db = threadDbOf()
        answers(db, 1)
        const process = await coreProcessOf(db)
        const held = db.model.hold(AGENT_WRITE_PURPOSE)
        const first = writes(process)
        await held.entered
        const runId = [...db.runs.keys()][0] ?? ""
        const ref = { workspaceId: WS, runId }

        const second = await redrive(process, runId, "sweep-1")
        const view = await process.threads.stateOf(ref)
        const graph = await process.graphs.pinned(ref, FRONT, view?.version ?? "")
        const direct = await process.threads.drive(ref, graph)
        held.release()
        const done = await first

        expect(second.map((one) => codeOf(one.error))).toEqual([AgentThreadsErrorCode.Busy])
        expect(direct).toEqual({ status: "busy" })
        expect(done.error).toBeNull()
        expect((await process.threads.stateOf(ref))?.status).toBe("ended")
        expect(noteActsOf(db)).toHaveLength(1)
        expect(db.model.askedOf(AGENT_WRITE_PURPOSE)).toHaveLength(2)
        expect(rowsOf(db, runId).run).toMatchObject({ status: "done", engine: "langgraph" })
    })

    it("two processes: the driver whose lease was taken over is fenced at the saver; the new one finishes; one send", async () => {
        const db = threadDbOf()
        answers(db, 2)
        const zombie = await coreProcessOf(db)
        const held = db.model.hold(AGENT_WRITE_PURPOSE)
        const first = writes(zombie)
        await held.entered
        const runId = [...db.runs.keys()][0] ?? ""
        const ref = { workspaceId: WS, runId }

        // Another worker takes the lease of the scope (a higher fence) and drives the thread on from its last checkpoint.
        db.checkpoints.takeOver(runId, db.fence + 1)
        const fresh = await coreProcessOf(db)
        const taken = await redrive(fresh, runId, "sweep-1")
        expect(taken.map((one) => one.error)).toEqual([null])
        const after = await fresh.threads.stateOf(ref)
        expect(after?.status).toBe("ended")

        held.release()
        const done = await first

        expect(codeOf(done.error)).toBe(LanggraphErrorCode.CheckpointFenced)
        expect(await fresh.threads.stateOf(ref)).toEqual(after)
        expect(noteActsOf(db)).toHaveLength(1)
        // The zombie's own row writes (it went on in the background) did not move the run page off the new driver's end.
        expect(rowsOf(db, runId).run).toMatchObject({ status: "done", engine: "langgraph" })
        // Every stored checkpoint row of the thread was written under the new driver's fence or before the take-over.
        const fences = db.checkpoints.rowsOf(runId).map((stored) => stored.fence)
        expect(Math.max(...fences.map((fence) => fence ?? 0))).toBe(db.fence)
    })
})
