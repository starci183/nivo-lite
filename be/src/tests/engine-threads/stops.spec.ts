import { TOOL } from "@nivo-lite/blocks-core"
import {
    ANSWER,
    COMPLAINT,
    CONV,
    CORE,
    FRONT,
    FRONT_DESK,
    UNDERSTAND,
    WS,
    actsOf,
    answer,
    button,
    customerWrites,
    founderDecides,
    frontDeskFlow,
    processOf,
    redrive,
    rowsOf,
    startThread,
    stopsOf,
    threadDbOf,
    type ThreadDb,
} from "./thread-world"

// Package 0-9, items 6 and 8: the stop of a thread, with the real stops (records, cards, gate) and the real projection.

const OUTCOME = "Shop mo cua tu 8h den 21h a."
const report = (question = "Shop mo may gio?") => ({
    decision: "report",
    reason: "Buoc khong the hoan thanh.",
    question,
    suggestions: [
        { text: "8h-21h", handledBy: "workflow" },
        { text: "Toi tu tra loi", handledBy: "person" },
    ],
    customerLine: null,
})
const sends = (text: string) => ({ call: { tool: TOOL.customerMessageSend, args: { conversationId: CONV, text } } })

/** The answer step cannot go on; the AI core reports: one stop of kind ai_report at `answer`. */
const stopsAtAnswer = async (db: ThreadDb) => {
    db.model.script(UNDERSTAND, { answer: { branch: "question", summary: "Lan: gio mo cua" } })
    db.model.script(ANSWER, { confused: { reason: "Khong ro gio mo cua", question: "Shop mo may gio?" } })
    db.model.script(CORE, report())
    const process = await processOf(db, { flag: [FRONT_DESK] })
    const runId = (await customerWrites(process, "Shop mo cua may gio?")).runId ?? ""
    return { process, runId, ref: { workspaceId: WS, runId } }
}

describe("a stop for a run with no customer at all (the bank-fed shape: no lead, no conversation)", () => {
    it("keeps ONE stop record per run and step through re-drives and a second stop after an answer; the words kept on the stop", async () => {
        const db = threadDbOf({ leadId: null })
        // The understand step cannot even bind (no conversation): the trouble goes to the AI core, which reports.
        db.model.script(CORE, report("Day la giao dich gi?"), report("Van chua ro."))
        const process = await processOf(db, { flag: [FRONT_DESK] })
        const started = await startThread(process, {
            flow: frontDeskFlow(),
            versionId: "chatbot-agent:front-desk@4",
            trigger: { text: "Money in", subject: { kind: "bank-transaction", id: "tx-1" } },
        })
        expect(started.error).toBeNull()
        const runId = started.runId ?? ""

        const [first, ...none] = await stopsOf(process, runId)
        expect(none).toEqual([])
        expect(first).toMatchObject({
            stepKey: "understand",
            kind: "ai_report",
            state: "open",
            leadId: null,
            conversationId: null,
            repeats: 1,
        })
        await redrive(process, runId, "sweep-1")
        await redrive(process, runId, "sweep-2")
        expect((await stopsOf(process, runId)).map((stop) => stop.repeats)).toEqual([1])

        await founderDecides(process, runId, answer(db, "Day la tien coc don DH-1"))

        const stops = await stopsOf(process, runId)
        expect(stops).toHaveLength(1)
        expect(stops[0]).toMatchObject({ state: "open", repeats: 2 })
        expect(stops[0]?.answers.map((one) => one.text)).toEqual(["Day la tien coc don DH-1"])
        // The founder's words reached the AI core on the second visit (D-0-9-3, fixed by K-BLK).
        expect(JSON.stringify(db.model.askedOf(CORE).at(-1)?.request)).toContain("Day la tien coc don DH-1")
        // One card, folded, never a second.
        expect(db.team).toHaveLength(1)
        expect(rowsOf(db, runId).run).toMatchObject({ engine: "langgraph", status: "waiting" })
    })
})

// D-0-9-3 (fixed): on a thread the founder's words travel on `turn.founderAnswers`; `ThreadStepService.troubled` now hands them to the
// AI core on its trigger (`founderAnswers`, as its instructions read them), so after an answer it does not ask the same thing again.
it("a stop answered in words: the AI core's request on the next visit carries the founder's words (founderAnswers)", async () => {
    const db = threadDbOf()
    const { process, runId } = await stopsAtAnswer(db)
    db.model.script(ANSWER, { confused: { reason: "Van khong ro", question: "Shop mo may gio?" } })
    db.model.script(CORE, report("Van chua ro."))

    await founderDecides(process, runId, answer(db, "8h den 21h"))

    const asked = db.model.askedOf(CORE)
    expect(asked).toHaveLength(2)
    // The instructions always name `founderAnswers`; the INPUT carries it only once the founder answered.
    expect(JSON.stringify(asked[0]?.request.input)).not.toContain("founderAnswers")
    expect(JSON.stringify(asked[1]?.request.input)).toContain("founderAnswers")
    expect(JSON.stringify(asked[1]?.request.input)).toContain("8h den 21h")
})

describe("a stop with a conversation", () => {
    it("reads waiting on the run page; an answer runs the step with the words; the card is rewritten in place when it completes", async () => {
        const db = threadDbOf()
        const { process, runId, ref } = await stopsAtAnswer(db)
        expect((await process.threads.stateOf(ref))?.status).toBe("stopped")
        const rows = rowsOf(db, runId)
        expect(rows.run).toMatchObject({ engine: "langgraph", status: "waiting" })
        expect(rows.steps.map((step) => [step.stepKey, step.status])).toEqual([
            ["understand", "done"],
            ["answer", "failed"],
        ])
        const [card] = db.team
        expect(card?.versions).toHaveLength(1)
        const [stop] = await stopsOf(process, runId)
        expect(stop?.cardMessageId).toBe(card?.id)

        db.model.script(ANSWER, sends(OUTCOME), { done: { reply: OUTCOME } })
        await founderDecides(process, runId, answer(db, "8h den 21h"))

        expect(JSON.stringify(db.model.askedOf(ANSWER).at(-1)?.request.input)).toContain("8h den 21h")
        expect((await process.threads.stateOf(ref))?.status).toBe("ended")
        const [resolved] = await stopsOf(process, runId)
        expect(resolved).toMatchObject({ state: "resolved", decision: { kind: "answer", text: "8h den 21h" } })
        expect(db.team).toHaveLength(1)
        expect(db.team[0]?.versions.at(-1)).toMatchObject({
            kind: "workflow.stopped",
            rewrite: { stop: { state: "answered", resolvedAt: expect.any(String) } },
        })
        expect(rowsOf(db, runId).run).toMatchObject({ engine: "langgraph", status: "done" })
    })

    it("retry: the step runs again with no founder words", async () => {
        const db = threadDbOf()
        const { process, runId, ref } = await stopsAtAnswer(db)
        db.model.script(ANSWER, sends(OUTCOME), { done: { reply: OUTCOME } })

        await founderDecides(process, runId, button(db, "retry"))

        expect(JSON.stringify(db.model.askedOf(ANSWER).at(-1)?.request.input)).not.toContain("founderAnswers")
        expect((await process.threads.stateOf(ref))?.status).toBe("ended")
        expect((await stopsOf(process, runId))[0]).toMatchObject({
            state: "resolved",
            answers: [{ kind: "retry", text: null }],
        })
    })

    it("skip: the run ends where it is, the stop and its card resolve, the speaker goes back", async () => {
        const db = threadDbOf()
        const { process, runId, ref } = await stopsAtAnswer(db)

        await founderDecides(process, runId, button(db, "skip"))

        expect((await process.threads.stateOf(ref))?.status).toBe("ended")
        expect(db.model.askedOf(ANSWER)).toHaveLength(1)
        expect((await stopsOf(process, runId))[0]).toMatchObject({ state: "resolved", decision: { kind: "skip" } })
        expect(db.team).toHaveLength(1)
        expect(db.team[0]?.versions.at(-1)).toMatchObject({
            kind: "workflow.stopped",
            rewrite: { stop: { state: "skipped", resolvedAt: expect.any(String) } },
        })
        expect(rowsOf(db, runId).run).toMatchObject({ status: "cancelled" })
        expect(db.released).toContain(FRONT)
    })

    it("take over: the thread stays at the gate, the run waits as taken over; a later answer still runs the step", async () => {
        const db = threadDbOf()
        const { process, runId, ref } = await stopsAtAnswer(db)

        await founderDecides(process, runId, button(db, "take_over"))

        expect((await process.threads.stateOf(ref))?.status).toBe("stopped")
        expect(db.model.askedOf(ANSWER)).toHaveLength(1)
        expect((await stopsOf(process, runId))[0]).toMatchObject({ state: "open" })
        expect(rowsOf(db, runId).run).toMatchObject({ status: "waiting", error: { code: "taken_over" } })

        db.model.script(ANSWER, sends(OUTCOME), { done: { reply: OUTCOME } })
        await founderDecides(process, runId, answer(db, "8h den 21h"))
        expect((await process.threads.stateOf(ref))?.status).toBe("ended")
        expect(actsOf(db, TOOL.customerMessageSend)).toHaveLength(1)
    })
})

describe("a side node (blocking: false) that fails (item 8)", () => {
    it("is passed over: no stop, no AI core, one founder notice, and the thread goes on to the next step", async () => {
        const db = threadDbOf()
        const flow = frontDeskFlow()
        const variant = {
            ...flow,
            nodes: flow.nodes.map((node) => (node.key === "complaint" ? { ...node, blocking: false } : node)),
        }
        db.model.script(UNDERSTAND, { answer: { branch: "complaint", summary: "Lan: hoa heo" } })
        db.model.script(COMPLAINT, { confused: { reason: "Khong ro don nao", question: null } })
        const process = await processOf(db, { flag: [FRONT_DESK] })
        const started = await startThread(process, {
            flow: variant,
            versionId: "chatbot-agent:front-desk@9",
            trigger: { conversationId: CONV, text: "Hoa heo het roi", channel: "zalo", leadId: "lead-1" },
            scopeKey: `conversation:${CONV}`,
        })

        expect(started.error).toBeNull()
        const runId = started.runId ?? ""
        const view = await process.threads.stateOf({ workspaceId: WS, runId })
        expect(view?.status).toBe("ended")
        expect(Object.keys(view?.state.steps ?? {})).toEqual(["understand", "complaint", "to-owner"])
        expect(await stopsOf(process, runId)).toEqual([])
        expect(db.model.askedOf(CORE)).toEqual([])
        expect(actsOf(db, TOOL.teamMessagePost).map((act) => act.dedupeKey)).toEqual([`side-passed:${runId}:complaint`])
        // The run page shows the side step as failed with its code (0-5's contract for "failed and passed"); the run is done.
        expect(rowsOf(db, runId).steps.find((step) => step.stepKey === "complaint")).toMatchObject({ status: "failed" })
        expect(rowsOf(db, runId).run).toMatchObject({ status: "done", engine: "langgraph" })
    })
})
