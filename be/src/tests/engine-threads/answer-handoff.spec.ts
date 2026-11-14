import { mock } from "@starci/jest-preset"
import { TOOL } from "@nivo-lite/agent-sdk/names"
import { THREAD_RESUME_EVENT } from "@modules/domain/agent-threads"
import { AgentWorkReadService } from "@modules/domain/agent-work"
import {
    ANSWER,
    CONV,
    CORE,
    UNDERSTAND,
    WS,
    answer,
    button,
    customerWrites,
    drain,
    processOf,
    stopsOf,
    threadDbOf,
    type ThreadDb,
    type ThreadProcess,
} from "./thread-world"

// The answer road of a stop (mcp.md rule 10, engine-core.md): a person's answer is ADMITTED FROM THE STORES and RECORDED as the run's ONE
// resume wake (the resume requests, which any app runs: the api, the mcp app), then the drain RESUMES the thread under the run's lease
// with the checkpoint as the second guard. The decision goes in through the real resume requests and comes out through the real drain.

const OUTCOME = "Shop mo cua tu 8h den 21h a."
const report = () => ({
    decision: "report",
    reason: "Buoc khong the hoan thanh.",
    question: "Shop mo may gio?",
    suggestions: [{ text: "8h-21h", handledBy: "workflow" }],
    customerLine: null,
})
/** The model turns of one run of the answer step once the founder answered: the customer send, then done. */
const TURNS = 2
const sends = (text: string) => ({ call: { tool: TOOL.customerMessageSend, args: { conversationId: CONV, text } } })

/** The work core's reader of a written wake (what tells a second, different decision from the same one again), over the world's wakes. */
const wakeReaderOf = (db: ThreadDb): AgentWorkReadService =>
    mock<AgentWorkReadService>({
        wakeContextOf: (_ws: string, agentId: string, source: string, eventKey: string) =>
            Promise.resolve(
                db.wakes.find((wake) => wake.agentId === agentId && wake.source === source && wake.eventKey === eventKey)?.context ??
                    null,
            ),
    })

/** A process of the world that reads its wakes back, as the api and the mcp app do. */
const readingProcessOf = (db: ThreadDb): Promise<ThreadProcess> =>
    processOf(db, { extra: [{ provide: AgentWorkReadService, useValue: wakeReaderOf(db) }] })

/** The answer step cannot go on; the AI core reports: one open stop at `answer`, the run waiting. */
const stopsAtAnswer = async (db: ThreadDb) => {
    db.model.script(UNDERSTAND, { done: { branch: "question", summary: "Lan: gio mo cua" } })
    db.model.script(ANSWER, { confused: { reason: "Khong ro gio mo cua", question: "Shop mo may gio?" } })
    db.model.script(CORE, report())
    const process = await readingProcessOf(db)
    const runId = (await customerWrites(process, "Shop mo cua may gio?")).runId ?? ""
    return { process, runId, ref: { workspaceId: WS, runId } }
}

/** The resume wakes recorded for the run. */
const resumesOf = (db: ThreadDb, runId: string) =>
    db.wakes.filter((wake) => wake.context.eventName === THREAD_RESUME_EVENT && wake.context.subjectId === runId)

describe("the answer road: recorded from the stores, handed off as one resume wake, resumed by the drain", () => {
    it("an answer given twice: the same words again are the same wake, any other decision (a button, the deadline) loses, the thread resumes ONCE", async () => {
        const db = threadDbOf()
        const { process, runId, ref } = await stopsAtAnswer(db)
        const from = db.wakes.length
        const words = answer(db, "8h den 21h")

        await expect(process.requests.resume(ref, words)).resolves.toEqual({ kind: "admitted", fresh: true })
        await expect(process.requests.resume(ref, words)).resolves.toEqual({ kind: "admitted", fresh: false })
        await expect(process.requests.resume(ref, button(db, "skip"))).resolves.toEqual({ kind: "refused", code: "already_answered" })
        await expect(process.requests.resume(ref, { kind: "timeout", at: db.clock.now().toISOString() })).resolves.toEqual({
            kind: "refused",
            code: "already_answered",
        })
        // Recorded, not applied: one resume wake, the step not run again, the stop still open.
        expect(resumesOf(db, runId)).toHaveLength(1)
        expect(resumesOf(db, runId)[0]?.eventKey).toBe(`thread:${runId}:answer:0`)
        expect(db.model.askedOf(ANSWER)).toHaveLength(1)
        expect((await stopsOf(process, runId))[0]).toMatchObject({ state: "open", answers: [] })

        db.model.script(ANSWER, sends(OUTCOME), { done: { reply: OUTCOME } })
        await drain(process, from)

        // ONE more run of the step: its two turns (the send, then done), with the words.
        expect(db.model.askedOf(ANSWER)).toHaveLength(1 + TURNS)
        expect(JSON.stringify(db.model.askedOf(ANSWER).at(-1)?.request.input)).toContain("8h den 21h")
        expect((await process.threads.stateOf(ref))?.status).toBe("ended")
        expect((await stopsOf(process, runId))[0]).toMatchObject({
            state: "resolved",
            answers: [{ kind: "answer", text: "8h den 21h" }],
        })
    })

    it("an answer recorded, the process killed before its job ran: the next process resumes it ONCE, and its wake run again moves nothing", async () => {
        const db = threadDbOf()
        const { process, runId, ref } = await stopsAtAnswer(db)
        const from = db.wakes.length
        await expect(process.requests.resume(ref, answer(db, "8h den 21h"))).resolves.toEqual({ kind: "admitted", fresh: true })

        // The process dies here: the recorded wake (and its drain job) is all that is left in the database.
        const restarted = await readingProcessOf(db)
        db.model.script(ANSWER, sends(OUTCOME), { done: { reply: OUTCOME } })
        await drain(restarted, from)

        expect(db.model.askedOf(ANSWER)).toHaveLength(1 + TURNS)
        expect((await restarted.threads.stateOf(ref))?.status).toBe("ended")
        // The same job delivered again (its end was lost): the answer is applied already, the thread is not resumed twice.
        await drain(restarted, from)
        expect(db.model.askedOf(ANSWER)).toHaveLength(1 + TURNS)
        expect((await stopsOf(restarted, runId))[0]?.answers).toHaveLength(1)
        expect(resumesOf(db, runId)).toHaveLength(1)
    })

    it("an answer whose thread moved on before its job ran (the engine closed the run): a no-op for the thread, one stale line, nothing kept", async () => {
        const db = threadDbOf()
        const { process, runId, ref } = await stopsAtAnswer(db)
        const from = db.wakes.length
        await expect(process.requests.resume(ref, answer(db, "8h den 21h"))).resolves.toEqual({ kind: "admitted", fresh: true })
        // Before the drain takes the wake, the run is closed by the engine (its pinned version can no longer run): its stops resolve.
        await expect(process.stops.runClosed(ref, { locale: "vi" })).resolves.toBe(1)

        await drain(process, from)

        expect(db.model.askedOf(ANSWER)).toHaveLength(1)
        expect((await process.threads.stateOf(ref))?.status).toBe("stopped")
        expect((await stopsOf(process, runId))[0]).toMatchObject({ state: "resolved", answers: [] })
        expect(process.logger.warn).toHaveBeenCalledWith("agent_threads.decision_stale", {
            runId,
            stepKey: "answer",
            kind: "answer",
            by: "owner-1",
        })
        // A later answer on the closed stop is refused from the stores, with nothing recorded.
        await expect(process.requests.resume(ref, button(db, "retry"))).resolves.toEqual({ kind: "refused", code: "thread_not_stopped" })
        expect(resumesOf(db, runId)).toHaveLength(1)
    })
})
