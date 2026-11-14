import { CORE_WAIT, NOTE_WRITE, WAIT_MINUTES } from "@tests/fixtures/builders/engine-core-plugin.builder"
import { jobRecordingOutbox } from "@tests/fixtures/builders/queue-job-outbox.builder"
import { CONV, WS, customerWrites, drain, stopsOf, threadDbOf, type ThreadDb, type ThreadProcess } from "./thread-world"
import { coreProcessOf, coreStarted, noteActsOf, threadOf } from "./thread-world-core"

// ENGINE CORE: `wait` (owner; generic): a step that waits on the SAME run for one of several triggers, with a timeout, and routes on
// which came. Real: the thread engine, the wait node (park = interrupt + stored deadline job, no stop), the flow's first look at a wake
// (a parked wait of the agent takes the event before any workflow), the ONE wake per park (the once-key `thread:<run>:wait:<park>`),
// the deadline firing and the drain. Faked: the outside world, the test write's executor, the queue outbox (it records the job).
jest.mock("@nivo-lite/plugin-registry", () => {
    const parts: typeof import("@tests/fixtures/builders/installation-parts.builder") = jest.requireActual(
        "@tests/fixtures/builders/installation-parts.builder",
    )
    const fixture: typeof import("@tests/fixtures/builders/engine-core-plugin.builder") = jest.requireActual(
        "@tests/fixtures/builders/engine-core-plugin.builder",
    )
    return { installed: parts.installationWith([fixture.CORE_PLUGIN], "engine-core") }
})

/** The run's trigger: the note, its line, the word a naming line holds, and the route the run serves (the generic scope's `routeId`: its subject). */
const TRIGGER = { noteId: "note-1", text: "da ghi", word: "A12", conversationId: CONV, routeId: CONV, locale: "vi" }

/** A run of the wait graph, parked on its wait. */
const parked = async () => {
    const db = threadDbOf()
    const outbox = jobRecordingOutbox()
    const process = await coreProcessOf(db, { outbox })
    const runId = await coreStarted(process, CORE_WAIT, TRIGGER)
    return { db, outbox, process, runId }
}

/** The texts the run wrote, in order. */
const linesOf = (db: ThreadDb): ReadonlyArray<unknown> =>
    noteActsOf(db)
        .filter((act) => act.effect === NOTE_WRITE)
        .map((act) => act.payload.text)

/** The deadline job of the park, as it was armed. */
const deadlineOf = (runId: string) => ({ workspaceId: WS, runId, stepKey: "hold", repeats: 0, answered: -2 })

/** A customer line in the run's conversation, through the REAL flow, then the wakes it wrote. */
const lineCame = async (process: ThreadProcess, db: ThreadDb, text: string) => {
    const from = db.wakes.length
    const woken = await customerWrites(process, text)
    await drain(process, from)
    return woken
}

describe("wait on a thread", () => {
    it("parks: an interrupt naming the triggers, ONE deadline job, no stop for a person", async () => {
        const { db, outbox, process, runId } = await parked()

        const thread = await threadOf(process, runId)
        expect(thread.status).toBe("stopped")
        const view = await process.threads.stateOf({ workspaceId: WS, runId })
        expect(view?.stop?.question).toMatchObject({
            kind: "wait",
            parkKey: "hold",
            on: [
                { key: "named", match: [{ member: "data.text", op: "contains", value: "A12" }] },
                { key: "replied" },
            ],
            subject: { conversationId: CONV },
        })
        expect(await stopsOf(process, runId)).toEqual([])
        expect(outbox.written).toHaveLength(1)
        expect(outbox.written[0]).toMatchObject({ queue: "thread_deadline", payload: deadlineOf(runId) })
        expect(outbox.written[0]?.delayMs).toBeLessThanOrEqual(WAIT_MINUTES * 60_000)
        expect(linesOf(db)).toEqual(["da ghi"])
    })

    it("event A (a line naming the word) resumes the SAME run along route A, with the event as the step's output", async () => {
        const { db, process, runId } = await parked()

        const woken = await lineCame(process, db, "chuyen khoan don A12 roi")

        expect(woken.ending).toMatchObject({ status: "done", reason: "wait_took" })
        const thread = await threadOf(process, runId)
        expect(thread.status).toBe("ended")
        expect(thread.steps.hold).toMatchObject({ output: { trigger: "named", event: { routeId: CONV, data: { text: "chuyen khoan don A12 roi" } } } })
        expect(linesOf(db)).toEqual(["da ghi", "chuyen khoan don A12 roi"])
        expect(thread.steps.replied).toBeUndefined()
    })

    it("event B (any other line of the conversation) resumes along route B", async () => {
        const { db, process, runId } = await parked()

        await lineCame(process, db, "cam on shop")

        const thread = await threadOf(process, runId)
        expect(thread.status).toBe("ended")
        expect(thread.steps.hold).toMatchObject({ output: { trigger: "replied", event: { data: { text: "cam on shop" } } } })
        expect(linesOf(db)).toEqual(["da ghi", "cam on shop"])
    })

    it("the timeout: early does nothing; once due the deadline resumes along `timeout`; fired again it is a no-op", async () => {
        const { db, process, runId } = await parked()
        const payload = deadlineOf(runId)

        const before = db.wakes.length
        await expect(process.deadlines?.fire(payload)).resolves.toBe("early")
        expect(db.wakes).toHaveLength(before)
        db.clock.advance((WAIT_MINUTES + 1) * 60_000)
        await expect(process.deadlines?.fire(payload)).resolves.toBe("admitted")
        await process.deadlines?.fire(payload)
        expect(db.wakes).toHaveLength(before + 1)
        await drain(process, before)

        const thread = await threadOf(process, runId)
        expect(thread.status).toBe("ended")
        expect(thread.steps.hold).toMatchObject({ output: { trigger: "timeout" } })
        expect(linesOf(db)).toEqual(["da ghi", "het gio"])
        await expect(process.deadlines?.fire(payload)).resolves.toBe("closed")
    })

    it("the deadline arriving after the event is a no-op: the run went on along the event's route only", async () => {
        const { db, process, runId } = await parked()
        await lineCame(process, db, "don A12")
        db.clock.advance((WAIT_MINUTES + 1) * 60_000)

        await expect(process.deadlines?.fire(deadlineOf(runId))).resolves.toBe("closed")
        expect(linesOf(db)).toEqual(["da ghi", "don A12"])
    })

    it("the deadline first, then a line: the line takes no park (it follows its own road), the run ends on `timeout` once", async () => {
        const { db, process, runId } = await parked()
        db.clock.advance((WAIT_MINUTES + 1) * 60_000)
        const before = db.wakes.length
        await expect(process.deadlines?.fire(deadlineOf(runId))).resolves.toBe("admitted")
        // The line comes while the timeout's wake is written and not yet run: the park's one wake is taken, so the line is not the run's.
        const woken = await customerWrites(process, "don A12")
        expect(woken.ending?.reason).not.toBe("wait_took")
        await drain(process, before)

        const thread = await threadOf(process, runId)
        expect(thread.steps.hold).toMatchObject({ output: { trigger: "timeout" } })
        expect(linesOf(db)).toEqual(["da ghi", "het gio"])
    })

    it("an unrelated event (a line of another conversation) does not resume the wait", async () => {
        const { db, process, runId } = await parked()

        const woken = await customerWrites(process, "don A12", { turn: { context: { conversationId: "conv-other", messageId: "m-x" } } })

        expect(woken.ending?.reason).not.toBe("wait_took")
        expect((await threadOf(process, runId)).status).toBe("stopped")
        expect(linesOf(db)).toEqual(["da ghi"])
    })
})
