import { TOOL } from "@nivo-lite/blocks-core"
import { AgentThreadsErrorCode } from "@modules/domain/agent-threads"
import { LanggraphErrorCode } from "@modules/integrations/langgraph"
import {
    ANSWER,
    CONV,
    FRONT,
    FRONT_DESK,
    UNDERSTAND,
    WS,
    actsOf,
    customerWrites,
    processOf,
    redrive,
    rowsOf,
    threadDbOf,
    type ThreadDb,
} from "./thread-world"

// Package 0-9, item 4: one driver per thread. Inside one process the second driver gets `busy` (the thread runs refuse it by name, the
// client answers `busy`); across processes the saver refuses the writes of the driver whose lease was taken over (a stale fence), and
// the effects of that zombie are caught by the ledger. The first driver finishes once.

/** The code an error carries, or null. */
const codeOf = (error: unknown): unknown =>
    typeof error === "object" && error !== null ? Reflect.get(error, "code") : null

const OUTCOME = "Shop mo cua tu 8h den 21h a."

const answers = (db: ThreadDb, times: number) => {
    db.model.script(UNDERSTAND, { answer: { branch: "question", summary: "Lan: gio mo cua" } })
    for (let one = 0; one < times; one += 1)
        db.model.script(
            ANSWER,
            { call: { tool: TOOL.customerMessageSend, args: { conversationId: CONV, text: OUTCOME } } },
            { done: { reply: OUTCOME } },
        )
}

describe("two drivers on one thread", () => {
    it("same process: the second driver is refused busy and runs nothing; the first finishes once", async () => {
        const db = threadDbOf()
        answers(db, 1)
        const process = await processOf(db, { flag: [FRONT_DESK] })
        const held = db.model.hold(ANSWER)
        const first = customerWrites(process, "Shop mo cua may gio?")
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
        expect(actsOf(db, TOOL.customerMessageSend)).toHaveLength(1)
        expect(db.model.askedOf(ANSWER)).toHaveLength(2)
        expect(rowsOf(db, runId).run).toMatchObject({ status: "done", engine: "langgraph" })
    })

    it("two processes: the driver whose lease was taken over is fenced at the saver; the new one finishes; one send", async () => {
        const db = threadDbOf()
        answers(db, 2)
        const zombie = await processOf(db, { flag: [FRONT_DESK] })
        const held = db.model.hold(ANSWER)
        const first = customerWrites(zombie, "Shop mo cua may gio?")
        await held.entered
        const runId = [...db.runs.keys()][0] ?? ""
        const ref = { workspaceId: WS, runId }

        // Another worker takes the lease of the scope (a higher fence) and drives the thread on from its last checkpoint.
        db.checkpoints.takeOver(runId, db.fence + 1)
        const fresh = await processOf(db, { flag: [FRONT_DESK] })
        const taken = await redrive(fresh, runId, "sweep-1")
        expect(taken.map((one) => one.error)).toEqual([null])
        const after = await fresh.threads.stateOf(ref)
        expect(after?.status).toBe("ended")

        held.release()
        const done = await first

        expect(codeOf(done.error)).toBe(LanggraphErrorCode.CheckpointFenced)
        expect(await fresh.threads.stateOf(ref)).toEqual(after)
        expect(actsOf(db, TOOL.customerMessageSend)).toHaveLength(1)
        expect(db.lines).toHaveLength(1)
        // The zombie's own row writes (it went on in the background) did not move the run page off the new driver's end.
        expect(rowsOf(db, runId).run).toMatchObject({ status: "done", engine: "langgraph" })
        // Every stored checkpoint row of the thread was written under the new driver's fence or before the take-over.
        const fences = db.checkpoints.rowsOf(runId).map((stored) => stored.fence)
        expect(Math.max(...fences.map((fence) => fence ?? 0))).toBe(db.fence)
    })
})
